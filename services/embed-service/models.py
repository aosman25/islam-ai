from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# Import Config at module level to avoid circular import issues
MAX_TEXT_LENGTH = 8000


class EmbeddingRequest(BaseModel):
    input_text: List[str] = Field(
        ..., min_items=1, max_items=10
    )
    dense: bool = True
    sparse: bool = False
    colbert: bool = False

    @field_validator("input_text")
    @classmethod
    def validate_input_text(cls, v):
        # Filter out empty texts and validate length
        valid_texts = []
        for text in v:
            if text.strip():
                if len(text) > MAX_TEXT_LENGTH:
                    raise ValueError(
                        f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"
                    )
                valid_texts.append(text.strip())

        if not valid_texts:
            raise ValueError("At least one non-empty text is required")
        return valid_texts


class EmbeddingResponseModel(BaseModel):
    dense: Optional[List[List[float]]] = None
    sparse: Optional[List[dict]] = None
    colbert: Optional[List[List[float]]] = None
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
