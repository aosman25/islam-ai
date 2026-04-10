from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ChatHistoryMessage(BaseModel):
    """A single message in the chat history"""

    role: Literal["user", "assistant"]
    content: str


class OptimizedQueryResponse(BaseModel):
    hypothetical_passages: List[str] = Field(..., min_items=1, max_items=5)
    categories: Optional[List[str]] = Field(None)


class TriageResponse(BaseModel):
    """Front-door classification: should we run retrieval, or reply directly?"""

    intent: Literal["retrieve", "smalltalk", "out_of_scope"]
    reply: Optional[str] = None


class QueryRequest(BaseModel):
    queries: List[str] = Field(
        ..., min_items=1, max_items=10
    )
    chat_history: Optional[List[ChatHistoryMessage]] = Field(
        default=None,
        description="Previous user queries used by the contextualizer",
    )
    recent_messages: Optional[List[ChatHistoryMessage]] = Field(
        default=None,
        description="Recent conversation (mixed user/assistant roles) for the triage classifier",
    )

    @field_validator("queries")
    @classmethod
    def validate_queries(cls, v):
        valid_queries = [query.strip() for query in v if query.strip()]
        if not valid_queries:
            raise ValueError("At least one non-empty query is required")
        return valid_queries


class QueryResponse(BaseModel):
    results: List[OptimizedQueryResponse]
    processed_count: int
    request_id: str
    triage: Optional[TriageResponse] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str
