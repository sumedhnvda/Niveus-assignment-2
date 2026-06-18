from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Niveus Solutions"
    DEBUG: bool = True

    # JWT
    JWT_SECRET: str = "nevius-book-management-secret-key-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "nevius_books"

    # Qdrant
    QDRANT_URL: str = "https://91d19e1d-f824-42fd-bb2f-910e417784ec.eu-west-2-0.aws.cloud.qdrant.io"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION_NAME: str = "book_embeddings"

    # OpenRouter
    OPENROUTER_API_KEY: str = ""
    LLM_MODEL: str = "deepseek/deepseek-v4-flash"

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
