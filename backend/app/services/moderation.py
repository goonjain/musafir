import re

# Curated list of offensive / abusive keywords and common spam indicators
BLOCKED_KEYWORDS = {
    "spam", "free crypto", "buy now", "discount code", "viagra", "casino",
    "f***", "b****", "s***", "c***", "a******", "bastard", "idiot", "hate"
}

def check_moderation(text: str) -> tuple[str, str]:
    """
    Checks user submitted text for profanity or spam.
    Returns (status, reason):
    - status: 'approved', 'flagged', or 'rejected'
    - reason: explanation of decision
    """
    if not text:
        return "approved", "clean"

    lower_text = text.lower()
    
    # Check for blocked terms
    for word in BLOCKED_KEYWORDS:
        if re.search(r'\b' + re.escape(word) + r'\b', lower_text):
            return "flagged", f"Contained flagged keyword: {word}"
    
    # Check for URL spam
    if "http://" in lower_text or "https://" in lower_text or ".com" in lower_text:
        return "flagged", "Contained promotional link"

    return "approved", "clean"
