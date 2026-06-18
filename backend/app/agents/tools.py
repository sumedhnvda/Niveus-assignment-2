"""
Shared tools for all agents — database lookups, vector search, etc.
"""

from app.models.book import Book
from app.models.analytics import BookRequest
from app.services.vector_service import search_similar


async def search_book_catalog(query: str) -> list[dict]:
    """Search the book catalog by title/author/genre."""
    books = await Book.find_all().to_list()
    query_lower = query.lower()
    results = []
    for book in books:
        score = 0
        if query_lower in book.title.lower():
            score += 3
        if query_lower in book.author.lower():
            score += 2
        if query_lower in book.description.lower():
            score += 1
        if any(query_lower in tag.lower() for tag in book.tags):
            score += 1
        if query_lower in book.genre.lower():
            score += 1
        if score > 0:
            results.append({
                "id": str(book.id),
                "title": book.title,
                "author": book.author,
                "genre": book.genre,
                "description": book.description[:200],
                "is_available": book.pdf_file_id is not None,
                "relevance_score": score,
            })
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:10]


async def get_all_books_metadata() -> list[dict]:
    """Get metadata for all books in catalog."""
    books = await Book.find_all().to_list()
    return [
        {
            "id": str(b.id),
            "title": b.title,
            "author": b.author,
            "genre": b.genre,
            "description": b.description[:150],
            "summary": b.cached_summary if b.cached_summary else b.description,
            "tags": b.tags,
            "is_available": b.pdf_file_id is not None,
        }
        for b in books
    ]


async def semantic_search_books(query: str, top_k: int = 5, book_id: str = None) -> list[dict]:
    """Semantic search across book content via Qdrant."""
    return await search_similar(query, top_k=top_k, book_id=book_id)


async def check_book_exists(title: str, author: str = None) -> bool:
    """Check if a specific book exists in our catalog."""
    books = await Book.find_all().to_list()
    title_lower = title.lower()
    for book in books:
        search_target = f"{book.title} {book.cached_summary or ''} {book.description}".lower()
        if title_lower in search_target:
            if author:
                if author.lower() in book.author.lower():
                    return True
            else:
                return True
    return False


async def create_book_request(user_id: str, username: str, book_title: str, author: str = None, reason: str = ""):
    """Create a book request notification for admin."""
    # Check if already requested
    existing = await BookRequest.find_one(
        BookRequest.book_title == book_title,
        BookRequest.status == "pending",
    )
    if existing:
        return {"status": "already_requested", "message": f"'{book_title}' has already been requested."}

    request = BookRequest(
        user_id=user_id,
        username=username,
        book_title=book_title,
        author=author,
        reason=reason,
    )
    await request.insert()
    return {"status": "created", "message": f"Request for '{book_title}' has been submitted to the admin."}
