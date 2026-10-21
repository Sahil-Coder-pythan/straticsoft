# ==============================================================================
# STRATIC SOFT - INTELLIGENT ANSWER LENGTH ROUTER
# ==============================================================================
#
# Yeh router sawal padhkar andaza lagata hai ki answer kitne WORDS ka aayega:
#
#   LOW    -> 1-50 words
#   MEDIUM -> 51-100 words
#   HARD   -> 101+ words
#
# Phir app.py usi tier ki API ko call karta hai (dashboard me jo select ki hai):
#   LOW -> product.low_provider
#   MEDIUM -> product.medium_provider
#   HARD -> product.hard_provider
#
# app.py me koi badlav zaroori nahi. Function ka naam wahi hai:
#   estimate_response_complexity(messages) -> "low" | "medium" | "hard"
#
# Order of decisions:
#   1. User ne khud length batayi ho (50 words, 5 lines, 2 paragraphs, 50-100 words)
#   2. "short / ek line me" jaise words  -> LOW
#   3. Code, story/essay, theory, list, explanation, jankari ... ke hisaab se andaza
#   4. Baaki sab chhote sawal -> LOW
# ==============================================================================

import re
from typing import List, Dict, Optional

LOW_MAX_WORDS = 50
MEDIUM_MAX_WORDS = 100


# ------------------------------------------------------------------------------
# TEXT HELPERS
# ------------------------------------------------------------------------------

_DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_HAS_DEVANAGARI = re.compile(r"[\u0900-\u097F]")


def _get_last_user_text(messages: List[Dict]) -> str:
    """Conversation ka aakhri USER message (agar user message nahi mila to aakhri message)."""
    if not messages:
        return ""

    chosen = None
    for m in reversed(messages):
        if str(m.get("role", "")).lower() == "user":
            chosen = m
            break
    if chosen is None:
        chosen = messages[-1]

    content = chosen.get("content", "")
    if content is None:
        return ""

    text = str(content).strip().lower().translate(_DEV_DIGITS)
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    return re.sub(r"\s+", " ", text)


def _compile(keywords: List[str]):
    """
    Keywords ko pattern me badalta hai.
    - English / Roman (Hinglish) words: poora shabd match hona chahiye
      (isse "ai" ab "explain" me, "api" ab "capital" me, "hi" ab "this" me match nahi hota)
    - Hindi (Devanagari) words: seedha tukda match hota hai
    """
    parts = []
    for kw in keywords:
        kw = kw.lower().strip()
        if not kw:
            continue
        esc = r"\s+".join(re.escape(p) for p in kw.split())
        if _HAS_DEVANAGARI.search(kw):
            parts.append(esc)
        else:
            parts.append(r"(?<![a-z0-9])" + esc + r"(?:s|es|ed|ing)?(?![a-z0-9])")
    return re.compile("|".join(parts))


def _has(pattern, text: str) -> bool:
    return pattern.search(text) is not None


# ------------------------------------------------------------------------------
# NOISE: aise phrases jo "bada / long / code" jaise lagte hain par matlab alag hai
# ------------------------------------------------------------------------------

_NOISE_PHRASES = [
    "sabse bada", "sabse badi", "sabse bade", "sabse lamba", "sabse lambi",
    "सबसे बड़ा", "सबसे बड़ी", "सबसे बड़े", "सबसे लंबा", "सबसे लंबी",
    "how long", "as long as", "long time", "long term", "kitna lamba", "kitni lambi",
    "pin code", "pincode", "zip code", "postal code", "area code", "dress code",
    "country code", "promo code", "morse code", "qr code", "पिन कोड", "पिनकोड",
]
_NOISE = re.compile("|".join(re.escape(p) for p in _NOISE_PHRASES))


# ------------------------------------------------------------------------------
# KEYWORD LISTS
# ------------------------------------------------------------------------------

