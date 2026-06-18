from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ─── Auth ────────────────────────────────────────
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    role: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    is_flagged: bool
    flag_reason: Optional[str] = None
    created_at: datetime
    favorite_genres: list[str] = []


# ─── Books ───────────────────────────────────────
class BookCreate(BaseModel):
    title: str
    author: str
    description: str = ""
    genre: str = ""
    tags: list[str] = []
    isbn: Optional[str] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[list[str]] = None
    isbn: Optional[str] = None


class BookResponse(BaseModel):
    id: str
    title: str
    author: str
    description: str
    genre: str
    tags: list[str]
    isbn: Optional[str]
    page_count: int
    is_processed: bool
    processing_status: str
    total_views: int
    total_searches: int
    total_reads: int
    cached_summary: Optional[str]
    created_at: datetime
    has_pdf: bool = False


# ─── Chat ────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    book_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    agent_used: str
    sources: list[dict] = []
    session_id: str


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


# ─── Analytics ───────────────────────────────────
class LLMUsageResponse(BaseModel):
    id: str
    user_id: str
    username: str
    agent_name: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    query: str
    latency_ms: int
    status: str
    created_at: datetime


class AnalyticsSummary(BaseModel):
    total_queries: int
    total_tokens: int
    queries_today: int
    tokens_today: int
    agent_breakdown: dict  # {agent_name: {queries: int, tokens: int}}
    top_users: list[dict]  # [{user_id, username, queries, tokens}]
    daily_trend: list[dict]  # [{date, queries, tokens}]


class BookAnalytics(BaseModel):
    most_viewed: list[dict]
    most_searched: list[dict]
    most_read: list[dict]


# ─── Book Requests ───────────────────────────────
class BookRequestCreate(BaseModel):
    book_title: str
    author: Optional[str] = None
    reason: str = ""


class BookRequestResponse(BaseModel):
    id: str
    user_id: str
    username: str
    book_title: str
    author: Optional[str]
    reason: str
    status: str
    admin_notes: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]


class BookRequestUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None


# ─── Moderation ──────────────────────────────────
class ModerationLogResponse(BaseModel):
    id: str
    user_id: str
    username: str
    message: str
    flag_type: str
    severity: str
    agent_reasoning: str
    action_taken: str
    reviewed_by_admin: bool
    created_at: datetime


class UserFlagRequest(BaseModel):
    is_flagged: bool
    flag_reason: Optional[str] = None
