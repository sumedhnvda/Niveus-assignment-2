"""Analytics routes — LLM usage tracking, moderation logs."""

from fastapi import APIRouter, HTTPException, Depends
from app.schemas.schemas import (
    LLMUsageResponse,
    AnalyticsSummary,
    ModerationLogResponse,
    BookRequestResponse,
    BookRequestUpdate,
)
from app.models.analytics import LLMUsageLog, BookRequest, ModerationLog
from app.models.user import User
from app.middleware.auth import require_admin
from app.services.tracker import get_analytics_summary
from datetime import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def analytics_summary(days: int = 30, admin: User = Depends(require_admin)):
    return await get_analytics_summary(days=days)


@router.get("/llm-usage", response_model=list[LLMUsageResponse])
async def get_llm_usage(
    agent_name: str = None,
    user_id: str = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
):
    query = {}
    if agent_name:
        query["agent_name"] = agent_name
    if user_id:
        query["user_id"] = user_id

    logs = await LLMUsageLog.find(query).sort("-created_at").limit(limit).to_list()

    return [
        LLMUsageResponse(
            id=str(l.id),
            user_id=l.user_id,
            username=l.username,
            agent_name=l.agent_name,
            model_name=l.model_name,
            prompt_tokens=l.prompt_tokens,
            completion_tokens=l.completion_tokens,
            total_tokens=l.total_tokens,
            query=l.query,
            latency_ms=l.latency_ms,
            status=l.status,
            created_at=l.created_at,
        )
        for l in logs
    ]


# ─── Book Requests ────────────────────────────────

@router.get("/book-requests", response_model=list[BookRequestResponse])
async def get_book_requests(
    status: str = None,
    admin: User = Depends(require_admin),
):
    query = {}
    if status:
        query["status"] = status

    requests = await BookRequest.find(query).sort("-created_at").to_list()
    return [
        BookRequestResponse(
            id=str(r.id),
            user_id=r.user_id,
            username=r.username,
            book_title=r.book_title,
            author=r.author,
            reason=r.reason,
            status=r.status,
            admin_notes=r.admin_notes,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
        )
        for r in requests
    ]


@router.put("/book-requests/{request_id}")
async def update_book_request(
    request_id: str,
    data: BookRequestUpdate,
    admin: User = Depends(require_admin),
):
    req = await BookRequest.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = data.status
    req.admin_notes = data.admin_notes
    if data.status in ("fulfilled", "rejected"):
        req.resolved_at = datetime.utcnow()
    await req.save()
    return {"message": "Request updated"}


# ─── Moderation Logs ─────────────────────────────

@router.get("/moderation", response_model=list[ModerationLogResponse])
async def get_moderation_logs(
    severity: str = None,
    user_id: str = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
):
    query = {}
    if severity:
        query["severity"] = severity
    if user_id:
        query["user_id"] = user_id

    logs = await ModerationLog.find(query).sort("-created_at").limit(limit).to_list()
    return [
        ModerationLogResponse(
            id=str(l.id),
            user_id=l.user_id,
            username=l.username,
            message=l.message,
            flag_type=l.flag_type,
            severity=l.severity,
            agent_reasoning=l.agent_reasoning,
            action_taken=l.action_taken,
            reviewed_by_admin=l.reviewed_by_admin,
            created_at=l.created_at,
        )
        for l in logs
    ]


@router.put("/moderation/{log_id}/review")
async def review_moderation_log(log_id: str, admin: User = Depends(require_admin)):
    log = await ModerationLog.get(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    log.reviewed_by_admin = True
    await log.save()
    return {"message": "Log marked as reviewed"}
