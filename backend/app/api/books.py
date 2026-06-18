"""Book routes — CRUD, PDF upload/download via GridFS, summary generation, processing."""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.schemas.schemas import BookCreate, BookUpdate, BookResponse, BookAnalytics
from app.models.book import Book
from app.models.analytics import BookAccessLog
from app.models.user import User
from app.middleware.auth import get_current_user, require_admin
from app.services import pdf_service, vector_service
from app.database import init_db
from app.config import get_settings
from langchain_openai import ChatOpenAI
from datetime import datetime
import motor.motor_asyncio
import io
from pydantic import BaseModel


router = APIRouter(prefix="/books", tags=["books"])


# We need the DB instance for GridFS operations
_db = None


async def get_db():
    global _db
    if _db is None:
        _db = await init_db()
    return _db


def book_to_response(book: Book) -> BookResponse:
    return BookResponse(
        id=str(book.id),
        title=book.title,
        author=book.author,
        description=book.description,
        genre=book.genre,
        tags=book.tags,
        isbn=book.isbn,
        page_count=book.page_count,
        is_processed=book.is_processed,
        processing_status=book.processing_status,
        total_views=book.total_views,
        total_searches=book.total_searches,
        total_reads=book.total_reads,
        cached_summary=book.cached_summary,
        created_at=book.created_at,
        has_pdf=book.pdf_file_id is not None,
    )


# ─── Public Book Endpoints ───────────────────────

@router.get("/", response_model=list[BookResponse])
async def list_books(
    search: str = None,
    genre: str = None,
    user: User = Depends(get_current_user),
):
    query = {}
    if genre:
        query["genre"] = genre
    
    if search:
        # Text search across title, author, description
        books = await Book.find_all().to_list()
        search_lower = search.lower()
        books = [
            b for b in books
            if search_lower in b.title.lower()
            or search_lower in b.author.lower()
            or search_lower in b.description.lower()
        ]
        # Track search analytics
        for b in books:
            b.total_searches += 1
            await b.save()
    else:
        books = await Book.find_all().to_list()

    return [book_to_response(b) for b in books]


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str, user: User = Depends(get_current_user)):
    book = await Book.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Track view
    book.total_views += 1
    await book.save()

    await BookAccessLog(
        user_id=str(user.id),
        book_id=str(book.id),
        book_title=book.title,
        action="view",
    ).insert()

    return book_to_response(book)


@router.get("/{book_id}/pdf")
async def get_book_pdf(book_id: str, user: User = Depends(get_current_user)):
    """Stream the PDF from GridFS."""
    book = await Book.get(book_id)
    if not book or not book.pdf_file_id:
        raise HTTPException(status_code=404, detail="PDF not found")

    db = await get_db()
    pdf_bytes = await pdf_service.download_pdf_from_gridfs(db, book.pdf_file_id)

    # Track read
    book.total_reads += 1
    await book.save()

    await BookAccessLog(
        user_id=str(user.id),
        book_id=str(book.id),
        book_title=book.title,
        action="read",
    ).insert()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={book.pdf_filename or 'book.pdf'}"},
    )


@router.get("/{book_id}/summary")
async def get_book_summary(book_id: str, user: User = Depends(get_current_user)):
    """Get cached summary or return null (frontend triggers generation via chat)."""
    book = await Book.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return {
        "book_id": str(book.id),
        "title": book.title,
        "cached_summary": book.cached_summary,
        "summary_generated_at": book.summary_generated_at,
    }


class GenerateDescriptionRequest(BaseModel):
    title: str
    author: str = ""

