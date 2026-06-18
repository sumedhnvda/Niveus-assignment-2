from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class LLMUsageLog(Document):
    """Tracks every LLM call for admin analytics."""
    user_id: str
    username: str
    agent_name: str  # supervisor, recommender, rag_qa, book_request, moderator, summarizer
    model_name: str = "gemini-2.0-flash"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    query: str = ""
    response_preview: str = ""  # First 200 chars of response
    latency_ms: int = 0
    status: str = "success"  # success, error, blocked
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "llm_usage_logs"
        indexes = [
            "user_id",
            "agent_name",
            "created_at",
        ]


class BookAccessLog(Document):
    """Tracks book access patterns for analytics."""
    user_id: str
    book_id: str
    book_title: str
    action: str  # "view", "read", "search", "download"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "book_access_logs"
        indexes = [
            "book_id",
            "user_id",
            "action",
            "created_at",
        ]


class BookRequest(Document):
    """Books requested by users that aren't in the library."""
    user_id: str
    username: str
    book_title: str
    author: Optional[str] = None
    reason: str = ""
    status: str = "pending"  # pending, approved, rejected, fulfilled
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None

    class Settings:
        name = "book_requests"
        indexes = [
            "status",
            "user_id",
        ]


class ModerationLog(Document):
    """Logs flagged messages and user behavior."""
    user_id: str
    username: str
    message: str
    flag_type: str  # "inappropriate", "off_topic", "spam", "harmful"
    severity: str  # "low", "medium", "high"
    agent_reasoning: str = ""
    action_taken: str = "logged"  # logged, warned, blocked
    reviewed_by_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "moderation_logs"
        indexes = [
            "user_id",
            "flag_type",
            "severity",
        ]
