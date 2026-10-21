import httpx
import asyncio
from typing import List, Dict

# Purani support checking functions import rakhe hain taaki baaki app me koi dependency error na aaye
from MODEL import is_model_supported
from URL import is_url_supported


async def verify_provider_credentials(api_key: str, base_url: str, model_name: str) -> bool:
    """
    Duniya ki HAR AI Company ke API Key, Model Name aur URL ko 
    Instant Live Verify karne ka Universal Catch-All Engine.
    Sahi details par 100% Green Accept, Galat par Instant Red Reject.
    """
    clean_url = base_url.strip().rstrip('/')
    clean_model = model_name.strip()
    clean_key = api_key.strip()

    # Universal Headers sabhi top providers ke liye
    headers = {
        "Authorization": f"Bearer {clean_key}",
        "x-goog-api-key": clean_key,
        "x-api-key": clean_key,
        "api-key": clean_key,
        "Content-Type": "application/json"
    }

    # -------------------------------------------------------------
    # 1. GOOGLE GEMINI NATIVE & OPENAI FORMAT AUTO-HANDLING
    # -------------------------------------------------------------
    if "generativelanguage.googleapis.com" in clean_url:
        # Native :generateContent format check
        if ":generateContent" in clean_url:
            test_url = f"{clean_url}?key={clean_key}" if "?key=" not in clean_url else clean_url
            gemini_payload = {"contents": [{"parts": [{"text": "ping"}]}]}
            try:
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                    res = await client.post(test_url, json=gemini_payload)
                    if res.status_code == 200:
                        return True
            except:
                pass
        
        # Standard Gemini OpenAI-compatible path normalization
        clean_url = "https://generativelanguage.googleapis.com/v1beta/openai"

    # -------------------------------------------------------------
    # 2. ANTHROPIC CLAUDE FORMAT AUTO-HANDLING
    # -------------------------------------------------------------
    if "anthropic.com" in clean_url:
        target_url = f"{clean_url}/v1/messages" if not clean_url.endswith("/messages") else clean_url
        claude_headers = {
            "x-api-key": clean_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        claude_payload = {
            "model": clean_model,
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}]
        }
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.post(target_url, json=claude_payload, headers=claude_headers)
                return res.status_code == 200
        except:
            return False

    # -------------------------------------------------------------
    # 3. UNIVERSAL OPENAI-COMPATIBLE ROUTE (OpenAI, Groq, DeepSeek,
    #    Mistral, Together AI, OpenRouter, Perplexity, LocalLLM, etc.)
    # -------------------------------------------------------------
    if not (clean_url.endswith("/chat/completions") or clean_url.endswith("/completions")):
        full_url = f"{clean_url}/chat/completions"
    else:
        full_url = clean_url

    payload = {
        "model": clean_model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.post(full_url, headers=headers, json=payload)
            
            # 200 Status means URL + Key + Model ALL ARE 100% VALID!
            if response.status_code == 200:
                return True

            # Fallback check without /chat/completions suffix (Just in case custom proxy used)
            if response.status_code == 404 and full_url != clean_url:
                res_fallback = await client.post(clean_url, headers=headers, json=payload)
                return res_fallback.status_code == 200

            # Any status code other than 200 (401, 404, 400) = INSTANT REJECT
            return False
            
    except Exception as e:
        print(f"Live Verification Error: {str(e)}")
        return False


async def call_llm(provider, messages: List[Dict]) -> str:
    """
    LLM Chat API call handler.
    Auto-retry ke saath high stability deta hai.
    """
    clean_url = provider.base_url.strip().rstrip('/')
    clean_key = provider.api_key.strip()
    
    if clean_url.endswith("/chat/completions"):
        full_url = clean_url
    else:
        full_url = f"{clean_url}/chat/completions"

    headers = {
        "Authorization": f"Bearer {clean_key}",
        "x-goog-api-key": clean_key,
        "x-api-key": clean_key,
        "api-key": clean_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": provider.model_name.strip(),
        "messages": messages,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
        last_error = None
        for attempt in range(3):
            try:
                response = await client.post(full_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                last_error = e
                if attempt < 2:
                    await asyncio.sleep(1.5)
        raise last_error
    
