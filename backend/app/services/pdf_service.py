"""
PDF Service — All PDF operations go through MongoDB GridFS.
No local filesystem storage. Handles upload, download, text extraction, and chunking.
"""

import io
import hashlib
from bson import ObjectId
import motor.motor_asyncio
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter


async def get_gridfs_bucket(db) -> motor.motor_asyncio.AsyncIOMotorGridFSBucket:
    """Get or create GridFS bucket for PDF storage."""
    return motor.motor_asyncio.AsyncIOMotorGridFSBucket(db, bucket_name="pdfs")


async def upload_pdf_to_gridfs(db, filename: str, file_data: bytes, metadata: dict = None) -> str:
    """
    Upload a PDF file to MongoDB GridFS.
    Returns the GridFS file_id as a string.
    """
    bucket = await get_gridfs_bucket(db)

    file_metadata = metadata or {}
    file_metadata["content_type"] = "application/pdf"
    file_metadata["checksum"] = hashlib.md5(file_data).hexdigest()

    grid_in = bucket.open_upload_stream(
        filename,
        metadata=file_metadata,
    )
    await grid_in.write(file_data)
    await grid_in.close()

    return str(grid_in._id)


async def download_pdf_from_gridfs(db, file_id: str) -> bytes:
    """Download a PDF file from GridFS by its file_id."""
    bucket = await get_gridfs_bucket(db)
    grid_out = await bucket.open_download_stream(ObjectId(file_id))
    content = await grid_out.read()
    return content


async def delete_pdf_from_gridfs(db, file_id: str):
    """Delete a PDF file from GridFS."""
    bucket = await get_gridfs_bucket(db)
    await bucket.delete(ObjectId(file_id))


def extract_text_from_pdf(pdf_bytes: bytes) -> list[dict]:
    """
    Extract text from PDF bytes, returning a list of page dicts.
    Each dict: {page_number: int, text: str}
    """
    pages = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            pages.append({
                "page_number": page_num + 1,
                "text": text.strip(),
            })
    doc.close()
    return pages


def chunk_pages_for_embedding(
    pages: list[dict],
    book_id: str,
    book_title: str,
    author: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[dict]:
    """
    Split extracted pages into chunks suitable for vector embedding.
    Returns list of {text, metadata} dicts.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = []
    for page in pages:
        page_chunks = splitter.split_text(page["text"])
        for i, chunk_text in enumerate(page_chunks):
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "book_id": book_id,
                    "book_title": book_title,
                    "author": author,
                    "page_number": page["page_number"],
                    "chunk_index": i,
                },
            })

    return chunks
