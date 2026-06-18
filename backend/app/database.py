import motor.motor_asyncio
from beanie import init_beanie
from app.config import get_settings
from app.models.user import User
from app.models.book import Book
from app.models.chat import ChatMessage, ChatSession
from app.models.analytics import LLMUsageLog, BookAccessLog, BookRequest, ModerationLog


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    settings = get_settings()
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    await init_beanie(
        database=db,
        document_models=[
            User,
            Book,
            ChatMessage,
            ChatSession,
            LLMUsageLog,
            BookAccessLog,
            BookRequest,
            ModerationLog,
        ],
    )

    return db


def get_gridfs_bucket(db):
    """Get GridFS bucket for PDF storage."""
    import motor.motor_asyncio
    return motor.motor_asyncio.AsyncIOMotorGridFSBucket(db, bucket_name="pdfs")
