from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from typing import List, Literal, Union
from pydantic import BaseModel, model_validator
from pymilvus import MilvusClient, RRFRanker, WeightedRanker, AnnSearchRequest
import asyncio
import os

load_dotenv()

class DenseVectorParams(BaseModel):
    n_probe: int = 10

class SparseVectorParams(BaseModel):
    drop_ratio_search: float = 0.2

class EmbeddingObject(BaseModel):
    dense: List[float]
    sparse: dict[int, float]
    dense_params: DenseVectorParams
    sparse_params: SparseVectorParams

class SearchRequest(BaseModel):
    k: int = 15
    embeddings: List[EmbeddingObject]
    reranker: Literal["RRF", "Weighted"] = "Weighted"
    reranker_params: List[Union[int, float]] = [1,1]
    collection_name: str = "islamic_library"
    partition_names: List[str] = []
    output_fields: List[str] = ["id", "book_id", "book_name", "order", "author","knowledge", "category", "header_titles", "page_range", "text"]

    @model_validator(mode="after")
    def validate_reranker_params(self):
        if self.k <= 0:
            raise ValueError("K must be strictly greater than 0.")
        if self.reranker == "RRF":
            if not (
                len(self.reranker_params) == 1
                and isinstance(self.reranker_params[0], int)
                and 0 < self.reranker_params[0] < 16384
            ):
                raise ValueError("RRF requires a single integer parameter in the range (0, 16384)")
        elif self.reranker == "Weighted":
            if not (
                len(self.reranker_params) == 2
                and all(isinstance(p, (int, float)) and 0.0 <= p <= 1.0 for p in self.reranker_params)
            ):
                raise ValueError("Weighted requires two float parameters in the range [0, 1]")
        else:
            raise ValueError("The reranker must be either 'RRF' or 'Weighted'")
        
        available_partitions = set(["_default","_iqeedah"])
        for p in self.partition_names:
            if p not in available_partitions:
                raise ValueError(f"The partition names must be within list: {', '.join(list(available_partitions))}")
        
        available_fields = set(["id", "book_id", "book_name", "order", "author","knowledge", "category", "header_titles", "page_range", "text"])
        for f in self.output_fields:
            if f not in available_fields:
                raise ValueError(f"The output fields must be within list: {', '.join(list(available_fields))}")

        return self

class SearchResponse(BaseModel):
    distance: float
    id: str
    book_id: str
    book_name: str
    order: int
    author: str
    knowledge: str
    category: str
    header_titles: List[str]
    page_range: List[int]
    text: str

app = FastAPI()

client = MilvusClient(
    uri=f"http://{os.getenv('MILVUS_IP_ADDRESS')}:19530", 
    token=os.getenv("MILVUS_TOKEN")
)

async def process_embedding(request: SearchRequest, embed: EmbeddingObject, reranker, k: int):
    search_param_1 = {
        "data": [embed.dense],
        "anns_field": "dense_vector",
        "param": embed.dense_params.model_dump(),
        "limit": k
    }
    search_param_2 = {
        "data": [embed.sparse],
        "anns_field": "sparse_vector",
        "param": embed.sparse_params.model_dump(),
        "limit": k
    }

    reqs = [
        AnnSearchRequest(**search_param_1),
        AnnSearchRequest(**search_param_2)
    ]

    def hybrid_search_thread():
        return client.hybrid_search(
            collection_name=request.collection_name,
            reqs=reqs,
            ranker=reranker,
            output_fields=request.output_fields,
            limit=k,
            partition_names=request.partition_names
        )

    results = await asyncio.to_thread(hybrid_search_thread)

    hits = []
    for hs in results:
        for h in hs:
            hits.append({"distance": h["distance"], **h["entity"]})
    return hits

@app.post("/search/", response_model=List[SearchResponse])
async def search(request: SearchRequest):
    try:
        # Prepare reranker once
        if request.reranker == "RRF":
            ranker = RRFRanker(*request.reranker_params)
        else:
            ranker = WeightedRanker(*request.reranker_params)

        # Parallel processing of all embeddings
        tasks = [
            process_embedding(request, embed, ranker, request.k)
            for embed in request.embeddings
        ]
        all_results = await asyncio.gather(*tasks)

        # Flatten list of lists
        flat_hits = [item for sublist in all_results for item in sublist]
        return flat_hits

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
