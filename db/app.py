from pymilvus import MilvusClient, DataType, model
from dotenv import load_dotenv
import os
import math
from utils import read_json_files
import json
import numpy as np


# Load Environment Variables
load_dotenv()

# Step 1: Connect to Milvus
print("Connecting to Milvus Database...")

client = MilvusClient(uri="http://34.29.168.152:19530", token=os.getenv("MILVUS_TOKEN"))

print("Successfully Connected to Milvus!")


def create_library_schema():
    schema = MilvusClient.create_schema(auto_id=False, enable_dyanmic_field=True)
    schema.add_field(
        field_name="id", datatype=DataType.VARCHAR, is_primary=True, max_length=50
    )
    schema.add_field(field_name="vector", datatype=DataType.FLOAT_VECTOR, dim=1536)
    schema.add_field(field_name="text", datatype=DataType.VARCHAR, max_length=10000)
    schema.add_field(field_name="book_name", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="knowledge", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="category", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="author", datatype=DataType.VARCHAR, max_length=500)
    return schema


def create_library_index_params():
    index_params = client.prepare_index_params()
    index_params.add_index(field_name="id", index_type="Trie")
    index_params.add_index(field_name="text", index_type="Trie")
    index_params.add_index(field_name="vector", index_type="FLAT", metric_type="COSINE")
    index_params.add_index(field_name="book_name", index_type="INVERTED")
    index_params.add_index(field_name="knowledge", index_type="INVERTED")
    index_params.add_index(field_name="category", index_type="INVERTED")
    index_params.add_index(field_name="author", index_type="INVERTED")

    return index_params


def create_library_collection():
    if not client.has_collection(collection_name="islamic_library"):
        print("Creating Islamic Library Collection...")
        client.create_collection(
            collection_name="islamic_library",
            schema=create_library_schema(),
            index_params=create_library_index_params(),
        )
        print("Successfully Created Islamic Library Collection!")
    else:
        print("Collection Already Exisits")


def embed_chunks(folder_path, batch_size=300):
    print("Connecting to OpenAI Embedding model...")
    openai_ef = model.dense.OpenAIEmbeddingFunction(
        model_name="text-embedding-3-small",  # Specify the model name
        api_key=os.getenv("OPEN_AI_API_KEY"),  # Provide your OpenAI API key
        dimensions=1536,  # Set the embedding dimensionality
    )
    print("Successfully Connected to OpenAI Embedding model!")

    processed = 0
    total_batches = 0  # Counter for total processed batches across all books
    print("Reading Data from json files....")
    books = read_json_files(folder_path, skip=True)
    with open("books_progress.json", "r", encoding="utf-8") as file:
        books_progress = json.load(file)
    print(f"Processing {len(books)} books ...")
    for book_data, book_path in books:
        curr_batch = books_progress.get(book_data[0]["book_name"], 0)
        if curr_batch == -1:
            print(f"Skipping book {processed + 1}...")
            processed += 1
            continue
        books_progress[book_data[0]["book_name"]] = curr_batch
        print(f"Processing book {processed + 1} out of {len(books)} books...")
        batches_count = math.ceil(len(book_data) / batch_size)
        save_interval = max(batches_count // 10, 10)
        for i in range(curr_batch * batch_size, len(book_data), batch_size):
            print(
                f"Processing batch {curr_batch + 1} out of {batches_count} batches in book {processed + 1}..."
            )
            book_chunk = book_data[i : (i + batch_size)]
            documents = []
            for datum in book_chunk:
                documents.append(datum["text"])
            embeddings = openai_ef.encode_documents(documents)

            print(
                f"Successfully processed batch {curr_batch + 1} out of {batches_count} batches in book {processed + 1}!"
            )

            for j, embedding in zip(range(i, i + batch_size), embeddings):
                if j == len(
                    book_data
                ):  # Check to ensure you don't exceed the book data length
                    break
                book_data[j]["vector"] = embedding.tolist()

            # Increment the batch counters
            curr_batch += 1
            total_batches += 1
            books_progress[book_data[0]["book_name"]] = curr_batch
            if curr_batch % save_interval == 0:
                print(f"Saving data of book {processed + 1}...")
                with open(book_path, "w", encoding="utf-8") as file:
                    json.dump(book_data, file, ensure_ascii=False, indent=4)
                with open("books_progress.json", "w", encoding="utf-8") as file:
                    json.dump(books_progress, file, ensure_ascii=False, indent=4)

        books_progress[book_data[0]["book_name"]] = -1

        with open(book_path, "w", encoding="utf-8") as file:
            json.dump(book_data, file, ensure_ascii=False, indent=4)
        with open("books_progress.json", "w", encoding="utf-8") as file:
            json.dump(books_progress, file, ensure_ascii=False, indent=4)

        print(f"Successfully processed book {processed + 1} out of {len(books)} books!")
        processed += 1

    print(f"Successfully embedded {len(books)} books!")


def upsert_entities(
    folder_path, collection_name="islamic_library", partition_name="_default"
):
    batch_size = 17000
    if partition_name not in set(
        client.list_partitions(collection_name=collection_name)
    ):
        client.create_partition(
            collection_name=collection_name, partition_name=partition_name
        )
    print("Reading Data from json files...")
    books = read_json_files(folder_path)
    for i in range(len(books)):
        book_data, _ = books[i]
        print(f"Upserting the data of book {i + 1} out of {len(books)} books...")
        for j in range(0, len(book_data), batch_size):
            print(
                f"Processing batch {(j // batch_size) + 1} out of {math.ceil(len(book_data) / batch_size)} batches in book {i + 1}..."
            )
            batch_data = book_data[j : (j + batch_size)]
            client.upsert(
                collection_name=collection_name,
                partition_name=partition_name,
                data=batch_data,
            )
        print(f"Successfully upserted the data of book {i + 1} out of {len(books)}!")


def embed_query(queries):
    print("Connecting to OpenAI Embedding model...")
    openai_ef = model.dense.OpenAIEmbeddingFunction(
        model_name="text-embedding-3-small",  # Specify the model name
        api_key=os.getenv("OPEN_AI_API_KEY"),  # Provide your OpenAI API key
        dimensions=1536,  # Set the embedding dimensionality
    )
    print("Successfully Connected to OpenAI Embedding model!")
    query_embeddings = openai_ef.encode_queries(queries)
    return query_embeddings
