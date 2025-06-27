import os
import json
import uuid
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, as_completed
from modules.encoders import DeepInfraEncoder
from semantic_chunkers import StatisticalChunker
from threading import Lock
from dotenv import load_dotenv

load_dotenv()

# Global progress tracking
progress_lock = Lock()
completed = 0
total_tasks = 0

def process_book(book_md_path, book_json_path, output_folder, encoder_config):
    global completed

    book_name = os.path.splitext(os.path.basename(book_md_path))[0]

    # Load metadata
    with open(book_json_path, "r", encoding="utf-8") as jf:
        metadata = json.load(jf)

    book_id = metadata.get("book_id", "")
    knowledge = metadata.get("knowledge", "")
    category = metadata.get("category", "")
    author = metadata.get("author", "")

    with open(book_md_path, "r", encoding="utf-8") as f:
        book_text = f.read()

    # Create encoder and chunker
    encoder = DeepInfraEncoder(**encoder_config)
    chunker = StatisticalChunker(
        encoder=encoder,
        min_split_tokens=1000,
        max_split_tokens=5000,
        split_tokens_tolerance=0,
        enable_statistics=False
    )

    chunks = chunker(docs=[book_text])
    all_chunks = []
    for chunkList in chunks:
        for chunk in chunkList:
            all_chunks.append({
                "id": str(uuid.uuid4()),
                "book_id": book_id,
                "book_name": book_name,
                "order": len(all_chunks),
                "author": author,
                "knowledge": knowledge,
                "category": category,
                "text": " ".join(chunk.splits)
            })

    category_folder = output_folder if category == knowledge else os.path.join(output_folder, category)
    os.makedirs(category_folder, exist_ok=True)
    output_book_path = os.path.join(category_folder, f"{book_name}.json")

    with open(output_book_path, "w", encoding="utf-8") as json_file:
        json.dump(all_chunks, json_file, ensure_ascii=False, indent=4)

    # Print progress
    with progress_lock:
        global completed, total_tasks
        completed += 1
        print(f"[{completed}/{total_tasks}] Finished: {book_name}")

    return book_name


def semantic_chunk_books(input_folder, output_folder):
    global total_tasks
    encoder_config = {
        "deepinfra_api_key": os.getenv("DEEPINFRA_API_KEY"),
        "name": "BAAI/bge-m3-multi"
    }

    processed_books_path = os.path.join(output_folder, "processed_books.json")
    if os.path.exists(processed_books_path):
        with open(processed_books_path, "r", encoding="utf-8") as f:
            processed_books = set(json.load(f))
    else:
        processed_books = set()

    tasks = []
    for root, _, files in os.walk(input_folder):
        for file in files:
            if not file.endswith(".md"):
                continue

            book_name = os.path.splitext(file)[0]
            if book_name in processed_books:
                continue

            book_md_path = os.path.join(root, file)
            book_json_path = os.path.join(root, book_name + ".json")

            if not os.path.exists(book_json_path):
                continue

            tasks.append((book_md_path, book_json_path))

    total_tasks = len(tasks)
    if total_tasks == 0:
        print("✅ No new books to process.")
        return

    cpu_cores = multiprocessing.cpu_count()
    max_workers = min(32, cpu_cores * 2)
    print(f"🔄 Processing {total_tasks} books using {max_workers} threads...\n")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_book, md, js, output_folder, encoder_config)
            for md, js in tasks
        ]

        for future in as_completed(futures):
            book_name = future.result()
            processed_books.add(book_name)

    with open(processed_books_path, "w", encoding="utf-8") as f:
        json.dump(list(processed_books), f, ensure_ascii=False, indent=2)

    print("\n✅ All books processed.")


# Usage
if __name__ == "__main__":
    root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_folder = os.path.join(root_folder, "raw_books", "العقيدة")
    output_folder = os.path.join(root_folder, "chunked_books", "العقيدة")
    semantic_chunk_books(input_folder, output_folder)
