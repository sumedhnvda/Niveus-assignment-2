"""
Summary Agent — Generates book summaries on demand.
Caches results in the Book model to avoid re-generation.
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.models.book import Book
from app.agents.tools import semantic_search_books
from datetime import datetime

SUMMARY_PROMPT = """You are a book summarizer for a digital library platform.
Generate a comprehensive yet concise summary of the book based on the provided content excerpts.

Book: "{title}" by {author}
Description: {description}

Content excerpts from the book:
{content}

Create a well-structured summary that includes:
1. **Overview**: What the book is about (2-3 sentences)
2. **Key Themes**: Main themes and topics covered
3. **Key Takeaways**: Most important points or insights
4. **Who Should Read This**: Target audience

Keep the summary informative but concise (around 300-500 words).
If the content excerpts are limited, base the summary on what's available and the book description."""


async def summarize_book(book_id: str, force_regenerate: bool = False) -> dict:
    """
    Generate a summary for a book. Uses cache if available.
    """
    book = await Book.get(book_id)
    if not book:
        return {
            "response": "Book not found.",
            "agent": "summarizer",
            "sources": [],
            "prompt_tokens": 0,
            "completion_tokens": 0,
        }

    # Return cached summary if available (cost savings!)
    if book.cached_summary and not force_regenerate:
        return {
            "response": book.cached_summary,
            "agent": "summarizer",
            "sources": [{"book_title": book.title, "author": book.author, "type": "cached"}],
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "from_cache": True,
        }

    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.4,
    )

    # Get content from vector store
    content_results = await semantic_search_books(
        query=f"summary overview main themes {book.title}",
        top_k=10,
        book_id=book_id,
    )

    content_str = "\n\n".join(
        f"[Page {r['metadata']['page_number']}]: {r['text']}"
        for r in content_results
    ) if content_results else "No content excerpts available."

    prompt = SUMMARY_PROMPT.format(
        title=book.title,
        author=book.author,
        description=book.description or "No description available.",
        content=content_str,
    )

    response = await llm.ainvoke(prompt)

    # Cache the summary in the book document
    book.cached_summary = response.content
    book.summary_generated_at = datetime.utcnow()
    await book.save()

    prompt_tokens = len(prompt.split())
    completion_tokens = len(response.content.split())

    return {
        "response": response.content,
        "agent": "summarizer",
        "sources": [{"book_id": book_id, "book_title": book.title, "author": book.author, "page_number": r["metadata"]["page_number"]} for r in content_results[:3]],
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "from_cache": False,
    }
