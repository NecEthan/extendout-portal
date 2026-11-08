from datetime import datetime

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    project_id: int | None = None


class Citation(BaseModel):
    document_title: str
    version_number: int
    status: str
    updated_at: datetime


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]


# Internal schema for validating LLM structured output.
class _LLMCitation(BaseModel):
    document_title: str
    version_number: int


class LLMAnswer(BaseModel):
    answer: str
    citations: list[_LLMCitation]
