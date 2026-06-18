"""
LangGraph Agent Graph — Orchestrates the multi-agent system.

Flow:
  User Message → Moderator → Supervisor (classify) → Specialist Agent → Response

The graph uses a state machine pattern with conditional routing.
All LLM usage is tracked for admin analytics.
Response caching is implemented to reduce costs.
"""

import time
import logging
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END

from app.agents.moderator import moderate_message
from app.agents.supervisor import classify_intent, generate_general_response
from app.agents.recommender import recommend_books
from app.agents.rag_qa import rag_answer
from app.agents.book_request import handle_book_request
from app.agents.summarizer import summarize_book
from app.agents.tools import check_book_exists
from app.services.tracker import log_llm_usage, generate_cache_key, get_cached_response
from app.models.analytics import ModerationLog
from app.models.chat import ChatMessage

logger = logging.getLogger(__name__)


# ─── State Definition ─────────────────────────────

class AgentState(TypedDict):
    """State that flows through the agent graph."""
    # Input
    message: str
    user_id: str
    username: str
    session_id: str
    chat_history: list[dict]
    book_id: str  # Optional: for book-specific queries

    # Processing
    moderation_result: dict
    classification: dict
    target_agent: str

    # Output
    response: str
    agent_used: str
    sources: list[dict]
    is_blocked: bool
    from_cache: bool

    # Tracking
    total_prompt_tokens: int
    total_completion_tokens: int


# ─── Node Functions ───────────────────────────────

async def moderate_node(state: AgentState) -> dict:
    """Step 1: Moderate the message."""
    start = time.time()
    result = await moderate_message(state["message"])
    latency = int((time.time() - start) * 1000)

    # Log moderator usage
    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="moderator",
        query=state["message"],
        response=str(result),
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    # If flagged, create moderation log
    if not result.get("is_safe", True):
        await ModerationLog(
            user_id=state["user_id"],
            username=state["username"],
            message=state["message"],
            flag_type=result.get("flag_type", "unknown"),
            severity=result.get("severity", "low"),
            agent_reasoning=result.get("reasoning", ""),
            action_taken="blocked" if result.get("severity") == "high" else "logged",
        ).insert()

    return {
        "moderation_result": result,
        "is_blocked": not result.get("is_safe", True) and result.get("severity") == "high",
        "total_prompt_tokens": result.get("prompt_tokens", 0),
        "total_completion_tokens": result.get("completion_tokens", 0),
    }

async def classify_node(state: AgentState) -> dict:
    """Step 2: Classify intent and determine routing."""
    start = time.time()
    classification = await classify_intent(state["message"], state.get("chat_history", []), state.get("book_id"))
    latency = int((time.time() - start) * 1000)

    target = classification.get("agent", "general")

    # If we need to check book existence for routing
    if classification.get("needs_book_check") and target == "book_request":
        extracted_title = classification.get("book_title")
        if extracted_title and extracted_title.strip().lower() not in ["null", "none", ""]:
            exists = await check_book_exists(extracted_title)
            if exists:
                # User asked for a book that WE ACTUALLY HAVE, route to general
                # so the agent can inform the user that we DO have the book.
                target = "general"
        else:
            # Fallback if no title extracted but requested check
            exists = await check_book_exists(state["message"])
            if exists:
                target = "general"

    # Log supervisor usage
    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="supervisor",
        query=state["message"],
        response=str(classification),
        prompt_tokens=classification.get("prompt_tokens", 0),
        completion_tokens=classification.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "classification": classification,
        "target_agent": target,
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + classification.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + classification.get("completion_tokens", 0),
    }


