"""
LLM Usage Tracker — Logs every LLM call for admin analytics.
Provides caching to reduce redundant LLM calls.
"""

import time
import hashlib
from datetime import datetime, timedelta
from app.models.analytics import LLMUsageLog
from app.models.chat import ChatMessage


async def log_llm_usage(
    user_id: str,
    username: str,
    agent_name: str,
    query: str,
    response: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = 0,
    model_name: str = "gemini-2.0-flash",
    status: str = "success",
):
    """Log an LLM usage event."""
    log = LLMUsageLog(
        user_id=user_id,
        username=username,
        agent_name=agent_name,
        model_name=model_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        query=query[:500],  # Truncate long queries
        response_preview=response[:200],
        latency_ms=latency_ms,
        status=status,
    )
    await log.insert()
    return log


def generate_cache_key(query: str, agent_name: str, context_id: str = "") -> str:
    """Generate a deterministic cache key for a query."""
    raw = f"{agent_name}:{context_id}:{query.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_cached_response(cache_key: str) -> str | None:
    """
    Check if we have a cached response for this exact query.
    Returns the cached response content or None.
    """
    cached = await ChatMessage.find_one(
        ChatMessage.cache_key == cache_key,
        ChatMessage.role == "assistant",
    )
    if cached:
        return cached.content
    return None


async def get_analytics_summary(days: int = 30) -> dict:
    """Generate analytics summary for admin dashboard."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Total queries and tokens
    all_logs = await LLMUsageLog.find(
        LLMUsageLog.created_at >= cutoff
    ).to_list()

    today_logs = [l for l in all_logs if l.created_at >= today_start]

    total_queries = len(all_logs)
    total_tokens = sum(l.total_tokens for l in all_logs)
    queries_today = len(today_logs)
    tokens_today = sum(l.total_tokens for l in today_logs)

    # Agent breakdown
    agent_breakdown = {}
    for log in all_logs:
        if log.agent_name not in agent_breakdown:
            agent_breakdown[log.agent_name] = {"queries": 0, "tokens": 0}
        agent_breakdown[log.agent_name]["queries"] += 1
        agent_breakdown[log.agent_name]["tokens"] += log.total_tokens

    # Top users
    user_stats = {}
    for log in all_logs:
        key = log.user_id
        if key not in user_stats:
            user_stats[key] = {"user_id": log.user_id, "username": log.username, "queries": 0, "tokens": 0}
        user_stats[key]["queries"] += 1
        user_stats[key]["tokens"] += log.total_tokens
    top_users = sorted(user_stats.values(), key=lambda x: x["tokens"], reverse=True)[:10]

    # Daily trend (last 7 days)
    daily_trend = []
    for i in range(min(7, days)):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_logs = [l for l in all_logs if day <= l.created_at < day_end]
        daily_trend.append({
            "date": day.strftime("%Y-%m-%d"),
            "queries": len(day_logs),
            "tokens": sum(l.total_tokens for l in day_logs),
        })
    daily_trend.reverse()

    return {
        "total_queries": total_queries,
        "total_tokens": total_tokens,
        "queries_today": queries_today,
        "tokens_today": tokens_today,
        "agent_breakdown": agent_breakdown,
        "top_users": top_users,
        "daily_trend": daily_trend,
    }
