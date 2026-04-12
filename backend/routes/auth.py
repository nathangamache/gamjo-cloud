"""Auth routes with 6-digit code verification.
Replace backend/routes/auth.py with this file.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4
from datetime import datetime, timedelta
import os, shutil, secrets, random
from database import get_db
from models.models import User, MagicToken, Session
from utils.deps import get_current_user
from services.email import send_login_code_email
from config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
settings = get_settings()
TOKEN_EXPIRY_MINUTES = settings.magic_link_expiry_minutes
SESSION_DAYS = settings.session_expiry_days


def generate_code():
    """Generate a 6-digit numeric code."""
    return f"{random.randint(0, 999999):06d}"


@router.post("/send-code")
async def send_code(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Send a 6-digit login code via email. Same response regardless of email existence."""
    data = await request.json()
    email = data.get("email", "").strip().lower()

    if not email or "@" not in email:
        return {"message": "If your email is registered, you'll receive a login code."}

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        code = generate_code()
        # Store code as token in MagicToken table
        magic_token = MagicToken(
            id=uuid4(),
            email=user.email,
            token=code,
            expires_at=datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
        )
        db.add(magic_token)
        await db.commit()

        try:
            await send_login_code_email(user.email, user.name or "there", code)
        except Exception as e:
            print(f"Failed to send code email: {e}")

    return {"message": "If your email is registered, you'll receive a login code."}


@router.post("/verify-code")
async def verify_code(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Verify a 6-digit code and create a session."""
    data = await request.json()
    email = data.get("email", "").strip().lower()
    code = data.get("code", "").strip()

    if not email or not code or len(code) != 6:
        raise HTTPException(400, "Invalid code")

    # Find the most recent unused code for this email
    result = await db.execute(
        select(MagicToken).where(
            MagicToken.email == email,
            MagicToken.token == code,
            MagicToken.expires_at > datetime.utcnow(),
            MagicToken.used == False
        )
    )
    magic_token = result.scalar_one_or_none()

    if not magic_token:
        raise HTTPException(400, "Invalid or expired code")

    magic_token.used = True

    # Look up user
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "User not found")

    # Create session
    session_token = secrets.token_urlsafe(48)
    session = Session(
        id=uuid4(),
        user_id=user.id,
        token=session_token,
        expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS),
    )
    db.add(session)
    await db.commit()

    is_https = settings.app_url.startswith("https")
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=is_https,
    )
    return {"message": "Logged in successfully"}


# Keep legacy magic-link endpoint for backward compat (invite emails still use links)
@router.post("/magic-link")
async def send_magic_link(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Legacy: redirect to send-code."""
    data = await request.json()
    # Just forward to send-code
    email = data.get("email", "").strip().lower()
    if not email or "@" not in email:
        return {"message": "If your email is registered, you'll receive a login code."}
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        code = generate_code()
        magic_token = MagicToken(id=uuid4(), email=user.email, token=code,
                                  expires_at=datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES))
        db.add(magic_token)
        await db.commit()
        try:
            await send_login_code_email(user.email, user.name or "there", code)
        except Exception as e:
            print(f"Failed to send code: {e}")
    return {"message": "If your email is registered, you'll receive a login code."}


