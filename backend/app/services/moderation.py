import re

# Abusive, harassment, and malicious spam keywords
BLOCKED_KEYWORDS = [
    "spam", "free crypto", "buy now", "discount code", "viagra", "casino",
    "bastard", "idiot", "scam", "porn", "nude", "sex", "abuse", "fraud",
    "fck", "fuck", "bitch", "shit", "asshole", "cunt", "slut", "whore"
]

LEET_MAP = {
    '@': 'a', '4': 'a',
    '3': 'e',
    '1': 'i', '!': 'i', '|': 'i',
    '0': 'o',
    '5': 's', '$': 's',
    '7': 't', '+': 't',
}

def normalize_text_for_moderation(text: str) -> str:
    """Normalize leetspeak and repeated chars for moderation inspection."""
    res = text.lower()
    for char, replacement in LEET_MAP.items():
        res = res.replace(char, replacement)
    # Collapse repetitive sequential characters (e.g. "baaaaastard" -> "baastard" or "bastard")
    res = re.sub(r'(.)\1{2,}', r'\1\1', res)
    return res

def check_moderation(text: str) -> tuple[str, str]:
    """
    Checks user submitted text for profanity, abusive terms, or malicious spam.
    Returns (status, reason):
    - status: 'approved', 'flagged', or 'rejected'
    - reason: explanation of decision
    """
    if not text or not text.strip():
        return "approved", "clean"

    lower_text = text.lower()
    normalized = normalize_text_for_moderation(text)

    # 1. Check for URL / crypto spam
    if any(domain in lower_text for domain in ["http://", "https://", "www.", ".ru", ".xyz", "t.me/"]):
        return "flagged", "Contained external promotional link"
    
    # 2. Check for blocked keywords with word boundaries
    for word in BLOCKED_KEYWORDS:
        pattern = r'(?:\b|_)' + re.escape(word) + r'(?:\b|_)'
        if re.search(pattern, lower_text) or re.search(pattern, normalized):
            return "flagged", f"Contained flagged keyword: {word}"
        
        # Check for spaced out letters (e.g. "s h i t" or "f u c k")
        spaced_word = r'\s+'.join(list(word))
        if re.search(r'\b' + spaced_word + r'\b', normalized):
            return "flagged", f"Contained obfuscated keyword: {word}"

    return "approved", "clean"
