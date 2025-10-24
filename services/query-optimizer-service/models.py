from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


MAX_QUERY_LENGTH = 1000


class OptimizedQueryResponse(BaseModel):
    optimized_query: str = Field(..., min_length=1, max_length=1000)
    sub_queries: Optional[List[str]] = Field(None, max_items=5)


class QueryRequest(BaseModel):
    queries: List[str] = Field(
        ..., min_items=1, max_items=10
    )

    @field_validator("queries")
    @classmethod
    def validate_queries(cls, v):
        # Filter out empty queries and validate length
        valid_queries = []
        for query in v:
            if query.strip():
                if len(query) > MAX_QUERY_LENGTH:
                    raise ValueError(
                        f"Query exceeds maximum length of {MAX_QUERY_LENGTH} characters"
                    )
                valid_queries.append(query.strip())

        if not valid_queries:
            raise ValueError("At least one non-empty query is required")
        return valid_queries


class QueryResponse(BaseModel):
    results: List[OptimizedQueryResponse]
    processed_count: int
    request_id: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str
