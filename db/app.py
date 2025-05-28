from pymilvus import (
    MilvusClient,
    DataType,
    model,
)
from dotenv import load_dotenv
import os
import math
from db.utils import read_json_files
import json
from modules.encoders import DeepInfraEncoder
from dotenv import load_dotenv
load_dotenv()

# Load Environment Variables
load_dotenv()

# Step 1: Connect to Milvus
print("Connecting to Milvus Database...")
client = MilvusClient(
    uri=f"http://{os.getenv("MILVUS_IP")}:19530", token=os.getenv("MILVUS_TOKEN")
)

print("Successfully Connected to Milvus!")


def create_library_schema():
    schema = MilvusClient.create_schema(auto_id=False, enable_dyanmic_field=True)
    schema.add_field(
        field_name="id", datatype=DataType.VARCHAR, is_primary=True, max_length=50
    )
    schema.add_field(
        field_name="dense_vector", datatype=DataType.FLOAT_VECTOR, dim=1024
    )
    schema.add_field(
        field_name="sparse_vector",
        datatype=DataType.SPARSE_FLOAT_VECTOR,
    )
    schema.add_field(field_name="text", datatype=DataType.VARCHAR, max_length=65535)
    schema.add_field(field_name="book_name", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="knowledge", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="category", datatype=DataType.VARCHAR, max_length=500)
    schema.add_field(field_name="author", datatype=DataType.VARCHAR, max_length=500)
    return schema


def create_library_index_params():
    index_params = client.prepare_index_params()
    index_params.add_index(field_name="id", index_type="Trie")
    index_params.add_index(field_name="text", index_type="Trie")
    index_params.add_index(
        field_name="dense_vector",
        index_name="dense_index",
        index_type="FLAT",
        metric_type="COSINE",
    )
    index_params.add_index(
        field_name="sparse_vector",
        index_name="sparse_index",
        index_type="SPARSE_INVERTED_INDEX",  # Index type for sparse vectors
        metric_type="IP",  # Currently, only IP (Inner Product) is supported for sparse vectors
        params={
            "drop_ratio_build": 0.2
        },  # The ratio of small vector values to be dropped during indexing
    )

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


def embed_chunks(folder_path, batch_size=300, deepinfra=True):
    print("Connecting to DeepInfra Embedding model...")
    if deepinfra:
        deepinfra_ef = DeepInfraEncoder(deepinfra_api_key=os.getenv("DEEPINFRA_API_KEY"))
    else:
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
    root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root_folder,"db","books_progress.json"), "r", encoding="utf-8") as file:
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
            embeddings = deepinfra_ef(documents) if deepinfra else openai_ef.encode_documents(documents) 

            print(
                f"Successfully processed batch {curr_batch + 1} out of {batches_count} batches in book {processed + 1}!"
            )

            for j, embedding in zip(range(i, i + batch_size), embeddings):
                if j == len(
                    book_data
                ):  # Check to ensure you don't exceed the book data length
                    break
                if deepinfra:
                    book_data[j]["dense_vector"] = embedding
                else:
                    book_data[j]["dense_vector"] = embedding.tolist()

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
        with open(os.path.join(root_folder,"db","books_progress.json"), "w", encoding="utf-8") as file:
            json.dump(books_progress, file, ensure_ascii=False, indent=4)

        print(f"Successfully processed book {processed + 1} out of {len(books)} books!")
        processed += 1

    print(f"Successfully embedded {len(books)} books!")


def upsert_entities(
    main_directory,
    collection_name="islamic_library",
    partition_name="_default",
    hybrid=False,
):
    main_folder_path = main_directory
    folder_path_list = [
        main_directory + '/'  + name
        for name in os.listdir(main_folder_path)
        if os.path.isdir(os.path.join(main_folder_path, name))
    ] or [main_directory]
    batch_size = 12000
    if partition_name not in set(
        client.list_partitions(collection_name=collection_name)
    ):
        client.create_partition(
            collection_name=collection_name, partition_name=partition_name
        )
    for folder_path in folder_path_list:
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
                if not hybrid:
                    client.upsert(
                        collection_name=collection_name,
                        partition_name=partition_name,
                        data=batch_data,
                    )
                else:
                    client.upsert(
                        collection_name=collection_name,
                        partition_name=partition_name,
                        data=[
                            {
                                **chunk,
                                "sparse_vector": generate_sparse_vector(chunk["dense_vector"])
                            }
                            for chunk in batch_data
                        ],
                    )
            print(
                f"Successfully upserted the data of book {i + 1} out of {len(books)}!"
            )
    return True


def embed_query(queries, deepinfra = True):
    if deepinfra:
        deepinfra_ef = DeepInfraEncoder(deepinfra_api_key=os.getenv("DEEPINFRA_API_KEY"))
    else:
        openai_ef = model.dense.OpenAIEmbeddingFunction(
            model_name="text-embedding-3-small",  # Specify the model name
            api_key=os.getenv("OPEN_AI_API_KEY"),  # Provide your OpenAI API key
            dimensions=1536,  # Set the embedding dimensionality
        )
        print("Successfully Connected to OpenAI Embedding model!")

    query_embeddings = deepinfra_ef(queries) if deepinfra else openai_ef.encode_queries(queries)
    return query_embeddings


def generate_sparse_vector(dense_vector):
    return {key: value for key, value in enumerate(dense_vector) if value > 0}


# New Version of RAG
def add_sparse_vectors_to_books(main_directory):
    root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Set the root folder
    main_folder_path = os.path.join(root_folder, main_directory)

    folder_path_list = [
        main_directory + "/" + name
        for name in os.listdir(main_folder_path)
        if os.path.isdir(os.path.join(main_folder_path, name))
    ] or [main_directory]

    for folder_path in folder_path_list:
        print("Reading Data from json files...")
        books = read_json_files(folder_path)
        for i in range(len(books)):
            new_data = []
            book_data, book_path = books[i]
            print(f"Processing Book {i + 1} out of {len(books)} books...")
            print(f"Generating Sparse Vectors for Book {i + 1} out of {len(books)}...")
            texts = set()

            for chunk in book_data:
                if len((chunk["text"]).split(" ")) >= 50 and chunk["text"] not in texts:
                    new_data.append(
                        {
                            "text": chunk["text"],
                            "book_name": chunk["book_name"],
                            "knowledge": chunk["knowledge"],
                            "id": chunk["id"],
                            "category": chunk["category"],
                            "author": chunk["author"],
                            "dense_vector": chunk["vector"],
                            "sparse_vector": generate_sparse_vector(chunk["vector"]),
                        }
                    )
                    texts.add(chunk["text"])
            # Your file path
            file_path = "hybrid_embedded_chunked_data/" + "/".join(
                book_path.split("/")[1:]
            )

            # Extract the directory from the file path
            directory = os.path.dirname(file_path)

            # Create the directory if it doesn't exist
            os.makedirs(directory, exist_ok=True)

            with open(
                file_path,
                "w",
                encoding="utf-8",
            ) as file:
                json.dump(new_data, file, ensure_ascii=False, indent=4)
    return True


root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_folder = os.path.join(root_folder,"db","chunked_data", "العقيدة")

print(embed_query(["ما موقف السلف من آيات الصفات مثل: {الرحمن على العرش استوى}؟"]))

