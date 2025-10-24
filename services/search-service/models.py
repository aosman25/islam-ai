from typing import List, Literal, Union
from pydantic import BaseModel, Field, model_validator


MAX_SEARCH_K = 100
MAX_EMBEDDINGS_PER_REQUEST = 10


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
    k: int = Field(default=15, gt=0, le=MAX_SEARCH_K)
    embeddings: List[EmbeddingObject] = Field(
        ..., min_items=1, max_items=MAX_EMBEDDINGS_PER_REQUEST
    )
    reranker: Literal["RRF", "Weighted"] = Field(
        default="Weighted",
        description="Reranking strategy: 'RRF' (Reciprocal Rank Fusion) or 'Weighted'"
    )
    reranker_params: List[Union[int, float]] = Field(
        default=[1.0, 1.0],
        description="Reranker parameters. RRF: single int in (0, 16384]. Weighted: two floats in [0, 1]",
        examples=[[60], [0.5, 0.5]]
    )
    collection_name: str = "islamic_library"
    partition_names: List[str] = []
    output_fields: List[str] = [
        "id",
        "book_id",
        "book_name",
        "order",
        "author",
        "knowledge",
        "category",
        "header_titles",
        "page_range",
        "text",
    ]

    @model_validator(mode="after")
    def validate_reranker_params(self):
        if self.reranker == "RRF":
            if not (
                len(self.reranker_params) == 1
                and isinstance(self.reranker_params[0], int)
                and 0 < self.reranker_params[0] <= 16384
            ):
                raise ValueError(
                    "RRF requires a single integer parameter in the range (0, 16384]"
                )
        elif self.reranker == "Weighted":
            if not (
                len(self.reranker_params) == 2
                and all(
                    isinstance(p, (int, float)) and 0.0 <= p <= 1.0
                    for p in self.reranker_params
                )
            ):
                raise ValueError(
                    "Weighted requires two float parameters in the range [0, 1]"
                )
        else:
            raise ValueError("The reranker must be either 'RRF' or 'Weighted'")

        # Partition validation is now done dynamically in the search endpoint
        # to allow fetching available partitions from Milvus at runtime

        available_fields = set(
            [
                "id",
                "book_id",
                "book_name",
                "order",
                "author",
                "knowledge",
                "category",
                "header_titles",
                "page_range",
                "text",
            ]
        )
        for f in self.output_fields:
            if f not in available_fields:
                raise ValueError(
                    f"The output fields must be within list: {', '.join(list(available_fields))}"
                )

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


class SearchBatchResponse(BaseModel):
    results: List[SearchResponse]
    processed_count: int
    request_id: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class PartitionsResponse(BaseModel):
    collection_name: str
    partitions: List[str]
    count: int
    timestamp: str


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str
