import logging
from pathlib import Path
from pymilvus import (
    MilvusClient,
)
from dotenv import load_dotenv
import os
from dotenv import load_dotenv
import json
from utils import *

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
MAX_TEXT_LENGTH = 65535
FAILED_BOOKS_PATH = "failed_books.json"

def upsert_books(
    main_directory,
    collection_name="islamic_library",
    partition_name="_default",
    batch_size=12000,
):
    def ensure_partition_exists():
        existing_partitions = set(client.list_partitions(collection_name))
        if partition_name not in existing_partitions:
            client.create_partition(
                collection_name=collection_name,
                partition_name=partition_name
            )

    def stream_jsonl(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    record = json.loads(line)
                    if "text" in record and isinstance(record["text"], str):
                        record["text"] = record["text"][:MAX_TEXT_LENGTH]
                    yield record

    def upsert_batch(batch_data):
        client.upsert(
            collection_name=collection_name,
            partition_name=partition_name,
            data=batch_data,
        )

    def load_failed_books():
        try:
            with open(FAILED_BOOKS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    def save_failed_book(book_path):
        failed = load_failed_books()
        failed.append(str(book_path))
        with open(FAILED_BOOKS_PATH, "w", encoding="utf-8") as f:
            json.dump(failed, f, indent=2, ensure_ascii=False)

    if not client.has_collection(collection_name=collection_name):
        create_library_collection(client=client, collection_name=collection_name)

    ensure_partition_exists()

    jsonl_files = list(Path(main_directory).rglob("*.jsonl"))
    if not jsonl_files:
        logging.warning("No .jsonl files found.")
        return False

    for file_idx, file_path in enumerate(jsonl_files, start=1):
        logging.info(f"[{file_idx}/{len(jsonl_files)}] Processing: {file_path}")
        batch = []
        count = 0
        try:
            for record in stream_jsonl(file_path):
                batch.append(record)
                if len(batch) >= batch_size:
                    upsert_batch(batch)
                    count += len(batch)
                    logging.info(f"Upserted {count} records so far from {file_path.name}")
                    batch = []

            if batch:
                upsert_batch(batch)
                logging.info(f"Final batch upserted from {file_path.name} ({len(batch)} records)")

        except Exception as e:
            logging.error(f"Error while processing {file_path}: {e}")
            save_failed_book(file_path)
            continue  # skip to next file

    logging.info("All data upserted successfully (excluding failed books).")
    return True

if __name__ == "__main__":
    logging.info("Connecting to Milvus Database...")
    client = MilvusClient(
        uri=f"http://{os.getenv("MILVUS_IP")}:19530", token=os.getenv("MILVUS_TOKEN")
    )
    logging.info("Successfully Connected to Milvus!")
    
    root_folder = os.getenv("ROOT_FOLDER")
    main_folder = os.path.join(root_folder, "books", "embedded_books")
    upsert_books(
        main_folder,
        partition_name="_iqeedah"
    )

