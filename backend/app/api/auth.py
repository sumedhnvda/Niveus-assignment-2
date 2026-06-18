"""Auth routes — User management for admins."""

from fastapi import APIRouter, HTTPException, Depends
from app.schemas.schemas import UserResponse, UserFlagRequest
from app.models.user import User
from app.middleware.auth import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_flagged=user.is_flagged,
        flag_reason=user.flag_reason,
        created_at=user.created_at,
        favorite_genres=user.favorite_genres,
    )


# ─── Admin User Management ──────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(admin: User = Depends(require_admin)):
    users = await User.find_all().to_list()
    return [
        UserResponse(
            id=str(u.id),
            username=u.username,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            is_flagged=u.is_flagged,
            flag_reason=u.flag_reason,
            created_at=u.created_at,
            favorite_genres=u.favorite_genres,
        )
        for u in users
    ]


@router.put("/users/{user_id}/flag")
async def flag_user(user_id: str, data: UserFlagRequest, admin: User = Depends(require_admin)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_flagged = data.is_flagged
    user.flag_reason = data.flag_reason
    await user.save()
    return {"message": f"User {'flagged' if data.is_flagged else 'unflagged'} successfully"}


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await user.save()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}
    
@router.put("/users/{user_id}/make-admin")
async def make_admin(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = "admin"
    await user.save()
    return {"message": "User is now an admin"}
