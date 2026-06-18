from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class Book(Document):
    title: str
    author: str
    description: str = ""
    genre: str = ""
    tags: list[str] = []
    isbn: Optional[str] = None
    cover_image_url: Optional[str] = None

    # GridFS reference for the PDF
    pdf_file_id: Optional[str] = None  # GridFS ObjectId as string
    pdf_filename: Optional[str] = None
    page_count: int = 0

    # Processing status
    is_processed: bool = False  # Whether PDF has been vectorized
    processing_status: str = "pending"  # pending, processing, completed, failed

    # Analytics
    total_views: int = 0
    total_searches: int = 0
    total_reads: int = 0

    # Cached summary (to avoid re-generating)
    cached_summary: Optional[str] = None
    summary_generated_at: Optional[datetime] = None

    # Metadata
    added_by: Optional[str] = None  # Admin user ID
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "books"
        indexes = [
            "title",
            "author",
            "genre",
            "tags",
        ]
