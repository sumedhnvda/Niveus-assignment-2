from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class ChatSession(Document):
    user_id: str
    book_id: Optional[str] = None
    title: str = "New Chat"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_sessions"
        indexes = ["user_id", "book_id"]


class ChatMessage(Document):
    session_id: str
    user_id: str
    role: str  # "user" or "assistant"
    content: str
    agent_used: Optional[str] = None  # Which agent handled this
    sources: list[dict] = []  # [{book_title, page_number, snippet}]
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Cache key for identical queries
    cache_key: Optional[str] = None

    class Settings:
        name = "chat_messages"
        indexes = [
            "session_id",
            "user_id",
            "cache_key",
        ]
