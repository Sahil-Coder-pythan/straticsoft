# ==============================================================================
# ALL SUPPORTED AI MODELS LIST & SMART DYNAMIC MATCHING
# ==============================================================================

SUPPORTED_MODELS = [
    # -------------------------------------------------------------
    # 1. GOOGLE (GEMINI & GEMMA)
    # -------------------------------------------------------------
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-pro",
    "gemini-pro-vision",
    "gemma-2-27b-it",
    "gemma-2-9b-it",
    "gemma-2-2b-it",
    "gemma-3-27b-it",
    "gemma-4-31b-it",

    # -------------------------------------------------------------
    # 2. OPENAI (GPT & REASONING / O-SERIES)
    # -------------------------------------------------------------
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4o-2024-08-06",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1",
    "o1-preview",
    "o1-mini",
    "o3-mini",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",

    # -------------------------------------------------------------
    # 3. ANTHROPIC (CLAUDE)
    # -------------------------------------------------------------
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",

    # -------------------------------------------------------------
    # 4. DEEPSEEK
    # -------------------------------------------------------------
    "deepseek-chat",
    "deepseek-reasoner",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-V2.5",
    "deepseek-ai/DeepSeek-Coder-V2-Instruct",

    # -------------------------------------------------------------
    # 5. META LLAMA
    # -------------------------------------------------------------
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "meta-llama/Llama-3.3-70B-Instruct",
    "meta-llama/Llama-3.1-405B-Instruct",
    "meta-llama/Llama-3.1-70B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
    "meta-llama/Llama-3.2-90B-Vision-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",

    # -------------------------------------------------------------
    # 6. QWEN (ALIBABA)
    # -------------------------------------------------------------
    "qwen/qwen-2.5-72b-instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "Qwen/Qwen2.5-32B-Instruct",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "Qwen/QwQ-32B",
    "qwen-turbo",
    "qwen-plus",
    "qwen-max",

    # -------------------------------------------------------------
    # 7. MISTRAL AI
    # -------------------------------------------------------------
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "pixtral-large-latest",
    "codestral-latest",
    "mistralai/Mistral-Large-Instruct-2411",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "mistralai/Mixtral-8x22B-Instruct-v0.1",

    # -------------------------------------------------------------
    # 8. PERPLEXITY & XAI (GROK)
    # -------------------------------------------------------------
    "grok-2-latest",
    "grok-2-vision-latest",
    "grok-beta",
    "sonar-reasoning-pro",
    "sonar-pro",
    "sonar",

    # -------------------------------------------------------------
    # 9. COHERE, MICROSOFT & ENTERPRISE MODELS
    # -------------------------------------------------------------
    "command-r-plus",
    "command-r",
    "microsoft/phi-4",
    "microsoft/Phi-3.5-mini-instruct",
    "ibm-granite/granite-3.1-8b-instruct",
    "jamba-1.5-large",
    "amazon.titan-text-express-v1"
]


def is_model_supported(model_name: str) -> bool:
    """
    1. Pehle exact match check karega list se.
    2. Agar koi NAYA model aaye jo list me na ho, to Prefix matching 
       se use automatically ALLOW kar dega bina kisi error ke!
    """
    if not model_name:
        return False

    clean_model = model_name.strip().lower()

    # Exact Match Check
    for m in SUPPORTED_MODELS:
        if m.lower() == clean_model:
            return True

    # Smart Auto-Match Prefixes (For Future / New Models)
    common_prefixes = [
        "gpt-", "o1-", "o3-", "o4-", "chatgpt-", 
        "gemini-", "gemma-", 
        "claude-", "anthropic/",
        "llama-", "meta-llama/", "meta/",
        "deepseek", "deepseek-",
        "mistral", "mixtral", "codestral", "pixtral", "ministral",
        "qwen", "qwq-",
        "command-", "cohere",
        "grok-", "xai/",
        "sonar-", "perplexity",
        "phi-", "microsoft/",
        "granite", "ibm-",
        "jamba-", "ai21/",
        "titan-", "amazon/",
        "whisper", "yi-", "falcon"
    ]
    
    for prefix in common_prefixes:
        if clean_model.startswith(prefix):
            return True

    return False
