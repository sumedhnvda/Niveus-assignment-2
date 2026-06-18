from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class User(Document):
    username: str
    email: str
    role: str = "user"  # "admin" or "user"
    is_active: bool = True
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    # Reading preferences for recommendations
    favorite_genres: list[str] = []
    reading_history: list[str] = []  # List of book IDs

    class Settings:
        name = "users"
        indexes = [
            "username",
            "email",
        ]
