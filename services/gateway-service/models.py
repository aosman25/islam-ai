from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Literal, Union


class GatewayRequest(BaseModel):
    """Request model for the gateway service"""

    query: str = Field(..., min_length=1, max_length=1000, description="User query")
    top_k: int = Field(
        default=15, gt=0, le=100, description="Number of search results to retrieve"
    )
    temperature: float = Field(
        default=0.2, ge=0.0, le=2.0, description="Temperature for response generation"
    )
    max_tokens: int = Field(
        default=8000, gt=0, le=65536, description="Maximum tokens in response"
    )
    stream: bool = Field(default=False, description="Enable streaming response")
    reranker: Literal["RRF", "Weighted"] = Field(
        default="Weighted",
        description="Reranking strategy: 'RRF' (Reciprocal Rank Fusion) or 'Weighted'"
    )
    reranker_params: List[Union[int, float]] = Field(
        default=[1.0, 1.0],
        description="Reranker parameters. RRF: single int in (0, 16384]. Weighted: two floats in [0, 1]",
        examples=[[60], [0.5, 0.5]]
    )

    @model_validator(mode="after")
    def validate_reranker_params(self):
        """Validate reranker parameters based on reranker type"""
        if self.reranker == "RRF":
            if not (
                len(self.reranker_params) == 1
                and isinstance(self.reranker_params[0], (int, float))
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
        return self


class SourceData(BaseModel):
    """Source data from search results"""

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


class GatewayResponse(BaseModel):
    """Response model for the gateway service (non-streaming)"""

    response: str
    sources: List[SourceData]
    optimized_query: str
    subqueries: Optional[List[str]] = Field(
        default=[], description="Generated subqueries for the original query"
    )
    request_id: str


class StreamMetadataChunk(BaseModel):
    """
    First chunk in streaming response containing metadata.

    When stream=true, the response is newline-delimited JSON (NDJSON).
    This is the first chunk sent, containing sources, optimized query, and subqueries.
    """

    type: Literal["metadata"] = "metadata"
    sources: List[SourceData] = Field(description="Retrieved source documents")
    optimized_query: str = Field(description="Query after optimization")
    subqueries: Optional[List[str]] = Field(
        default=[], description="Generated subqueries for the original query"
    )
    request_id: str = Field(description="Unique request identifier")


class StreamContentChunk(BaseModel):
    """
    Content chunk in streaming response.

    Multiple chunks of this type are sent during streaming,
    each containing a delta (piece) of the generated text.
    """

    type: Literal["content"] = "content"
    delta: str = Field(description="Incremental text chunk")


class StreamDoneChunk(BaseModel):
    """
    Final chunk in streaming response indicating completion.
    """

    type: Literal["done"] = "done"


class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    """Error response"""

    error: str
    request_id: str
    timestamp: str
