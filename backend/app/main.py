"""
Niveus Solutions — FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.services.vector_service import ensure_collection
from app.api import auth, books, chat, analytics
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("🚀 Starting Niveus Solutions...")
    await init_db()
    logger.info("✅ MongoDB connected")

    try:
        await ensure_collection()
        logger.info("✅ Qdrant collection ready")
    except Exception as e:
        logger.warning(f"⚠️ Qdrant connection issue (will retry on first use): {e}")

    logger.info("✅ System ready!")

    yield

    # Shutdown
    logger.info("👋 Shutting down...")


app = FastAPI(
    title="Niveus Solutions",
    description="AI-powered book management with multi-agent system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Niveus Solutions"}
