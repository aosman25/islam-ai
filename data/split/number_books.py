import os
import json
from typing import Dict, List, Tuple
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

def process_books(raw_folder: str, chunked_folder: str, output_folder: str, fast_match: bool = True, skip_error: bool = True):
    os.makedirs(output_folder, exist_ok=True)

    raw_books = get_all_json_files(raw_folder)
    chunked_books = get_all_json_files(chunked_folder)

    # Load processed books list
    processed_books_path = os.path.join(output_folder, "processed_books.json")
    error_books_path = os.path.join(output_folder, "error_books.json")
    if os.path.exists(processed_books_path):
        with open(processed_books_path, 'r', encoding='utf-8') as pf:
            processed_books = set(json.load(pf))
    else:
        processed_books = set()
    if os.path.exists(error_books_path):
        with open(error_books_path, 'r', encoding='utf-8') as pf:
            error_books = set(json.load(pf))
    else:
        error_books = set()
    for base_name, chunk_path in chunked_books.items():
        if os.path.basename(chunk_path) == "processed_books.json":
            continue
        if base_name in processed_books:
            print(f"Skipping already processed book: {base_name}")
            continue

        with open(chunk_path, 'r', encoding='utf-8') as f:
            chunks = json.load(f)

        if not chunks:
            continue

        book_name = chunks[0].get("book_name", "")
        raw_path = raw_books.get(base_name)
        if not raw_path:
            print(f"⚠ Raw book for '{book_name}' not found.")
            continue

        page_texts, book_id = load_raw_book(raw_path)
        page_texts.append((page_texts[-1][0],page_texts[-1][1],  "END"))
        chunk_pointer, page_pointer = 0, 0
        start_page = page_texts[0][0]
        curr_headers = []

        while page_pointer < len(page_texts) and chunk_pointer < len(chunks):
            chunk_text = chunks[chunk_pointer]["text"]
            page_num,header_title,page_text = page_texts[page_pointer]
            pattern = page_text
            target = chunk_text
            if not header_title in curr_headers:
                curr_headers.append(header_title)
            if  sliding_fuzzy_match(pattern, target, fast_match=fast_match):
                page_pointer += 1
            else:
                chunks[chunk_pointer]["page_range"] = [start_page, page_num]
                chunks[chunk_pointer]["header_titles"] = curr_headers
                curr_headers = []
                start_page = page_num
                chunk_pointer += 1
                page_pointer += 1



        if not skip_error or (page_pointer >= len(page_texts) and chunk_pointer == len(chunks) - 1):
            for i, chunk in enumerate(chunks):
                chunk["order"] = i
                chunk["book_id"] = book_id

            knowledge = chunks[0]["knowledge"]
            category = chunks[0]["category"]
            output_path = os.path.join(output_folder, knowledge, category, base_name + ".json") if knowledge != category else os.path.join(output_folder, knowledge, base_name + ".json")

            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(chunks, f, ensure_ascii=False, indent=2)

            print(f"✓ Processed: {book_name} ({len(chunks)} chunks)")
            if page_pointer >=  len(page_texts):
                # Add to processed books
                processed_books.add(base_name)
                if base_name in error_books:
                    error_books.remove(base_name)
            else:
                error_books.add(base_name)
            with open(processed_books_path, 'w', encoding='utf-8') as pf:
                json.dump(sorted(processed_books), pf, ensure_ascii=False, indent=2)
            with open(error_books_path, 'w', encoding='utf-8') as ef:
                    json.dump(sorted(error_books), ef, ensure_ascii=False, indent=2)
        else:
            print(f"Error Processing: {book_name} ({len(chunks)} chunks)")
            error_books.add(base_name)
            with open(error_books_path, 'w', encoding='utf-8') as ef:
                json.dump(sorted(error_books), ef, ensure_ascii=False, indent=2)
if __name__ == "__main__":
    root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_folder = os.path.join(root_folder, "raw_books")
    chunked_folder = os.path.join(root_folder, "chunked_books")
    output_folder = os.path.join(root_folder, "chunked_books_with_ranges")
    process_books(raw_folder, chunked_folder, output_folder, fast_match=True, skip_error=False)