SHORT_CUES = _compile([
    "short", "brief", "briefly", "in short", "tldr", "tl;dr", "quick answer",
    "one line", "1 line", "single line", "one sentence", "in one word", "one word",
    "ek line", "ek line me", "ek line mein", "ek shabd", "ek vakya", "ek sentence",
    "sankshep", "sankshep me", "sankshipt", "chota", "chhota", "choti", "chhoti",
    "छोटा", "छोटी", "संक्षेप", "संक्षिप्त", "एक लाइन", "एक शब्द", "एक वाक्य",
])

STRONG_LONG_CUES = _compile([
    "detail", "detailed", "in detail", "in depth", "in-depth", "elaborate",
    "comprehensive", "thoroughly", "deep dive", "lengthy", "long", "big", "huge",
    "bada", "badaa", "badi", "bara", "lamba", "lambi", "vistar", "vistaar",
    "vistar se", "vistaar se", "vistrit", "vistarpurvak", "detail me", "detail mein",
    "विस्तार", "विस्तृत", "विस्तारपूर्वक", "लंबा", "लंबी", "बड़ा", "बड़ी",
])

SOFT_LONG_CUES = _compile([
    "full", "complete", "entire", "everything", "all about", "sab kuch", "poora",
    "poori", "pura", "puri", "pure", "सब कुछ", "पूरा", "पूरी", "पूरे", "सारा", "सारी",
])

INFO_CUES = _compile([
    "jankari", "jaankari", "information", "info", "details about", "about",
    "baare me", "baare mein", "bare me", "bare mein", "ke baare", "ke bare",
    "biography", "jeevani", "profile", "introduction", "parichay",
    "जानकारी", "बारे में", "बारे मे", "के बारे", "जीवनी", "परिचय",
])

HISTORY_CUES = _compile([
    "history", "itihas", "itihaas", "इतिहास", "timeline", "origin", "evolution",
])

LONGFORM_CUES = _compile([
    "story", "kahani", "kahaani", "essay", "nibandh", "article", "blog", "speech",
    "bhashan", "report", "assignment", "script for", "screenplay", "chapter",
    "कहानी", "निबंध", "लेख", "भाषण", "रिपोर्ट",
])

MIDFORM_CUES = _compile([
    "poem", "kavita", "poetry", "shayari", "letter", "patra", "email", "mail",
    "paragraph", "para", "caption", "bio", "cover letter", "application for",
    "कविता", "शायरी", "पत्र", "ईमेल", "पैराग्राफ", "अनुच्छेद",
])

THEORY_TOPICS = _compile([
    "newton", "न्यूटन", "laws of motion", "law of motion", "गति के नियम", "गति का नियम",
    "gravity", "gravitation", "गुरुत्वाकर्षण", "relativity", "सापेक्षता",
    "quantum", "क्वांटम", "thermodynamics", "ऊष्मागतिकी", "electromagnetism",
    "photosynthesis", "प्रकाश संश्लेषण", "evolution", "विकासवाद", "big bang",
    "theorem", "प्रमेय", "derivation", "व्युत्पत्ति", "pythagoras", "calculus",
    "machine learning", "deep learning", "artificial intelligence", "ai",
    "neural network", "न्यूरल नेटवर्क", "algorithm", "एल्गोरिदम", "blockchain",
    "dna", "cell division", "mitosis", "meiosis", "ohm's law", "ohm law",
    "ohm का नियम", "ओम का नियम", "newton's", "inflation", "supply and demand",
])

THEORY_WORDS = _compile([
    "theory", "principle", "siddhant", "sidhant", "siddhaant", "concept",
    "derivation", "proof", "prove", "working principle", "mechanism",
    "सिद्धांत", "अवधारणा", "प्रमाण", "कार्य सिद्धांत", "kaam karne ka tarika",
])

ORDINAL_CUES = _compile([
    "first", "second", "third", "1st", "2nd", "3rd", "pehla", "pahla", "pehle",
    "pahle", "dusra", "doosra", "teesra", "tisra", "पहला", "पहले", "दूसरा", "तीसरा",
])

MULTI_CUES = _compile([
    "all the", "all", "sabhi", "saare", "sare", "saari", "sabhi niyam", "four",
    "five", "six", "seven", "multiple", "rules", "laws", "types", "kinds", "steps",
    "stages", "phases", "list of", "teeno", "chaaron", "charon", "niyam",
    "सभी", "सारे", "चारों", "पांचों", "छहों", "तीनों", "नियम", "कानून", "प्रकार",
    "चरण", "स्टेप",
])

MEDIUM_CUES = _compile([
    "explain", "how does", "how do", "how to", "how can", "how is", "how are",
    "step by step", "difference", "different", "compare", "comparison", "versus", "vs",
    "why", "reason", "summary", "summarize", "summarise", "describe", "example",
    "advantages", "disadvantages", "pros and cons", "benefits", "uses of", "features of",
    "samjhao", "samjha do", "samjhaiye", "samjhana", "kaise", "kyun", "kyu", "kyon",
    "fark", "antar", "tulna", "udaharan", "saransh", "fayde", "nuksan", "upyog",
    "समझाओ", "समझाइए", "समझा दो", "कैसे", "क्यों", "क्यूं", "अंतर", "फर्क", "तुलना",
    "उदाहरण", "कारण", "फायदे", "नुकसान", "उपयोग", "सारांश",
])

REWRITE_CUES = _compile([
    "translate", "translation", "anuvad", "rewrite", "paraphrase", "proofread",
    "grammar", "correct this", "fix grammar", "अनुवाद", "सुधारो", "दोबारा लिखो",
])

FIX_CUES = _compile([
    "fix", "debug", "error", "bug", "review", "improve", "optimize", "optimise",
    "refactor", "sudharo", "theek karo", "thik karo", "ठीक करो",
])

GREETING_CUES = _compile([
    "hello", "hi", "hey", "hii", "hiii", "helo", "namaste", "namaskar", "thanks",
    "thank you", "thankyou", "ok", "okay", "bye", "good morning", "good night",
    "good evening", "gm", "gn", "shukriya", "dhanyawad", "dhanyavaad",
    "हेलो", "हाय", "नमस्ते", "नमस्कार", "धन्यवाद", "शुक्रिया", "थैंक यू", "ओके", "बाय",
])

CODE_CUES = _compile([
    "code", "coding", "program", "programming", "script", "python", "javascript",
    "java", "html", "css", "sql", "react", "flask", "fastapi", "django", "node",
    "c++", "api", "app", "application", "function", "bash", "regex", "kotlin",
    "swift", "php", "typescript", "android", "website", "web page", "webpage",
    "कोड", "कोडिंग", "प्रोग्राम", "स्क्रिप्ट", "ऐप", "एप", "वेबसाइट", "फंक्शन",
])

BIG_CODE_CUES = _compile([
    "game", "website", "web site", "web page", "webpage", "project", "software",
    "dashboard", "login system", "chatbot", "clone", "management system", "full stack",
    "fullstack", "portfolio", "e-commerce", "ecommerce", "application", "app",
    "गेम", "वेबसाइट", "प्रोजेक्ट", "सॉफ्टवेयर", "ऐप", "एप", "एप्लीकेशन", "एप्लिकेशन",
])

SMALL_CODE_CUES = _compile([
    "one line", "1 line", "snippet", "small", "simple", "chota", "chhota", "choti",
    "hello world", "छोटा", "सिंपल", "ek line", "एक लाइन",
])

# kitna chhota/bada sawal hai -> "kisne / kaun / kya hai / kab" jaise simple facts
FACT_CUES = _compile([
    "kisne", "kaun", "kon", "kab", "kahan", "kaha", "kitna", "kitne", "kitni",
    "who", "when", "where", "which", "capital of", "founder of", "inventor of",
    "किसने", "कौन", "कब", "कहाँ", "कहां", "कितना", "कितने", "कितनी",
])


# ------------------------------------------------------------------------------
# EXPLICIT LENGTH (user ne khud bataya)
# ------------------------------------------------------------------------------

_UNIT = (
    r"(?P<unit>words?|shabd(?:on)?|शब्द(?:ों)?|"
    r"lines?|line|लाइन(?:ें|्स|ों)?|पंक्ति(?:यां|यों)?|"
    r"sentences?|vakya|वाक्य(?:ों)?|"
    r"paragraphs?|paras?|पैराग्राफ|अनुच्छेद)"
)

