import os
import json
import logging
import time
from tqdm import tqdm
from dotenv import load_dotenv
from utils import get_multimodal_embeddings, convert_to_milvus_sparse_format

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

def get_embeddings_with_retry(batch, retries=3, delay=5):
    for attempt in range(retries):
        try:
            return get_multimodal_embeddings(batch, sparse=True)
        except Exception as e:
            if attempt < retries - 1:
                logging.warning("Retry %d/%d for batch failed. Retrying in %ds...", attempt + 1, retries, delay)
                time.sleep(delay)
            else:
                logging.error("❌ Failed to embed batch after %d attempts: %s", retries, str(e))
                raise e

def embed_books(input_folder, output_folder, batch_size=8):
    processed_books_path = os.path.join(output_folder, "processed_books.json")
    if os.path.exists(processed_books_path):
        with open(processed_books_path, "r", encoding="utf-8") as f:
            processed_books = set(json.load(f))
    else:
        processed_books = set()
    error_books_path = os.path.join(output_folder, "error_books.json")
    if os.path.exists(error_books_path):
        with open(error_books_path, "r", encoding="utf-8") as f:
            error_books = set(json.load(f))
    else:
        error_books = set()
    logging.info("Scanning books in %s", input_folder)

    for root, _, files in os.walk(input_folder):
        for file in tqdm(files, desc="Processing books"):
            if os.path.basename(file) == "processed_books.json":
                continue

            book_name = os.path.splitext(file)[0]
            if book_name in processed_books:
                logging.debug("Skipping already processed book: %s", book_name)
                continue

            book_json_path = os.path.join(root, book_name + ".json")
            logging.info("Embedding book: %s", book_name)

            with open(book_json_path, 'r', encoding='utf-8') as f:
                book_data = json.load(f)

            all_embeddings = []
            for i in range(0, len(book_data), batch_size):
                chunk_batch = book_data[i:i+batch_size]
                chunk_texts = [chunk["text"] for chunk in chunk_batch]

                try:
                    embeddings = get_embeddings_with_retry(chunk_texts)
                    dense_vectors = embeddings["embeddings"]
                    sparse_vectors = convert_to_milvus_sparse_format(embeddings["sparse"])

                    all_embeddings.extend([
                        {"dense_vector": dense, "sparse_vector": sparse}
                        for dense, sparse in zip(dense_vectors, sparse_vectors)
                    ])
                except Exception as e:
                    logging.error("⚠ Skipping book %d–%d due to persistent failure.", book_name)
                    error_books.add(book_name)
                    with open(error_books_path, 'w', encoding= 'utf-8') as fp:
                        json.dump(list(error_books), fp, ensure_ascii=False, indent = 2)
                    break

            if len(all_embeddings) != len(book_data):
                logging.warning("⚠ Embedding mismatch: got %d embeddings for %d chunks. Skipping book: %s",
                                len(all_embeddings), len(book_data), book_name)
                continue

            for i, chunk in enumerate(book_data):
                book_data[i] = {**chunk, **all_embeddings[i]}
                
                book_data[i] = {
                    "id": book_data[i]["id"],
                    "book_id": book_data[i]["book_id"],
                    "book_name": book_data[i]["book_name"],
                    "order": book_data[i]["order"],
                    "author": book_data[i]["author"],
                    "knowledge": book_data[i]["knowledge"],
                    "category": book_data[i]["category"],
                    "header_titles": book_data[i]["header_titles"],
                    "page_range": book_data[i]["page_range"],
                    "text": book_data[i]["text"],
                    "dense_vector": book_data[i]["dense_vector"],
                    "sparse_vector": book_data[i]["sparse_vector"],
                }

            knowledge = book_data[0]["knowledge"]
            category = book_data[0]["category"]
            output_path = (
                os.path.join(output_folder, knowledge, category, f"{book_name}.jsonl")
                if knowledge != category else
                os.path.join(output_folder, knowledge, f"{book_name}.jsonl")
            )

            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            logging.info("Saving embedded book to %s", output_path)
            with open(output_path, 'w', encoding='utf-8') as f:
                for chunk in book_data:
                    json_line = json.dumps(chunk, ensure_ascii=False)
                    f.write(json_line + "\n")

            processed_books.add(book_name)
            with open(processed_books_path, 'w', encoding='utf-8') as f:
                json.dump(list(processed_books), f, ensure_ascii=False, indent = 2)
            if book_name in error_books:
                error_books.remove(book_name)
            with open(error_books_path, 'w', encoding= 'utf-8') as fp:
                json.dump(list(error_books), fp, ensure_ascii=False, indent = 2)

    logging.info("Embedding process complete. Total books processed: %d", len(processed_books))



if __name__ == "__main__":
    input_folder = os.path.join(os.getenv("ROOT_FOLDER"), "books", "chunked_books_with_ranges")
    output_folder = os.path.join(os.getenv("ROOT_FOLDER"), "books", "embedded_books")  
    embed_books(input_folder, output_folder)
