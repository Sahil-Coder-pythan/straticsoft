# ==============================================================================
# COMPREHENSIVE AI PROVIDER BASE URL CONFIGURATION
# ==============================================================================

from urllib.parse import urlparse

SUPPORTED_BASE_URLS = [

    # ==========================================================
    # 1. OPENAI
    # ==========================================================
    "https://api.openai.com/v1",
    "https://api.openai.com/v1/chat/completions",
    "https://api.openai.com",

    # ==========================================================
    # 2. GROQ
    # ==========================================================
    "https://api.groq.com/openai/v1",
    "https://api.groq.com/openai/v1/chat/completions",
    "https://api.groq.com/v1",
    "https://api.groq.com",

    # ==========================================================
    # 3. ANTHROPIC
    # ==========================================================
    "https://api.anthropic.com",
    "https://api.anthropic.com/v1",

    # ==========================================================
    # 4. GOOGLE GEMINI
    # ==========================================================
    "https://generativelanguage.googleapis.com",
    "https://generativelanguage.googleapis.com/v1beta",
    "https://generativelanguage.googleapis.com/v1beta/openai",

    # ==========================================================
    # 5. DEEPSEEK
    # ==========================================================
    "https://api.deepseek.com",
    "https://api.deepseek.com/v1",
    "https://api.deepseek.com/anthropic",

    # ==========================================================
    # 6. MISTRAL
    # ==========================================================
    "https://api.mistral.ai/v1",

    # ==========================================================
    # 7. XAI / GROK
    # ==========================================================
    "https://api.x.ai",
    "https://api.x.ai/v1",

    # ==========================================================
    # 8. OPENROUTER
    # ==========================================================
    "https://openrouter.ai/api/v1",

    # ==========================================================
    # 9. TOGETHER AI
    # ==========================================================
    "https://api.together.xyz/v1",
    "https://api.together.ai/v1",

    # ==========================================================
    # 10. FIREWORKS AI
    # ==========================================================
    "https://api.fireworks.ai/inference/v1",

    # ==========================================================
    # 11. CEREBRAS
    # ==========================================================
    "https://api.cerebras.ai/v1",

    # ==========================================================
    # 12. NVIDIA NIM
    # ==========================================================
    "https://integrate.api.nvidia.com/v1",

    # ==========================================================
    # 13. SAMBANOVA
    # ==========================================================
    "https://api.sambanova.ai/v1",

    # ==========================================================
    # 14. PERPLEXITY
    # ==========================================================
    "https://api.perplexity.ai",

    # ==========================================================
    # 15. COHERE
    # ==========================================================
    "https://api.cohere.com/v2",
    "https://api.cohere.com/compatibility/v1",

    # ==========================================================
    # 16. AI21 LABS
    # ==========================================================
    "https://api.ai21.com/studio/v1",

    # ==========================================================
    # 17. QWEN / ALIBABA DASHSCOPE
    # ==========================================================
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",

    # ==========================================================
    # 18. MOONSHOT / KIMI
    # ==========================================================
    "https://api.moonshot.ai/v1",

    # ==========================================================
    # 19. MINIMAX
    # ==========================================================
    "https://api.minimax.io/v1",

    # ==========================================================
    # 20. REKA AI
    # ==========================================================
    "https://api.reka.ai/v1",

    # ==========================================================
    # 21. Z.AI / ZHIPU
    # ==========================================================
    "https://open.bigmodel.cn/api/paas/v4",

    # ==========================================================
    # 22. STEPFUN
    # ==========================================================
    "https://api.stepfun.com/v1",

    # ==========================================================
    # 23. UPSTAGE
    # ==========================================================
    "https://api.upstage.ai/v1/solar",

    # ==========================================================
    # 24. NOVITA AI
    # ==========================================================
    "https://api.novita.ai/openai/v1",

    # ==========================================================
    # 25. DEEPINFRA
    # ==========================================================
    "https://api.deepinfra.com/v1/openai",

    # ==========================================================
    # 26. HUGGING FACE
    # ==========================================================
    "https://api-inference.huggingface.co",
    "https://huggingface.co",

    # ==========================================================
    # 27. REPLICATE
    # ==========================================================
    "https://api.replicate.com/v1",

    # ==========================================================
    # 28. AWS BEDROCK
    # ==========================================================
    "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1",
    "https://bedrock-runtime.us-east-2.amazonaws.com/openai/v1",
    "https://bedrock-runtime.us-west-2.amazonaws.com/openai/v1",

    # ==========================================================
    # 29. AWS BEDROCK MANTLE
    # ==========================================================
    "https://bedrock-mantle.us-east-1.api.aws/openai/v1",
    "https://bedrock-mantle.us-east-2.api.aws/openai/v1",
    "https://bedrock-mantle.us-west-2.api.aws/openai/v1",

    # ==========================================================
    # 30. MICROSOFT AZURE OPENAI
    # ==========================================================
    "https://openai.azure.com",

    # ==========================================================
    # 31. CLOUDFLARE AI GATEWAY
    # ==========================================================
    "https://gateway.ai.cloudflare.com",

    # ==========================================================
    # 32. BAIDU QIANFAN
    # ==========================================================
    "https://qianfan.baidubce.com/v2",
    "https://api.baiduqianfan.ai/v1",

    # ==========================================================
    # 33. BAICHUAN
    # ==========================================================
    "https://api.baichuan-ai.com/v1",

    # ==========================================================
    # 34. 01.AI / YI
    # ==========================================================
    "https://api.lingyiwanwu.com/v1",

    # ==========================================================
    # 35. MODELSCOPE
    # ==========================================================
    "https://api-inference.modelscope.cn/v1",

    # ==========================================================
    # 36. LOCAL OPENAI-COMPATIBLE SERVERS
    # ==========================================================
    "http://localhost:11434/v1",
    "http://127.0.0.1:11434/v1",
    "http://localhost:1234/v1",
    "http://127.0.0.1:1234/v1",
]


