"""
Book Request Agent — Detects when a user asks for a book not in the library.
Creates a notification for admin to acquire the book.
"""

from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.agents.tools import check_book_exists, create_book_request, search_book_catalog

BOOK_REQUEST_PROMPT = """You are a helpful library assistant. A user is looking for one or more specific books 
that we don't currently have in our library.

Chat History:
{history}

User's message: {query}

Compose a friendly response that:
- Acknowledges their interest in the requested books (mention the book titles)
- Confirms we've notified the admin about their request
- Suggests similar books from our catalog if available

Available alternatives from our catalog:
{alternatives}

CRITICAL: ONLY provide the conversational response. Do NOT output your internal thinking, numbering, or step-by-step extraction. Speak directly to the user."""


async def handle_book_request(query: str, user_id: str, username: str, chat_history: list = None) -> dict:
    """
    Handle a request for a book not in our library.
    Extracts book info, creates request, and responds helpfully.
    """
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.5,
    )

    history_str = ""
    if chat_history:
        for msg in chat_history[-4:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:300]
            history_str += f"{role}: {content}\n"

    # First, try to extract book titles from the query and history
    extract_prompt = f"""Extract the book titles and authors from this message and context. 
If the user mentions "those 3 books" or similar, use the Chat History to find out which books they mean.
Respond with ONLY a JSON object containing a "books" array: {{"books": [{{"title": "Book Title", "author": "Author Name or null"}}]}}

Chat History:
{history_str}

Message: {query}"""

    extract_response = await llm.ainvoke(extract_prompt)
    
    import json
    books_to_request = []
    try:
        content = extract_response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        parsed = json.loads(content)
        books_to_request = parsed.get("books", [])
    except (json.JSONDecodeError, IndexError):
        pass

    if not books_to_request:
        books_to_request = [{"title": query[:100], "author": None}]

    # Create the book requests
    results = []
    for b in books_to_request:
        title = b.get("title") or "Unknown Book"
        author = b.get("author")
        request_result = await create_book_request(
            user_id=user_id,
            username=username,
            book_title=title,
            author=author,
            reason=query,
        )
        results.append(request_result)

    # Search for alternatives
    alternatives = await search_book_catalog(query)
    alt_str = "\n".join(
        f"- {a['title']} by {a['author']} (Genre: {a.get('genre', 'N/A')})"
        for a in alternatives[:5]
    ) if alternatives else "No similar books currently available."

    # Generate response
    prompt = BOOK_REQUEST_PROMPT.format(query=query, alternatives=alt_str, history=history_str)
    response = await llm.ainvoke(prompt)

    # Extract recommended books
    sources = []
    for a in alternatives[:5]:
        if a["title"].lower() in response.content.lower():
            sources.append({"book_id": a["id"], "book_title": a["title"], "author": a["author"]})

    prompt_tokens = len(prompt.split()) + len(extract_prompt.split())
    completion_tokens = len(response.content.split()) + len(extract_response.content.split())

    return {
        "response": response.content,
        "agent": "book_request",
        "sources": sources,
        "book_requests": results,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }
