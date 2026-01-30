from pydantic import BaseModel, Field
from typing import List, Optional


class SourceData(BaseModel):
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


class AskRequest(BaseModel):
    query: str
    sources: List[SourceData]
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=65536, gt=0, le=65536)
    stream: Optional[bool] = Field(
        default=False, description="Enable streaming response"
    )
