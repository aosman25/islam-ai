from pydantic import BaseModel, Field
from typing import List, Optional


class GatewayRequest(BaseModel):
    """Request model for the gateway service"""

    query: str = Field(..., min_length=1, max_length=1000, description="User query")
    top_k: int = Field(
        default=15, gt=0, le=100, description="Number of search results to retrieve"
    )
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Temperature for response generation"
    )
    max_tokens: int = Field(
        default=20000, gt=0, le=65536, description="Maximum tokens in response"
    )
    stream: bool = Field(
        default=False, description="Enable streaming response"
    )


class SourceData(BaseModel):
    """Source data from search results"""

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


class GatewayResponse(BaseModel):
    """Response model for the gateway service (non-streaming)"""

    response: str
    sources: List[SourceData]
    optimized_query: str
    request_id: str


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
