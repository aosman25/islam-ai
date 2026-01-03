from typing import Dict, Tuple
import re
import unicodedata


def clean_arabic_text(text: str) -> str:
    """
    Strict normalization that only keeps pure text content for accurate length matching.
    Removes all decorative marks, control characters, punctuation, and whitespace.
    """
    # Normalize Unicode to canonical form
    text = unicodedata.normalize("NFKC", text)

    # Remove Arabic diacritics (Tashkeel) - all vowel marks and pronunciation guides
    text = re.sub(r'[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]', '', text)

    # Remove tatweel (elongation character)
    text = re.sub(r'ـ', '', text)

    # Remove ALL invisible and control characters
    # This includes ZWNJ, ZWJ, LRM, RLM, soft hyphen, zero-width space, etc.
    text = re.sub(r'[\u200c\u200d\u200e\u200f\u00ad\u200b\ufeff]', '', text)

    # Remove all Unicode control characters (C0, C1 controls)
    text = re.sub(r'[\u0000-\u001F\u007F-\u009F]', '', text)

    # Remove ALL punctuation and special characters (Arabic and Latin)
    # Keep ONLY Arabic letters, Arabic-Indic digits, and Latin alphanumeric
    text = re.sub(r'[^\u0621-\u064A\u0660-\u0669\u06F0-\u06F9a-zA-Z0-9]', '', text)

    # Remove ALL remaining whitespace completely (no spaces at all)
    text = re.sub(r'\s+', '', text)

    return text

def load_raw_book(data) -> Tuple[Dict[int, str], str]:
    headers = data.get("headers", "")
    pages = data.get("pages", "")
    pages_sorted = []
    pages_total_length = 0
    for hd in headers:
        for page_str, entries in pages[hd].items():
            page_num = int(page_str)
            # Remove all newlines from each cleaned_text entry before joining
            joined_text = clean_arabic_text(" ".join(entry.get("cleaned_text", "").replace('\n', '') for entry in entries))
            pages_sorted.append([page_num, hd, len(joined_text)])
            pages_total_length += pages_sorted[-1][-1]
    return pages_sorted, pages_total_length