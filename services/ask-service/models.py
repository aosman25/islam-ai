from pydantic import BaseModel, Field
from typing import List, Optional

class SourceData(BaseModel):
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

class AskRequest(BaseModel):
    query: str
    sources: List[SourceData]
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=8000, gt=0, le=65536)
