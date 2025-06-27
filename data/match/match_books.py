import os
import json
from dotenv import load_dotenv
from utils import *
load_dotenv()

def match_books(raw_folder: str, chunked_folder: str, output_folder: str, fast_match: bool = True, skip_error: bool = True):
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
            knowledge = chunks[0]["knowledge"]
            category = chunks[0]["category"]
            output_path = os.path.join(output_folder, knowledge, category, base_name + ".json") if knowledge != category else os.path.join(output_folder, knowledge, base_name + ".json")

            # Add page_range to unprocessed chunks
            for i in range(chunk_pointer,len(chunks)):
                if not "page_range" in chunks[i]:
                    _,end_page = chunks[i - 1]["page_range"]
                    header_titles = chunks[i - 1]["header_titles"]
                    chunks[i]["page_range"] = [end_page, end_page]
                    chunks[i]["header_titles"] = header_titles


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
    root_folder = os.getenv("ROOT_FOLDER")
    raw_folder = os.path.join(root_folder, "books", "raw_books")
    chunked_folder = os.path.join(root_folder, "books", "chunked_books", "test")
    output_folder = os.path.join(root_folder, "books",  "chunked_books_with_ranges")
    match_books(raw_folder, chunked_folder, output_folder, fast_match=True, skip_error=False)