# Keep legacy verify endpoint for any old links still in inboxes
@router.get("/verify")
async def verify_token(
    token: str,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Legacy link verification - still works for old magic links."""
    result = await db.execute(
        select(MagicToken).where(
            MagicToken.token == token,
            MagicToken.expires_at > datetime.utcnow(),
            MagicToken.used == False
        )
    )
    magic_token = result.scalar_one_or_none()
    if not magic_token:
        raise HTTPException(400, "Invalid or expired token")
    magic_token.used = True

    user_result = await db.execute(select(User).where(User.email == magic_token.email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "User not found")

    session_token = secrets.token_urlsafe(48)
    session = Session(id=uuid4(), user_id=user.id, token=session_token,
                      expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS))
    db.add(session)
    await db.commit()

    is_https = settings.app_url.startswith("https")
    response.set_cookie(key="session_token", value=session_token, max_age=SESSION_DAYS * 86400,
                        httponly=True, samesite="lax", secure=is_https)
    return {"message": "Logged in successfully"}


@router.get("/me")
async def get_me(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Read preference columns directly from DB (may not be on ORM model)
    prefs = {"theme": "light", "reduce_motion": False, "a11y_mode": False}
    try:
        result = await db.execute(
            text("SELECT theme, reduce_motion, a11y_mode FROM users WHERE id = :uid"),
            {"uid": str(user.id)}
        )
        row = result.fetchone()
        if row:
            prefs["theme"] = row[0] or "light"
            prefs["reduce_motion"] = bool(row[1])
            prefs["a11y_mode"] = bool(row[2])
    except Exception:
        pass
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "avatar_url": getattr(user, 'avatar_url', None),
        "onboarded": getattr(user, 'onboarded', True),
        "theme": prefs["theme"],
        "reduce_motion": prefs["reduce_motion"],
        "a11y_mode": prefs["a11y_mode"],
        "created_at": str(user.created_at) if hasattr(user, 'created_at') and user.created_at else None,
    }


@router.patch("/me")
@router.put("/me")
async def update_me(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await request.json()
    if "name" in data:
        user.name = data["name"]
    if "onboarded" in data and hasattr(user, 'onboarded'):
        user.onboarded = data["onboarded"]
    await db.commit()
    await db.refresh(user)

    # Save preferences via raw SQL (columns may not be on ORM model)
    pref_updates = {}
    if "theme" in data:
        pref_updates["theme"] = data["theme"]
    if "reduce_motion" in data:
        pref_updates["reduce_motion"] = bool(data["reduce_motion"])
    if "a11y_mode" in data:
        pref_updates["a11y_mode"] = bool(data["a11y_mode"])
    if pref_updates:
        set_clauses = ", ".join(f"{k} = :{k}" for k in pref_updates)
        pref_updates["uid"] = str(user.id)
        await db.execute(
            text(f"UPDATE users SET {set_clauses} WHERE id = :uid"),
            pref_updates
        )
        await db.commit()

    # Read back current preferences
    prefs = {"theme": "light", "reduce_motion": False, "a11y_mode": False}
    try:
        result = await db.execute(
            text("SELECT theme, reduce_motion, a11y_mode FROM users WHERE id = :uid"),
            {"uid": str(user.id)}
        )
        row = result.fetchone()
        if row:
            prefs["theme"] = row[0] or "light"
            prefs["reduce_motion"] = bool(row[1])
            prefs["a11y_mode"] = bool(row[2])
    except Exception:
        pass

    return {
        "id": user.id, "name": user.name, "email": user.email,
        "avatar_url": getattr(user, 'avatar_url', None),
        "onboarded": getattr(user, 'onboarded', True),
        "theme": prefs["theme"],
        "reduce_motion": prefs["reduce_motion"],
        "a11y_mode": prefs["a11y_mode"],
    }


@router.post("/me/photo")
async def upload_profile_photo(file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    os.makedirs(f"{UPLOAD_DIR}/avatars", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{user.id}{ext}"
    filepath = f"{UPLOAD_DIR}/avatars/{filename}"
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/uploads/avatars/{filename}?t={int(__import__('time').time())}"
    if hasattr(user, 'avatar_url'):
        user.avatar_url = f"/uploads/avatars/{filename}"
    await db.commit()
    return {"avatar_url": url, "message": "Photo uploaded"}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_token")
    if session_token:
        result = await db.execute(select(Session).where(Session.token == session_token))
        sess = result.scalar_one_or_none()
        if sess:
            await db.delete(sess)
            await db.commit()
    response.delete_cookie("session_token")
    return {"message": "Logged out"}