from typing import List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator


MAX_SEARCH_K = 100
MAX_EMBEDDINGS_PER_REQUEST = 10


class DenseVectorParams(BaseModel):
    n_probe: int = 10


class SparseVectorParams(BaseModel):
    drop_ratio_search: float = 0.2


class EmbeddingObject(BaseModel):
    dense: Optional[List[float]] = None
    sparse: Optional[dict[int, float]] = None
    dense_params: DenseVectorParams = Field(default_factory=DenseVectorParams)
    sparse_params: SparseVectorParams = Field(default_factory=SparseVectorParams)

    @model_validator(mode="after")
    def validate_at_least_one_vector(self):
        if self.dense is None and self.sparse is None:
            raise ValueError("At least one of 'dense' or 'sparse' must be provided")
        return self


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
    filter: str = Field(default="", description="Milvus filter expression")
    output_fields: List[str] = [
        "id",
        "book_id",
        "book_name",
        "order",
        "author",
        "category",
        "part_title",
        "start_page_id",
        "page_offset",
        "page_num_range",
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
                "category",
                "part_title",
                "start_page_id",
                "page_offset",
                "page_num_range",
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
    id: int
    book_id: int
    book_name: str
    order: int
    author: str
    category: str
    part_title: str
    start_page_id: int
    page_offset: int
    page_num_range: List[int]
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
