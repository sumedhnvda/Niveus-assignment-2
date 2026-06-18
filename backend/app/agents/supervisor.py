"""
Supervisor Agent — The brain of the multi-agent system.
Classifies user intent and routes to the appropriate specialist agent.
Uses LLM to determine routing.
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings

SUPERVISOR_PROMPT = """You are a supervisor agent for a book management and reading platform.
Your job is to analyze the user's message and determine which specialist agent should handle it.

Available agents:
1. "recommender" — For book recommendations, suggestions, "what should I read" type queries
2. "rag_qa" — For questions about book content, "what does the book say about...", factual questions from books, or ANY vague questions when the user is viewing a specific book (Context: Currently viewing a book)
3. "book_request" — For requesting specific books we don't have, "I want to read [specific book]" and we confirmed it's not available
4. "summarizer" — For summarizing a book or chapter, "summarize this book", "give me key points"
5. "quiz" — For quizzing the user, giving a live assignment, asking thought-provoking questions to test their knowledge about a book
6. "general" — For greetings, general conversation, questions about the platform

Important routing rules:
- CRITICAL: If Context is "YES", the user is reading a book! You MUST assume that ANY question asking to explain something, summarize something, or asking "how does this work" or "what is this pipeline" refers to the BOOK CONTENT! Route to "rag_qa"! Do NOT route to "general" when Context is YES unless they are explicitly asking about the chat interface itself!
- CRITICAL: If the user asks a general question about the ENTIRE library, what books we have, or how many books we have, route to "general" or "recommender". Do NOT route global library questions to "rag_qa"!
- If the user mentions a SPECIFIC book title and seems to want to find/read it → first check if it's a question about content (rag_qa) or a request for an unavailable book (book_request)
- If the user asks "what should I read" or "suggest me books" → recommender
- If the user asks about content/facts from a book → rag_qa
- If the user says "summarize" or "summary" → summarizer
- If the user says "quiz me", "test me", or "give me an assignment" about a book → quiz
- If the user just wants to chat or asks about the platform → general

Respond with ONLY a JSON object:
{{
    "agent": "recommender" | "rag_qa" | "book_request" | "summarizer" | "quiz" | "general",
    "reasoning": "brief explanation of why this agent was chosen",
    "needs_book_check": true/false,
    "book_title": "extracted book title from the query OR from chat history if user uses pronouns like 'it' or 'this book', otherwise null"
}}

User message: {message}
Context: {has_book_context}

Chat history (last 3 messages):
{history}"""

async def classify_intent(message: str, chat_history: list[dict] = None, book_id: str = None) -> dict:
    """
    Classify user intent and determine which agent should handle the message.
    """
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0,
    )

    history_str = ""
    if chat_history:
        for msg in chat_history[-3:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:200]
            history_str += f"{role}: {content}\n"
    else:
        history_str = "No previous messages."

    has_book_context = "YES, User is currently viewing a specific book." if book_id and book_id != "global" else "NO, User is on the global chat."
    prompt = SUPERVISOR_PROMPT.format(message=message, history=history_str, has_book_context=has_book_context)
    response = await llm.ainvoke(prompt)

    import json
    try:
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        result = json.loads(content)
    except (json.JSONDecodeError, IndexError):
        result = {
            "agent": "general",
            "reasoning": "Could not parse classification, defaulting to general.",
            "needs_book_check": False,
        }

    prompt_tokens = len(prompt.split())
    completion_tokens = len(response.content.split())

    result["prompt_tokens"] = prompt_tokens
    result["completion_tokens"] = completion_tokens

    return result


async def generate_general_response(message: str, chat_history: list[dict] = None) -> dict:
    """Handle general conversation that doesn't need a specialist agent."""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
    )

    history_str = ""
    if chat_history:
        for msg in chat_history[-5:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:300]
            history_str += f"{role}: {content}\n"

    from app.agents.tools import get_all_books_metadata
    books = await get_all_books_metadata()
    catalog_str = "Available Books in Library:\n"
    for b in books:
        catalog_str += f"- Title: {b['title']}\n  Author: {b['author']}\n  Genre: {b['genre']}\n  Description: {b['description']}\n\n"

    prompt = f"""You are a helpful assistant for a book management and reading platform called Nevius.
You help users with the platform, reading, and book-related topics.

Here is the current catalog of ALL books available in the library:
{catalog_str}

Chat history:
{history_str}

User: {message}

Respond naturally and helpfully. If they ask about features, explain that:
- They can browse and read books in our digital library
- They can chat with AI for book recommendations, ask questions about book content, and request new books
- Our AI will provide answers with source citations from the actual books

Keep responses concise and friendly."""

    response = await llm.ainvoke(prompt)

    prompt_tokens = len(prompt.split())
    completion_tokens = len(response.content.split())

    return {
        "response": response.content,
        "agent": "general",
        "sources": [],
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }
