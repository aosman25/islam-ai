import os
import httpx
from fastapi import FastAPI, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from utils import convert_to_milvus_sparse_format
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

class EmbeddingRequest(BaseModel):
    input_text: List[str]
    dense: bool = True
    sparse: bool = False
    colbert: bool = False

class EmbeddingResponseModel(BaseModel):
    dense: list[list[float]]
    sparse: Optional[list[dict[int, float]]] = None
    colbert: Optional[list[list[float]]] = None

@app.post('/embed', response_model=EmbeddingResponseModel)
async def get_embedding(request: EmbeddingRequest) -> EmbeddingResponseModel:
    api_key = os.getenv("DEEPINFRA_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API key not configured.")

    url = "https://api.deepinfra.com/v1/inference/BAAI/bge-m3-multi"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "inputs": request.input_text,
        "dense": request.dense,
        "sparse": request.sparse,
        "colbert": request.colbert
    }

    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
        except httpx.ReadTimeout:
            raise HTTPException(status_code=504, detail="DeepInfra request timed out.")

    if response.status_code == 200:
        raw_response = response.json()
        return EmbeddingResponseModel(
            dense=raw_response.get("embeddings", []),
            sparse=convert_to_milvus_sparse_format(raw_response.get("sparse", [])),
            colbert=raw_response.get("colbert", [])
        )
    else:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"DeepInfra request failed: {response.text}"
        )