async def recommender_node(state: AgentState) -> dict:
    """Route to book recommender."""
    start = time.time()
    result = await recommend_books(state["message"])
    latency = int((time.time() - start) * 1000)

    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="recommender",
        query=state["message"],
        response=result["response"][:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "response": result["response"],
        "agent_used": "recommender",
        "sources": result.get("sources", []),
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def rag_qa_node(state: AgentState) -> dict:
    """Route to RAG QA agent."""
    start = time.time()
    query = state["message"]
    classification = state.get("classification", {})
    extracted_title = classification.get("book_title")
    if extracted_title and extracted_title.lower() not in ["none", "null", ""]:
        query = f"{query} (Book Context: {extracted_title})"
        
    result = await rag_answer(
        query=query, 
        book_id=state.get("book_id"),
        chat_history=state.get("chat_history", [])
    )
    latency = int((time.time() - start) * 1000)

    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="rag_qa",
        query=state["message"],
        response=result["response"][:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "response": result["response"],
        "agent_used": "rag_qa",
        "sources": result.get("sources", []),
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def book_request_node(state: AgentState) -> dict:
    """Route to book request agent."""
    start = time.time()
    result = await handle_book_request(state["message"], state["user_id"], state["username"], chat_history=state.get("chat_history", []))
    latency = int((time.time() - start) * 1000)

    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="book_request",
        query=state["message"],
        response=result["response"][:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "response": result["response"],
        "agent_used": "book_request",
        "sources": [],
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def summarizer_node(state: AgentState) -> dict:
    """Route to summary agent."""
    book_id = state.get("book_id")
    
    # If no book_id (global chat), try to resolve it from the extracted title
    if not book_id:
        classification = state.get("classification", {})
        extracted_title = classification.get("book_title")
        if extracted_title and extracted_title.lower() not in ["none", "null", ""]:
            from app.agents.tools import search_book_catalog
            results = await search_book_catalog(extracted_title)
            if results:
                book_id = results[0]["id"]

    if not book_id:
        return {
            "response": "Please specify which book you'd like me to summarize. You can click the 'Summarize' button on any book page, or tell me the book title.",
            "agent_used": "summarizer",
            "sources": [],
        }

    start = time.time()
    result = await summarize_book(book_id)
    latency = int((time.time() - start) * 1000)

    if not result.get("from_cache", False):
        await log_llm_usage(
            user_id=state["user_id"],
            username=state["username"],
            agent_name="summarizer",
            query=f"Summarize book {book_id}",
            response=result["response"][:200],
            prompt_tokens=result.get("prompt_tokens", 0),
            completion_tokens=result.get("completion_tokens", 0),
            latency_ms=latency,
        )

    return {
        "response": result["response"],
        "agent_used": "summarizer",
        "sources": result.get("sources", []),
        "from_cache": result.get("from_cache", False),
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def quiz_node(state: AgentState) -> dict:
    """Route to quiz agent."""
    book_id = state.get("book_id")
    
    # If no book_id (global chat), try to resolve it from the extracted title
    if not book_id:
        classification = state.get("classification", {})
        extracted_title = classification.get("book_title")
        if extracted_title and extracted_title.lower() not in ["none", "null", ""]:
            from app.agents.tools import search_book_catalog
            results = await search_book_catalog(extracted_title)
            if results:
                book_id = results[0]["id"]

    if not book_id:
        return {
            "response": "Please specify which book you'd like me to quiz you on. You can open a book and click 'Quiz Me' or mention the book title.",
            "agent_used": "quiz",
            "sources": [],
        }

    start = time.time()
    from app.agents.quiz import chat_quiz
    result = await chat_quiz(state["message"], state.get("chat_history", []), book_id)
    latency = int((time.time() - start) * 1000)

    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="quiz",
        query=f"Quiz for book {book_id}",
        response=result.get("response", "")[:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "response": result.get("response", ""),
        "agent_used": "quiz",
        "sources": result.get("sources", []),
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def general_node(state: AgentState) -> dict:
    """Route to general conversation handler."""
    start = time.time()
    result = await generate_general_response(state["message"], state.get("chat_history", []))
    latency = int((time.time() - start) * 1000)

    await log_llm_usage(
        user_id=state["user_id"],
        username=state["username"],
        agent_name="general",
        query=state["message"],
        response=result["response"][:200],
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        latency_ms=latency,
    )

    return {
        "response": result["response"],
        "agent_used": "general",
        "sources": [],
        "total_prompt_tokens": state.get("total_prompt_tokens", 0) + result.get("prompt_tokens", 0),
        "total_completion_tokens": state.get("total_completion_tokens", 0) + result.get("completion_tokens", 0),
    }


async def blocked_node(state: AgentState) -> dict:
    """Handle blocked messages."""
    return {
        "response": "I'm sorry, but I can't process that message as it appears to violate our content policy. "
                     "Please keep our conversation focused on books, reading, and the library platform.",
        "agent_used": "moderator",
        "sources": [],
        "is_blocked": True,
    }


# ─── Routing Functions ────────────────────────────

def route_after_moderation(state: AgentState) -> str:
    if state.get("is_blocked"):
        return "blocked"
    return "classify"


def route_to_agent(state: AgentState) -> str:
    target = state.get("target_agent", "general")
    valid_agents = ["recommender", "rag_qa", "book_request", "summarizer", "quiz", "general"]
    if target not in valid_agents:
        return "general"
    return target


# ─── Build the Graph ──────────────────────────────

def build_agent_graph() -> StateGraph:
    """Build and compile the LangGraph agent graph."""

    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("moderate", moderate_node)
    graph.add_node("classify", classify_node)
    graph.add_node("recommender", recommender_node)
    graph.add_node("rag_qa", rag_qa_node)
    graph.add_node("book_request", book_request_node)
    graph.add_node("summarizer", summarizer_node)
    graph.add_node("quiz", quiz_node)
    graph.add_node("general", general_node)
    graph.add_node("blocked", blocked_node)

    # Set entry point
    graph.set_entry_point("moderate")

    # Add conditional edges
    graph.add_conditional_edges(
        "moderate",
        route_after_moderation,
        {"blocked": "blocked", "classify": "classify"},
    )

    graph.add_conditional_edges(
        "classify",
        route_to_agent,
        {
            "recommender": "recommender",
            "rag_qa": "rag_qa",
            "book_request": "book_request",
            "summarizer": "summarizer",
            "quiz": "quiz",
            "general": "general",
        },
    )

    # All specialist nodes lead to END
    graph.add_edge("recommender", END)
    graph.add_edge("rag_qa", END)
    graph.add_edge("book_request", END)
    graph.add_edge("summarizer", END)
    graph.add_edge("quiz", END)
    graph.add_edge("general", END)
    graph.add_edge("blocked", END)

    return graph.compile()


# Singleton compiled graph
_compiled_graph = None


def get_agent_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_agent_graph()
    return _compiled_graph


async def run_agent_pipeline(
    message: str,
    user_id: str,
    username: str,
    session_id: str,
    chat_history: list[dict] = None,
    book_id: str = None,
) -> dict:
    """
    Main entry point: run a message through the full agent pipeline.
    Returns the final response with agent attribution and sources.
    """
    graph = get_agent_graph()

    initial_state: AgentState = {
        "message": message,
        "user_id": user_id,
        "username": username,
        "session_id": session_id,
        "chat_history": chat_history or [],
        "book_id": book_id or "",
        "moderation_result": {},
        "classification": {},
        "target_agent": "",
        "response": "",
        "agent_used": "",
        "sources": [],
        "is_blocked": False,
        "from_cache": False,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
    }

    result = await graph.ainvoke(initial_state)

    # Cache the response for future identical queries
    if not result.get("is_blocked") and not result.get("from_cache"):
        cache_key = generate_cache_key(message, "any", book_id or "")
        # Save as assistant message with cache key
        await ChatMessage(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=result.get("response", ""),
            agent_used=result.get("agent_used", ""),
            sources=result.get("sources", []),
            cache_key=cache_key,
        ).insert()

    return {
        "response": result.get("response", "Something went wrong. Please try again."),
        "agent_used": result.get("agent_used", "unknown"),
        "sources": result.get("sources", []),
        "session_id": session_id,
        "is_blocked": result.get("is_blocked", False),
        "from_cache": result.get("from_cache", False),
    }
