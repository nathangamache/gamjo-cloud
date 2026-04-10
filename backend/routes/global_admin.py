"""Global admin routes (not trip-scoped).
Add to main.py: from routes import global_admin
app.include_router(global_admin.router, prefix="/api")
"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
import os, shutil
from database import get_db
from models.models import User, Trip, TripMember, MemberRole
from utils.deps import get_current_user

router = APIRouter(prefix="/global-admin", tags=["global-admin"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")


async def require_global_admin(user: User, db: AsyncSession):
    """User is global admin if they're admin on any trip."""
    result = await db.execute(
        select(TripMember).where(
            TripMember.user_id == user.id,
            TripMember.role == MemberRole.admin
        )
    )
    if not result.first():
        raise HTTPException(403, "Admin access required")


@router.get("/users")
async def list_all_users(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all users with their trip memberships."""
    await require_global_admin(user, db)

    # Get all users
    users_result = await db.execute(select(User).order_by(User.name))
    all_users = users_result.scalars().all()

    # Get all trip memberships with trip names
    memberships_result = await db.execute(
        select(TripMember, Trip).join(Trip, Trip.id == TripMember.trip_id)
    )
    memberships = memberships_result.all()

    # Build user -> trips map
    user_trips = {}
    for tm, trip in memberships:
        if tm.user_id not in user_trips:
            user_trips[tm.user_id] = []
        user_trips[tm.user_id].append({
            "trip_id": trip.id,
            "trip_name": trip.name,
            "role": tm.role.value if hasattr(tm.role, 'value') else str(tm.role),
        })

    return [{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "avatar_url": getattr(u, 'avatar_url', None),
        "created_at": str(u.created_at) if hasattr(u, 'created_at') and u.created_at else None,
        "trips": user_trips.get(u.id, []),
    } for u in all_users]


@router.put("/users/{user_id}")
@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update any user's name or email (global admin)."""
    await require_global_admin(user, db)
    data = await request.json()

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    if "name" in data:
        target.name = data["name"]
    if "email" in data and data["email"]:
        new_email = data["email"].strip().lower()
        if new_email != target.email:
            existing = await db.execute(select(User).where(User.email == new_email))
            if existing.scalar_one_or_none():
                raise HTTPException(400, "Email already in use")
            target.email = new_email

    await db.commit()
    await db.refresh(target)
    return {"id": target.id, "name": target.name, "email": target.email}


@router.post("/users/{user_id}/photo")
async def upload_user_photo(
    user_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload photo for any user (global admin)."""
    await require_global_admin(user, db)
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    os.makedirs(f"{UPLOAD_DIR}/avatars", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{user_id}{ext}"
    filepath = f"{UPLOAD_DIR}/avatars/{filename}"
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/uploads/avatars/{filename}"
    if hasattr(target, 'avatar_url'):
        target.avatar_url = url
    await db.commit()
    return {"url": url}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user entirely (removes from all trips). Global admin only."""
    await require_global_admin(user, db)
    if user_id == user.id:
        raise HTTPException(400, "Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    uid = str(user_id)

    # Delete sessions first (FK constraint)
    await db.execute(text("DELETE FROM sessions WHERE user_id = :uid"), {"uid": uid})

    # Delete activity log entries
    await db.execute(text("DELETE FROM activity_log WHERE user_id = :uid"), {"uid": uid})

    # Delete itinerary votes
    await db.execute(text("DELETE FROM itinerary_votes WHERE user_id = :uid"), {"uid": uid})

    # Remove from all trips
    from models.models import GroupMember, ExpenseGroup
    trip_members = await db.execute(select(TripMember).where(TripMember.user_id == user_id))
    for tm in trip_members.scalars().all():
        # Remove from groups in this trip
        gm_result = await db.execute(
            select(GroupMember).join(ExpenseGroup).where(
                ExpenseGroup.trip_id == tm.trip_id, GroupMember.user_id == user_id
            )
        )
        for gm in gm_result.scalars().all():
            await db.delete(gm)
        await db.delete(tm)

    await db.delete(target)
    await db.commit()
    return {"message": "User deleted"}


@router.get("/check")
async def check_global_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if current user is a global admin."""
    result = await db.execute(
        select(TripMember).where(
            TripMember.user_id == user.id,
            TripMember.role == MemberRole.admin
        )
    )
    return {"is_global_admin": result.first() is not None}