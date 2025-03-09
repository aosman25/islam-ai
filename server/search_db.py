from pymilvus import (
    MilvusClient,
    model,
    AnnSearchRequest,
    WeightedRanker,
)
from dotenv import load_dotenv
import os


# Load Environment Variables
load_dotenv()

# Connect to Milvus
print("Connecting to Milvus Database...")
client = MilvusClient(
    uri=f"http://{os.getenv("MILVUS_IP")}:19530", token=os.getenv("MILVUS_TOKEN")
)


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


def hybrid_search(
    query,
    collection_name="islamic_library",
    limit=15,
    dense_weight=0.5,
    sparse_weight=0.5,
    partitions=[],
):
    ranker = WeightedRanker(dense_weight, sparse_weight)
    dense_vector = embed_query([query])[0].tolist()
    sparse_vector = {key: value for key, value in enumerate(dense_vector) if value > 0}

    req1 = AnnSearchRequest(
        **{
            "data": [dense_vector],
            "anns_field": "dense_vector",
            "param": {"metric_type": "COSINE"},
            "limit": limit,
        }
    )
    req2 = AnnSearchRequest(
        **{
            "data": [sparse_vector],
            "anns_field": "sparse_vector",
            "param": {"metric_type": "IP", "params": {"drop_ratio_build": 0.2}},
            "limit": limit,
        }
    )
    reqs = [req1, req2]

    res = client.hybrid_search(
        collection_name=collection_name,
        reqs=reqs,
        ranker=ranker,
        limit=limit,
        partition_names=partitions,
    )

    return res
