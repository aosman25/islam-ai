import os
import json
import requests
from pathlib import Path
from datetime import datetime
from typing import Union, List
from dotenv import load_dotenv

load_dotenv()

def convert_to_milvus_sparse_format(sparse_vectors):
    milvus_sparse_vectors = []
    for vector in sparse_vectors:
        sparse_dict = {i: val for i, val in enumerate(vector) if val != 0.0}
        milvus_sparse_vectors.append(sparse_dict)
    return milvus_sparse_vectors


def get_multimodal_embeddings(
    input_text,
    dense=True,
    sparse=False,
    colbert=False,
    api_key=os.getenv("DEEPINFRA_API_KEY")
):
    url = "https://api.deepinfra.com/v1/inference/BAAI/bge-m3-multi"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "inputs": input_text,
        "dense": dense,
        "sparse": sparse,
        "colbert": colbert
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 200:
        return response.json()
    else:
        raise RuntimeError(
            f"Request failed with status {response.status_code}: {response.text}"
        )


def save_embedding_to_json(
    query: Union[str, List[str]],
    output_dir: str = "embeddings",
    dense=True,
    sparse=False,
    colbert=False
):
    os.makedirs(output_dir, exist_ok=True)

    result = get_multimodal_embeddings(query, dense=dense, sparse=sparse, colbert=colbert)

    if sparse and "sparse" in result:
        result["sparse_embeddings"] = convert_to_milvus_sparse_format(result["sparse"])

    # Save each query to its own file
    queries = query if isinstance(query, list) else [query]
    for i, q in enumerate(queries):
        entry = {
            "query": q,
            "dense_embedding": result["embeddings"][i] if dense else None,
            "sparse_embedding": result["sparse_embeddings"][i] if sparse else None,
            "colbert_embedding": result["colbert"][i] if colbert else None,
        }
        # Create a unique file name
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        sanitized = q.replace(" ", "_")[:50].replace("/", "_")
        file_name = f"{timestamp}_{sanitized}.json"
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(entry, f, ensure_ascii=False, indent=2)

        print(f"Saved embedding to {file_path}")


if __name__ == "__main__":
    root_folder = os.getenv("ROOT_FOLDER")
    output_dir = os.path.join(root_folder, "embeddings")
    save_embedding_to_json(
        ["هل المكان من جملة المخلوقات التي خلقها الله؟"], output_dir=output_dir, sparse=True)