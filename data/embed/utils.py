import requests
from dotenv import load_dotenv
import os

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