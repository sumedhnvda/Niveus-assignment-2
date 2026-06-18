"""
Vector Service — Manages Qdrant vector store operations.
Handles embedding, upserting, and searching book content.
"""

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from langchain_huggingface import HuggingFaceEmbeddings
from app.config import get_settings
import uuid
import logging

logger = logging.getLogger(__name__)

_client = None
_embeddings = None

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 embedding dimension


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=30,
        )
    return _client


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
        )
    return _embeddings


async def ensure_collection():
    """Create the Qdrant collection if it doesn't exist."""
    client = get_qdrant_client()
    settings = get_settings()
    collection_name = settings.QDRANT_COLLECTION_NAME

    collections = client.get_collections().collections
    exists = any(c.name == collection_name for c in collections)

    if not exists:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        logger.info(f"Created Qdrant collection: {collection_name}")


async def embed_and_upsert_chunks(chunks: list[dict]) -> int:
    """
    Embed text chunks and upsert them into Qdrant.
    Returns the number of points upserted.
    """
    if not chunks:
        return 0

    client = get_qdrant_client()
    embeddings = get_embeddings()
    settings = get_settings()

    texts = [c["text"] for c in chunks]

    # Batch embed (max 100 at a time for API limits)
    all_vectors = []
    batch_size = 50
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        vectors = embeddings.embed_documents(batch)
        all_vectors.extend(vectors)

    # Create Qdrant points
    points = []
    for i, (chunk, vector) in enumerate(zip(chunks, all_vectors)):
        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "text": chunk["text"],
                "book_id": chunk["metadata"]["book_id"],
                "book_title": chunk["metadata"]["book_title"],
                "author": chunk["metadata"]["author"],
                "page_number": chunk["metadata"]["page_number"],
                "chunk_index": chunk["metadata"]["chunk_index"],
            },
        )
        points.append(point)

    # Batch upsert (max 100 at a time)
    for i in range(0, len(points), 100):
        batch = points[i:i + 100]
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            points=batch,
        )

    logger.info(f"Upserted {len(points)} chunks into Qdrant")
    return len(points)


async def search_similar(query: str, top_k: int = 5, book_id: str = None) -> list[dict]:
    """
    Search for similar content in the vector store.
    Optionally filter by book_id.
    Returns list of {text, metadata, score}.
    """
    client = get_qdrant_client()
    embeddings = get_embeddings()
    settings = get_settings()

    query_vector = embeddings.embed_query(query)

    search_filter = None
    if book_id:
        search_filter = Filter(
            must=[
                FieldCondition(
                    key="book_id",
                    match=MatchValue(value=book_id),
                )
            ]
        )

    try:
        results = client.search(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k,
            query_filter=search_filter,
        )
    except Exception as e:
        logger.warning(f"Vector search failed (likely collection missing): {e}")
        return []

    return [
        {
            "text": hit.payload["text"],
            "metadata": {
                "book_id": hit.payload.get("book_id"),
                "book_title": hit.payload.get("book_title"),
                "author": hit.payload.get("author"),
                "page_number": hit.payload.get("page_number"),
            },
            "score": hit.score,
        }
        for hit in results
    ]


async def delete_book_vectors(book_id: str):
    """Delete all vectors associated with a book."""
    client = get_qdrant_client()
    settings = get_settings()

    client.delete(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="book_id",
                    match=MatchValue(value=book_id),
                )
            ]
        ),
    )
    logger.info(f"Deleted vectors for book: {book_id}")
