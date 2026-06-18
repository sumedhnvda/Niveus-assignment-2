"""Chat routes — REST-based chat endpoint with agent pipeline integration."""

from fastapi import APIRouter, HTTPException, Depends
from app.schemas.schemas import ChatRequest, ChatResponse, ChatSessionResponse
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.middleware.auth import get_current_user
from app.agents.graph import run_agent_pipeline
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def send_message(data: ChatRequest, user: User = Depends(get_current_user)):
    """Send a message through the agent pipeline."""

    # Check if user is flagged
    if user.is_flagged:
        raise HTTPException(
            status_code=403,
            detail="Your account has been flagged. Please contact the administrator."
        )

    # Get or create session
    session_id = data.session_id
    if session_id:
        session = await ChatSession.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session = ChatSession(
            user_id=str(user.id),
            book_id=data.book_id or "global",
            title=data.message[:50] + "..." if len(data.message) > 50 else data.message,
        )
        await session.insert()
        session_id = str(session.id)

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        user_id=str(user.id),
        role="user",
        content=data.message,
    )
    await user_msg.insert()

    # Get chat history for context
    history_msgs = await ChatMessage.find(
        ChatMessage.session_id == session_id,
    ).sort("created_at").limit(20).to_list()

    chat_history = [
        {"role": m.role, "content": m.content}
        for m in history_msgs
    ]

    # Run through agent pipeline
    try:
        result = await run_agent_pipeline(
            message=data.message,
            user_id=str(user.id),
            username=user.username,
            session_id=session_id,
            chat_history=chat_history,
            book_id=data.book_id,
        )
    except Exception as e:
        # Save error as assistant message
        error_msg = ChatMessage(
            session_id=session_id,
            user_id=str(user.id),
            role="assistant",
            content=f"I encountered an error processing your request. Please try again.",
            agent_used="error",
        )
        await error_msg.insert()
        raise HTTPException(status_code=500, detail=str(e))

    # Update session
    session.updated_at = datetime.utcnow()
    await session.save()

    return ChatResponse(
        response=result["response"],
        agent_used=result["agent_used"],
        sources=result.get("sources", []),
        session_id=session_id,
    )


@router.post("/summarize/{book_id}", response_model=ChatResponse)
async def summarize_book_endpoint(book_id: str, user: User = Depends(get_current_user)):
    """Direct endpoint for book summarization (triggered by Summarize button on book page)."""
    from app.agents.summarizer import summarize_book
    from app.services.tracker import log_llm_usage
    import time

    start = time.time()
    result = await summarize_book(book_id)
    latency = int((time.time() - start) * 1000)

    # Log only if not from cache
    if not result.get("from_cache", False):
        await log_llm_usage(
            user_id=str(user.id),
            username=user.username,
            agent_name="summarizer",
            query=f"Summarize book {book_id}",
            response=result["response"][:200],
            prompt_tokens=result.get("prompt_tokens", 0),
            completion_tokens=result.get("completion_tokens", 0),
            latency_ms=latency,
        )

    return ChatResponse(
        response=result["response"],
        agent_used="summarizer",
        sources=result.get("sources", []),
        session_id="",
    )

@router.post("/quiz/{book_id}", response_model=ChatResponse)
async def generate_quiz_endpoint(book_id: str, user: User = Depends(get_current_user)):
    """Generate a quiz for a specific book."""
    from app.agents.quiz import generate_quiz
    from app.services.tracker import log_llm_usage
    import time
    
    start = time.time()
    result = await generate_quiz(book_id)
    latency = int((time.time() - start) * 1000)
    
    await log_llm_usage(
        user_id=str(user.id),
        username=user.username,
        agent_name="quiz",
        query=f"Quiz for book {book_id}",
        response=result.get("response", "")[:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )
    
    return ChatResponse(
        response=result.get("response", "Failed to generate quiz."),
        agent_used="quiz",
        sources=result.get("sources", []),
        session_id="",
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def get_sessions(book_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get all chat sessions for the current user."""
    query = [
        ChatSession.user_id == str(user.id),
        ChatSession.is_active == True,
    ]
    
    if book_id == "global":
        query.append({"$or": [{"book_id": "global"}, {"book_id": None}]})
    elif book_id:
        query.append(ChatSession.book_id == book_id)
        
    sessions = await ChatSession.find(*query).sort("-updated_at").to_list()

    return [
        ChatSessionResponse(
            id=str(s.id),
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, user: User = Depends(get_current_user)):
    """Get all messages for a chat session."""
    session = await ChatSession.get(session_id)
    if not session or session.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await ChatMessage.find(
        ChatMessage.session_id == session_id,
    ).sort("created_at").to_list()

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "agent_used": m.agent_used,
            "sources": m.sources,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: User = Depends(get_current_user)):
    """Delete a chat session."""
    session = await ChatSession.get(session_id)
    if not session or session.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    await session.save()
    return {"message": "Session deleted"}
