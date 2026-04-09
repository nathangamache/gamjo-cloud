from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.auth import get_session_user
from models.models import User


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = await get_session_user(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user