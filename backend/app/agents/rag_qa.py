"""
RAG QA Agent — Answers questions about book content using retrieval-augmented generation.
Returns answers with source citations (book title, page number, relevant passage).
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.agents.tools import semantic_search_books

RAG_QA_PROMPT = """You are a knowledgeable book content assistant for a digital library platform.
Answer the user's question using ONLY the provided context from our book collection.

Context from our books:
{context}

User's question: {query}

Instructions:
1. Answer based ONLY on the provided context. Do not make up information.
2. If the context doesn't contain enough information, say so honestly.
3. Always cite your sources by mentioning the book title and page number.
4. Format your answer clearly and concisely.
5. If multiple sources are relevant, synthesize the information and cite all sources.
6. Use the Chat History to understand pronouns like "it" or "this book".

Chat History:
{history}

Provide a thorough, well-cited answer."""


async def rag_answer(query: str, book_id: str = None, chat_history: list = None) -> dict:
    """
    Answer a question using RAG over book content.
    Optionally scoped to a specific book.
    """
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,
    )

    # Retrieve relevant chunks from Qdrant
    search_book_id = None if book_id == "global" else book_id
    search_results = await semantic_search_books(query, top_k=6, book_id=search_book_id)

    context_parts = []
    
    if search_book_id:
        from app.models.book import Book
        from beanie import PydanticObjectId
        try:
            book = await Book.get(PydanticObjectId(search_book_id))
            if book:
                context_parts.append(
                    f"[Book Overview] Title: {book.title}\n"
                    f"Author: {book.author}\n"
                    f"Description: {book.description}\n"
                    f"Summary: {book.cached_summary or 'Not available'}"
                )
        except Exception as e:
            print(f"Error fetching book metadata for RAG: {e}")
    else:
        # Global RAG search: Provide catalog metadata as fallback context
        from app.agents.tools import get_all_books_metadata
        catalog = await get_all_books_metadata()
        for b in catalog:
            context_parts.append(
                f"[Book Overview] Title: {b['title']}\n"
                f"Author: {b['author']}\n"
                f"Description: {b['description']}\n"
                f"Summary: {b.get('summary', 'Not available')}"
            )

    sources = []
    for i, result in enumerate(search_results):
        meta = result["metadata"]
        context_parts.append(
            f"[Source {i+1}] Book: \"{meta['book_title']}\" by {meta['author']}, "
            f"Page {meta['page_number']}:\n{result['text']}"
        )
        sources.append({
            "book_id": meta.get("book_id"),
            "book_title": meta["book_title"],
            "author": meta["author"],
            "page_number": meta["page_number"],
            "snippet": result["text"][:150],
            "relevance_score": result["score"],
        })

    if not context_parts:
        return {
            "response": "I couldn't find any relevant information in our book collection to answer your question. "
                        "Try rephrasing your question or ask about a specific book.",
            "agent": "rag_qa",
            "sources": [],
            "prompt_tokens": 0,
            "completion_tokens": 0,
        }

    context_str = "\n\n".join(context_parts)

    history_str = ""
    if chat_history:
        for msg in chat_history[-3:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:300]
            history_str += f"{role}: {content}\n"
    else:
        history_str = "No previous messages."

    prompt = RAG_QA_PROMPT.format(context=context_str, query=query, history=history_str)
    response = await llm.ainvoke(prompt)

    prompt_tokens = len(prompt.split())
    completion_tokens = len(response.content.split())

    return {
        "response": response.content,
        "agent": "rag_qa",
        "sources": sources,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }
