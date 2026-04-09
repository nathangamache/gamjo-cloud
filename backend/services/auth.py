import secrets
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.models import User, MagicToken, Session as SessionModel
from config import get_settings

settings = get_settings()


def generate_token(length: int = 64) -> str:
    return secrets.token_urlsafe(length)


async def get_or_create_user(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def create_magic_token(db: AsyncSession, email: str, trip_id: uuid.UUID | None = None) -> str:
    token = generate_token()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.magic_link_expiry_minutes)
    magic = MagicToken(email=email, token=token, trip_id=trip_id, expires_at=expires)
    db.add(magic)
    await db.commit()
    return token


async def verify_magic_token(db: AsyncSession, token: str) -> MagicToken | None:
    result = await db.execute(
        select(MagicToken).where(
            MagicToken.token == token,
            MagicToken.used == False,
            MagicToken.expires_at > datetime.now(timezone.utc),
        )
    )
    magic = result.scalar_one_or_none()
    if magic:
        magic.used = True
        await db.commit()
    return magic


async def create_session(db: AsyncSession, user_id: uuid.UUID) -> str:
    token = generate_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.session_expiry_days)
    session = SessionModel(user_id=user_id, token=token, expires_at=expires)
    db.add(session)
    await db.commit()
    return token


async def get_session_user(db: AsyncSession, token: str) -> User | None:
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.token == token,
            SessionModel.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    return session.user


async def delete_session(db: AsyncSession, token: str):
    await db.execute(delete(SessionModel).where(SessionModel.token == token))
    await db.commit()