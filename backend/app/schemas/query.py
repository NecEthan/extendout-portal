from datetime import datetime

from pydantic import BaseModel, Field

# Longest question accepted. Keeps each search's prompt (and OpenAI cost) small.
MAX_QUESTION_CHARS = 1000


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_CHARS)
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