@router.post("/generate-description")
async def generate_book_description(
    data: GenerateDescriptionRequest,
    admin: User = Depends(require_admin),
):
    """Generate a book description, genre, and tags using AI."""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,
    )

    author_text = f"by {data.author}" if data.author else ""
    prompt = f"""You are a librarian API. Provide details for the book "{data.title}" {author_text}.
Respond with ONLY a JSON object:
{{
    "description": "A comprehensive 2-3 paragraph description/blurb of the book",
    "genre": "The main genre",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "author": "The author's name (if known, otherwise leave as is)"
}}"""

    response = await llm.ainvoke(prompt)
    content = response.content.strip()
    
    import json
    try:
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        result = json.loads(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to parse AI response.")

@router.post("/extract-metadata")
async def extract_book_metadata(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """Extract metadata directly from a PDF file using AI."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        
    file_data = await file.read()
    
    # Extract text from first few pages (where title/author usually are)
    try:
        pages = pdf_service.extract_text_from_pdf(file_data)
        text_sample = "\n\n".join([p["text"] for p in pages[:5]])[:4000] # Take up to 4000 chars from first 5 pages
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF: {str(e)}")
        
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.2,
    )

    prompt = f"""You are a librarian AI. Analyze the following text extracted from the beginning of a PDF book.
Identify the book's title and author. Then, write a brief description, identify its genre, and provide 3-5 tags.
If you cannot identify the title or author, make your best guess based on the text.

Text from PDF:
{text_sample}

Respond with ONLY a JSON object in exactly this format:
{{
    "title": "Book Title",
    "author": "Author Name",
    "description": "A 2-3 paragraph description/blurb.",
    "genre": "Main Genre",
    "tags": ["tag1", "tag2", "tag3"]
}}"""

    response = await llm.ainvoke(prompt)
    content = response.content.strip()
    
    usage = response.response_metadata.get("token_usage", {})
    from app.services.tracker import log_llm_usage
    import time
    
    await log_llm_usage(
        user_id=str(admin.id),
        username=admin.username,
        agent_name="metadata_extractor",
        query=f"Extract metadata for {file.filename}",
        response=content[:200],
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        latency_ms=1000,
    )
    
    import json
    try:
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        result = json.loads(content)
        return result
    except Exception as e:
        return {
            "title": file.filename.replace(".pdf", "").replace("-", " ").title(),
            "author": "Unknown",
            "description": "",
            "genre": "Unknown",
            "tags": []
        }

# ─── Admin Book Endpoints ────────────────────────

@router.post("/", response_model=BookResponse)
async def create_book(data: BookCreate, admin: User = Depends(require_admin)):
    book = Book(
        title=data.title,
        author=data.author,
        description=data.description,
        genre=data.genre,
        tags=data.tags,
        isbn=data.isbn,
        added_by=str(admin.id),
    )
    await book.insert()
    return book_to_response(book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(book_id: str, data: BookUpdate, admin: User = Depends(require_admin)):
    book = await Book.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(book, key, value)
    book.updated_at = datetime.utcnow()
    await book.save()
    return book_to_response(book)


@router.delete("/{book_id}")
async def delete_book(book_id: str, admin: User = Depends(require_admin)):
    book = await Book.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Delete PDF from GridFS
    if book.pdf_file_id:
        db = await get_db()
        try:
            await pdf_service.delete_pdf_from_gridfs(db, book.pdf_file_id)
        except Exception:
            pass  # PDF might already be deleted

    # Delete vectors from Qdrant
    try:
        await vector_service.delete_book_vectors(str(book.id))
    except Exception:
        pass

    await book.delete()
    return {"message": "Book deleted successfully"}


@router.post("/{book_id}/upload-pdf", response_model=BookResponse)
async def upload_book_pdf(
    book_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """Upload a PDF to GridFS and trigger background vectorization."""
    book = await Book.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Read file content
    file_data = await file.read()

    # Delete old PDF if exists
    db = await get_db()
    if book.pdf_file_id:
        try:
            await pdf_service.delete_pdf_from_gridfs(db, book.pdf_file_id)
        except Exception:
            pass

    # Upload to GridFS
    file_id = await pdf_service.upload_pdf_to_gridfs(
        db,
        file.filename,
        file_data,
        metadata={"book_id": str(book.id), "title": book.title},
    )

    # Get page count
    pages = pdf_service.extract_text_from_pdf(file_data)

    book.pdf_file_id = file_id
    book.pdf_filename = file.filename
    book.page_count = len(pages)
    book.processing_status = "processing"
    await book.save()

    # Background task: vectorize the PDF
    background_tasks.add_task(process_pdf_for_rag, str(book.id), file_data)

    return book_to_response(book)


async def process_pdf_for_rag(book_id: str, pdf_bytes: bytes):
    """Background task: extract text, chunk, embed, and upsert to Qdrant."""
    try:
        book = await Book.get(book_id)
        if not book:
            return

        # Extract text from PDF
        pages = pdf_service.extract_text_from_pdf(pdf_bytes)

        # Chunk for embedding
        chunks = pdf_service.chunk_pages_for_embedding(
            pages=pages,
            book_id=book_id,
            book_title=book.title,
            author=book.author,
        )

        # Ensure Qdrant collection exists
        await vector_service.ensure_collection()

        # Delete old vectors for this book
        try:
            await vector_service.delete_book_vectors(book_id)
        except Exception:
            pass

        # Embed and upsert
        await vector_service.embed_and_upsert_chunks(chunks)

        # Update book status
        book.is_processed = True
        book.processing_status = "completed"
        await book.save()

        # Generate summary upfront
        try:
            from app.agents.summarizer import summarize_book
            await summarize_book(book_id, force_regenerate=True)
        except Exception as e:
            pass

    except Exception as e:
        book = await Book.get(book_id)
        if book:
            book.processing_status = f"failed: {str(e)[:200]}"
            await book.save()


# ─── Analytics ────────────────────────────────────

@router.get("/analytics/popular", response_model=BookAnalytics)
async def get_book_analytics(admin: User = Depends(require_admin)):
    books = await Book.find_all().to_list()

    most_viewed = sorted(books, key=lambda b: b.total_views, reverse=True)[:10]
    most_searched = sorted(books, key=lambda b: b.total_searches, reverse=True)[:10]
    most_read = sorted(books, key=lambda b: b.total_reads, reverse=True)[:10]

    def to_dict(b):
        return {"id": str(b.id), "title": b.title, "author": b.author, "count": b.total_views}

    return BookAnalytics(
        most_viewed=[{**to_dict(b), "count": b.total_views} for b in most_viewed],
        most_searched=[{**to_dict(b), "count": b.total_searches} for b in most_searched],
        most_read=[{**to_dict(b), "count": b.total_reads} for b in most_read],
    )