# ==============================================================================
# ALLOWED DOMAINS
# ==============================================================================

ALLOWED_DOMAINS = [
    "openai.com",
    "groq.com",
    "anthropic.com",
    "googleapis.com",
    "deepseek.com",
    "mistral.ai",
    "x.ai",
    "openrouter.ai",
    "together.xyz",
    "together.ai",
    "fireworks.ai",
    "cerebras.ai",
    "nvidia.com",
    "sambanova.ai",
    "perplexity.ai",
    "cohere.com",
    "ai21.com",
    "aliyuncs.com",
    "moonshot.ai",
    "minimax.io",
    "reka.ai",
    "bigmodel.cn",
    "stepfun.com",
    "upstage.ai",
    "novita.ai",
    "deepinfra.com",
    "huggingface.co",
    "replicate.com",
    "amazonaws.com",
    "api.aws",
    "azure.com",
    "openai.azure.com",
    "cloudflare.com",
    "baidubce.com",
    "baiduqianfan.ai",
    "baichuan-ai.com",
    "lingyiwanwu.com",
    "modelscope.cn",
]


# ==============================================================================
# URL VALIDATION
# ==============================================================================

def is_url_supported(url: str) -> bool:
    """
    Check whether the supplied API URL belongs to a supported provider.
    """

    if not url:
        return False

    clean_url = url.strip().rstrip("/")

    # ----------------------------------------------------------
    # 1. Exact URL match
    # ----------------------------------------------------------
    for supported in SUPPORTED_BASE_URLS:
        if supported.rstrip("/").lower() == clean_url.lower():
            return True

    # ----------------------------------------------------------
    # 2. Parse hostname safely
    # ----------------------------------------------------------
    try:
        parsed = urlparse(clean_url)

        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower()

    except Exception:
        return False

    # ----------------------------------------------------------
    # 3. Local development servers
    # ----------------------------------------------------------
    if hostname in ("localhost", "127.0.0.1"):
        return True

    # ----------------------------------------------------------
    # 4. Safe domain matching
    # ----------------------------------------------------------
    for domain in ALLOWED_DOMAINS:
        domain = domain.lower()

        if hostname == domain:
            return True

        if hostname.endswith("." + domain):
            return True

    return False
