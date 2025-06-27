import os
import json
from typing import Dict, Tuple
from fuzzywuzzy import fuzz
import re
import unicodedata


def clean_arabic_text(text: str) -> str:
    # Normalize Unicode
    text = unicodedata.normalize("NFKC", text)

    # Remove Arabic diacritics (Tashkeel)
    text = re.sub(r'[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]', '', text)

    # Remove tatweel, invisible chars (ZWNJ, ZWJ, LRM, RLM, etc.)
    text = re.sub(r'[ـ\u200c\u200d\u200e\u200f]', '', text)

    # Remove all punctuation (Arabic and English)
    punctuation_pattern = r'[^\w\s\u0600-\u06FF]'
    text = re.sub(punctuation_pattern, '', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text

def sliding_fuzzy_match(pattern: str, target: str, threshold: float = 65, window_buffer: int = 20, fast_match: bool = True) -> bool:
    pattern = clean_arabic_text(pattern)
    target = clean_arabic_text(target)

    # Exact match shortcut
    if pattern in target:
        return True

    # If not risky (long pattern or short target), try simple global match
    if fast_match and (len(pattern) >= 50 or len(target) <= 500):
        score = fuzz.partial_ratio(pattern, target)
        return score >= threshold

    # Otherwise, use sliding window (slow but robust)
    window_size = len(pattern) + window_buffer
    step_size = max(1, window_buffer // 2)

    for i in range(0, len(target) - window_size + 1, step_size):
        window = target[i:i + window_size]
        score = fuzz.partial_ratio(pattern, window)
        if score >= threshold:
            return True

    return False

def load_raw_book(book_path: str) -> Tuple[Dict[int, str], str]:
    with open(book_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    book_id = data.get("book_id", "")
    headers = data.get("headers", "")
    pages = data.get("pages", "")
    pages_sorted = []
    for hd in headers:
        for page_str, entries in pages[hd].items():
            page_num = int(page_str)
            # Remove all newlines from each cleaned_text entry before joining
            joined_text = " ".join(entry.get("cleaned_text", "").replace('\n', '') for entry in entries)
            pages_sorted.append((page_num, hd, joined_text))
    return pages_sorted, book_id


def get_all_json_files(folder: str) -> Dict[str, str]:
    """Recursively get all JSON files as a mapping from base filename to full path."""
    json_files = {}
    for root, _, files in os.walk(folder):
        for f in files:
            if f.endswith(".json"):
                key = os.path.splitext(f)[0]
                json_files[key] = os.path.join(root, f)
    return json_files
