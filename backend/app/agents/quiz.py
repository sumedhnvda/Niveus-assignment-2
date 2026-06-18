"""
Quiz Agent — Generates a live assignment/quiz based on the book content.
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.models.book import Book
from app.agents.tools import semantic_search_books

QUIZ_PROMPT = """You are a teacher evaluating a student's understanding of the book "{title}" by {author}.
Based on the following excerpts from the book (or its general themes), generate an interactive multiple choice quiz (exactly 5 questions).

Book Description: {description}

Excerpts:
{content}

CRITICAL: You MUST respond with ONLY a strictly valid JSON array of objects. Do not include markdown code blocks like ```json. Do not include any other text.
Format:
[
  {{
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0, // index of the correct option
    "explanation": "Brief explanation of why this is correct."
  }}
]
"""

async def generate_quiz(book_id: str) -> dict:
    book = await Book.get(book_id)
    if not book:
        return {"response": "Book not found."}

    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
    )

    # Get content from vector store
    content_results = await semantic_search_books(
        query=f"main themes key takeaways important concepts {book.title}",
        top_k=5,
        book_id=book_id,
    )

    content_str = "\n\n".join(
        f"[Page {r['metadata']['page_number']}]: {r['text']}"
        for r in content_results
    ) if content_results else "No specific excerpts available."

    prompt = QUIZ_PROMPT.format(
        title=book.title,
        author=book.author,
        description=book.description or "No description available.",
        content=content_str,
    )

    response = await llm.ainvoke(prompt)

    usage = response.response_metadata.get("token_usage", {})
    
    return {
        "response": response.content,
        "agent": "quiz",
        "sources": [{"book_id": book_id, "book_title": book.title, "author": book.author, "page_number": r["metadata"]["page_number"]} for r in content_results[:3]] if content_results else [],
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
    }

CHAT_QUIZ_PROMPT = """You are a conversational Quiz Master testing the user's knowledge of the book "{title}" by {author}.
You are interacting with the user inside a chatbot. 
Your goal is to ask them ONE question at a time. Do not dump all questions at once.
Evaluate their previous answer (if any), give brief feedback, and then ask the NEXT question.
Once they have answered 5 questions, give them a final score and a summary of their performance.

Book Description: {description}

Excerpts:
{content}

Chat History:
{history}

User's latest message: {message}

If they just asked to start a quiz, welcome them and ask Question 1. If they are answering a question, evaluate it and move to the next.
"""

async def chat_quiz(message: str, chat_history: list[dict], book_id: str) -> dict:
    book = await Book.get(book_id)
    if not book:
        return {"response": "Book not found."}

    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
    )

    # Get content from vector store
    content_results = await semantic_search_books(
        query=f"main themes key takeaways important concepts {book.title}",
        top_k=5,
        book_id=book_id,
    )

    content_str = "\n\n".join(
        f"[Page {r['metadata']['page_number']}]: {r['text']}"
        for r in content_results
    ) if content_results else "No specific excerpts available."

    history_str = ""
    for msg in chat_history[-6:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_str += f"{role}: {content}\n"

    prompt = CHAT_QUIZ_PROMPT.format(
        title=book.title,
        author=book.author,
        description=book.description or "No description available.",
        content=content_str,
        history=history_str,
        message=message,
    )

    response = await llm.ainvoke(prompt)

    usage = response.response_metadata.get("token_usage", {})
    
    return {
        "response": response.content,
        "agent": "quiz",
        "sources": [],
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
    }