_AT_LEAST = r"(?:at\s+least|minimum|min|kam\s+se\s+kam|कम\s+से\s+कम)"

_RANGE_RE = re.compile(
    r"(?<!\d)(?P<a>\d{1,6})\s*(?:-|–|to|se|से|aur|और)\s*(?P<b>\d{1,6})\s*(?:\+)?\s*" + _UNIT,
    re.IGNORECASE,
)
_NUM_RE = re.compile(
    r"(?P<pre>" + _AT_LEAST + r"\s*)?(?<!\d)(?P<n>\d{1,6})\s*(?P<plus>\+|plus)?\s*" + _UNIT,
    re.IGNORECASE,
)

# "50 se jyada 100 se kam", "20 se kam", "100 se jyada"
_BETWEEN_RE = re.compile(
    r"(\d+)\s*(?:se|से)\s*(?:jyada|zyada|ज्यादा|ज़्यादा)\s*(?:aur\s*)?(\d+)\s*(?:se|से)\s*(?:kam|कम)",
    re.IGNORECASE,
)
_LESS_RE = re.compile(r"(\d+)\s*(?:se|से)\s*(?:kam|कम)", re.IGNORECASE)
_MORE_RE = re.compile(r"(\d+)\s*(?:se|से)\s*(?:jyada|zyada|ज्यादा|ज़्यादा)", re.IGNORECASE)

_WORDS_PER = {"word": 1, "line": 12, "sentence": 18, "paragraph": 60}


def _unit_kind(unit: str) -> str:
    u = unit.lower()
    if u.startswith("word") or u.startswith("shabd") or u.startswith("शब्द"):
        return "word"
    if u.startswith("line") or u.startswith("लाइन") or u.startswith("पंक्ति"):
        return "line"
    if u.startswith("sentence") or u.startswith("vakya") or u.startswith("वाक्य"):
        return "sentence"
    return "paragraph"


def _explicit_expected_words(text: str, is_code: bool) -> Optional[int]:
    """User ne length khud batayi ho to uska andaza (words me). Nahi batayi to None."""

    # "50 se jyada 100 se kam"
    m = _BETWEEN_RE.search(text)
    if m:
        low, high = int(m.group(1)), int(m.group(2))
        return (low + high) // 2 if high > low else high

    # "50-100 words", "50 to 100 words"
    m = _RANGE_RE.search(text)
    if m:
        a, b = int(m.group("a")), int(m.group("b"))
        kind = _unit_kind(m.group("unit"))
        per = 8 if (kind == "line" and is_code) else _WORDS_PER[kind]
        return int(((a + b) / 2) * per)

    # "100 words", "5 lines", "2 paragraphs", "at least 100 words", "100+ words"
    m = _NUM_RE.search(text)
    if m:
        n = int(m.group("n"))
        kind = _unit_kind(m.group("unit"))
        per = 8 if (kind == "line" and is_code) else _WORDS_PER[kind]
        words = n * per
        if m.group("pre"):
            words = int(words * 1.2) + 1
        elif m.group("plus"):
            words = words + 1
        return max(words, 1)

    # "20 se kam" / "100 se jyada" (unit ke bina)
    m = _LESS_RE.search(text)
    if m and (_has(_compile(["words", "word", "shabd"]), text) or "शब्द" in text):
        return max(1, int(m.group(1)) - 1)

    m = _MORE_RE.search(text)
    if m and (_has(_compile(["words", "word", "shabd"]), text) or "शब्द" in text):
        return int(m.group(1)) + 1

    return None


# ------------------------------------------------------------------------------
# MAIN ESTIMATOR
# ------------------------------------------------------------------------------

_COUNT_LIST_RE = re.compile(
    r"(?<!\d)(\d{1,3})\s+(?:types|kinds|ways|steps|examples|points|reasons|tips|ideas|"
    r"facts|benefits|uses|advantages|disadvantages|differences|names|prakar|tarike|"
    r"example|point|reason|tip|idea|fact|benefit)\b",
    re.IGNORECASE,
)


def _input_word_count(text: str) -> int:
    return len(text.split())


def _estimate_expected_answer_words(text: str) -> int:
    """
    Question dekhkar andaza lagata hai ki answer kitne words ka aayega.
    (API call se pehle, sirf question ke matlab se.)
    """
    text = _NOISE.sub(" ", text).strip()

    if not text:
        return 1

    is_code = _has(CODE_CUES, text)

    # ---------- 1. User ne khud length batayi ----------
    explicit = _explicit_expected_words(text, is_code)
    if explicit is not None:
        return explicit

    short = _has(SHORT_CUES, text)
    strong_long = _has(STRONG_LONG_CUES, text)
    soft_long = _has(SOFT_LONG_CUES, text)
    info = _has(INFO_CUES, text)
    history = _has(HISTORY_CUES, text)
    longform = _has(LONGFORM_CUES, text)
    midform = _has(MIDFORM_CUES, text)
    theory_topic = _has(THEORY_TOPICS, text)
    theory_word = _has(THEORY_WORDS, text)
    ordinal = _has(ORDINAL_CUES, text)
    multi = _has(MULTI_CUES, text) and not ordinal
    medium_cue = _has(MEDIUM_CUES, text)
    fact = _has(FACT_CUES, text)
    words_in = _input_word_count(text)

    # ---------- 2. Code ----------
    if is_code:
        if short and not _has(BIG_CODE_CUES, text):
            return 75
        if strong_long or soft_long or _has(BIG_CODE_CUES, text):
            return 400
        if _has(SMALL_CODE_CUES, text):
            return 75
        # Pasted code ko theek karne / review karne ko kaha ho
        if words_in > 80 and _has(FIX_CUES, text):
            return 300
        return 75

    # ---------- 3. Translate / rewrite: jitna input utna output ----------
    if _has(REWRITE_CUES, text) and words_in > 12:
        return words_in

    # ---------- 4. Kahani / essay / article ----------
    if longform:
        return 75 if short else 180

    # ---------- 5. Kavita / letter / email / paragraph ----------
    if midform:
        return 45 if short else 90

    # ---------- 6. "short / ek line me" ----------
    if short:
        return 40

    # ---------- 7. Detail me / bada / lamba ----------
    if strong_long:
        return 180

    # ---------- 8. Theory / concept ----------
    if theory_topic or theory_word:
        if soft_long or medium_cue or theory_word:
            # "poora siddhant", "explain newton", "theory of ..."
            return 180 if multi else 130
        if multi:
            return 130
        # sirf topic ka naam ya "what is gravity"
        return 75

    # ---------- 9. Poori jankari / itihas ----------
    if soft_long:
        if history:
            return 180
        if info:
            return 90
        return 130

    if history:
        return 130

    # ---------- 10. Kai cheezein / list ----------
    m = _COUNT_LIST_RE.search(text)
    if m:
        n = int(m.group(1))
        if n >= 4:
            return 110
        if n >= 2:
            return 75
    if multi:
        return 110

    # ---------- 11. Samjhao / compare / kaise / kyun ----------
    if medium_cue:
        return 75

    # ---------- 12. "X ke baare me batao" ----------
    if info:
        return 75

    # ---------- 13. Hello / thanks / ok ----------
    if _has(GREETING_CUES, text) and words_in <= 6:
        return 10

    # ---------- 14. Seedha chhota sawal ----------
    if fact:
        return 35

    return 35


def _tier_from_expected_words(expected_words: int) -> str:
    """
    1-50   -> LOW
    51-100 -> MEDIUM
    101+   -> HARD
    """
    try:
        expected_words = int(expected_words)
    except (TypeError, ValueError):
        expected_words = 35

    if expected_words <= LOW_MAX_WORDS:
        return "low"

    if expected_words <= MEDIUM_MAX_WORDS:
        return "medium"

    return "hard"


def estimate_response_complexity(messages: List[Dict]) -> str:
    """
    Returns: "low" | "medium" | "hard"
    """
    text = _get_last_user_text(messages)

    if not text:
        return "low"

    expected_words = _estimate_expected_answer_words(text)
    return _tier_from_expected_words(expected_words)
