"""
Book Recommender Agent — Suggests books based on user preferences and reading history.
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.agents.tools import get_all_books_metadata

RECOMMENDER_PROMPT = """You are a book recommendation expert for a digital library platform.
Based on the user's query, reading history, and available books in our catalog, recommend the most relevant books.

Available books in our catalog:
{catalog}

User's reading history (books they've read):
{reading_history}

User's favorite genres: {favorite_genres}

User's request: {query}

Provide thoughtful recommendations with reasons. If the user asks for something we don't have, 
mention that and suggest the closest alternatives we DO have.

Format your response naturally and conversationally. For each recommendation, include:
- Book title and author
- Why you're recommending it
- What makes it relevant to their request

If our catalog is empty or doesn't match their needs, say so honestly."""


async def recommend_books(query: str, reading_history: list[str] = None, favorite_genres: list[str] = None) -> dict:
    """
    Generate book recommendations based on query and user preferences.
    """
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
    )

    # Get current catalog
    catalog = await get_all_books_metadata()
    catalog_str = "\n".join(
        f"- {b['title']} by {b['author']} (Genre: {b['genre']}) — {b.get('summary', b['description'])}"
        for b in catalog
    ) if catalog else "No books currently in catalog."

    history_str = ", ".join(reading_history) if reading_history else "No reading history yet."
    genres_str = ", ".join(favorite_genres) if favorite_genres else "No preferences set."

    prompt = RECOMMENDER_PROMPT.format(
        catalog=catalog_str,
        reading_history=history_str,
        favorite_genres=genres_str,
        query=query,
    )

    response = await llm.ainvoke(prompt)
    content = response.content

    # Extract recommended books
    sources = []
    for b in catalog:
        if b["title"].lower() in content.lower():
            sources.append({"book_id": b["id"], "book_title": b["title"], "author": b["author"]})

    prompt_tokens = len(prompt.split())
    completion_tokens = len(content.split())

    return {
        "response": content,
        "agent": "recommender",
        "sources": sources,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }
