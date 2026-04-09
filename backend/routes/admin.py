"""Updated admin routes.
Replace backend/routes/admin.py with this file.
Uses MagicToken instead of AuthToken.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets, os, shutil
from database import get_db
from models.models import (
    User, Trip, TripMember, ExpenseGroup, GroupMember,
    MemberRole, MagicToken
)
from utils.deps import get_current_user
from services.email import send_login_code_email, send_welcome_email
from config import get_settings

router = APIRouter(prefix="/admin/{trip_id}", tags=["admin"])

TOKEN_EXPIRY_MINUTES = int(__import__('os').environ.get("TOKEN_EXPIRY_MINUTES", "15"))


async def require_admin(trip_id: UUID, user: User, db: AsyncSession):
    result = await db.execute(
        select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.user_id == user.id,
            TripMember.role == MemberRole.admin
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Admin access required")


# ── People Management ──

@router.get("/all-users")
async def list_all_users(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all users in the system, marking which are already in this trip."""
    await require_admin(trip_id, user, db)
    # Get all users
    all_result = await db.execute(select(User).order_by(User.name))
    all_users = all_result.scalars().all()
    # Get current trip member IDs
    member_result = await db.execute(
        select(TripMember.user_id).where(TripMember.trip_id == trip_id)
    )
    member_ids = {row[0] for row in member_result.all()}
    return [{
        "id": u.id, "name": u.name, "email": u.email,
        "avatar_url": getattr(u, 'avatar_url', None),
        "in_trip": u.id in member_ids,
    } for u in all_users]


@router.post("/invite")
async def invite_user(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    email = data.get("email", "").strip().lower()
    name = data.get("name", "")
    if not email or "@" not in email:
        raise HTTPException(400, "Valid email required")

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email))
    target_user = result.scalar_one_or_none()
    is_new_user = target_user is None

    if not target_user:
        target_user = User(id=uuid4(), email=email, name=name or email.split("@")[0])
        db.add(target_user)
        await db.flush()
    elif name and not target_user.name:
        target_user.name = name

    # Check if already a member
    existing = await db.execute(
        select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == target_user.id)
    )
    if existing.scalar_one_or_none():
        return {"message": "Already a member"}

    member = TripMember(trip_id=trip_id, user_id=target_user.id, role=MemberRole.member)
    db.add(member)
    await db.commit()

    # Only send email to NEW users
    if is_new_user:
        # Fetch trip details for the welcome email
        trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_result.scalar_one_or_none()
        trip_name = trip.name if trip else "a vacation"
        trip_location = getattr(trip, 'location', None) if trip else None
        try:
            await send_welcome_email(
                email,
                name or target_user.name or "there",
                trip_name,
                trip_location
            )
        except Exception as e:
            print(f"Failed to send welcome email: {e}")
        return {"message": f"Invited {email} (welcome email sent)"}

    return {"message": f"Added {email} to trip"}


@router.post("/resend-link")
async def resend_login_link(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    target_user_id = data.get("user_id")
    if not target_user_id:
        raise HTTPException(400, "user_id required")
    result = await db.execute(select(User).where(User.id == UUID(str(target_user_id))))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, "User not found")
    code = f"{__import__('random').randint(0, 999999):06d}"
    magic_token = MagicToken(
        id=uuid4(),
        email=target_user.email,
        token=code,
        expires_at=datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    )
    db.add(magic_token)
    await db.commit()
    try:
        await send_login_code_email(target_user.email, target_user.name or "there", code)
    except Exception as e:
        print(f"Failed to resend code: {e}")
    return {"message": "Login code sent"}


@router.put("/users/{user_id}")
@router.patch("/users/{user_id}")
async def update_user(
    trip_id: UUID,
    user_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if target_user:
        if "name" in data:
            target_user.name = data["name"]
        # A1: Admin can change email (check uniqueness first)
        if "email" in data and data["email"]:
            new_email = data["email"].strip().lower()
            if new_email != target_user.email:
                existing = await db.execute(select(User).where(User.email == new_email))
                if existing.scalar_one_or_none():
                    raise HTTPException(400, "That email is already in use by another member")
                target_user.email = new_email
    if "role" in data:
        result = await db.execute(
            select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == user_id)
        )
        membership = result.scalar_one_or_none()
        if membership:
            membership.role = MemberRole.admin if data["role"] == "admin" else MemberRole.member
    await db.commit()
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def remove_user(
    trip_id: UUID,
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    if user_id == user.id:
        raise HTTPException(400, "Cannot remove yourself")
    result = await db.execute(
        select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == user_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Member not found")
    gm_result = await db.execute(
        select(GroupMember).join(ExpenseGroup, ExpenseGroup.id == GroupMember.group_id)
        .where(ExpenseGroup.trip_id == trip_id, GroupMember.user_id == user_id)
    )
    for gm in gm_result.scalars().all():
        await db.delete(gm)
    await db.delete(membership)
    await db.commit()
    return {"message": "User removed"}


# ── Group Management ──

@router.post("/groups")
async def create_group(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    group = ExpenseGroup(
        id=uuid4(),
        trip_id=trip_id,
        name=data.get("name", "New Group"),
        percentage=data.get("percentage", 0),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return {"id": group.id, "name": group.name, "percentage": float(group.percentage) if group.percentage else 0, "members": []}


@router.put("/groups/{group_id}")
@router.patch("/groups/{group_id}")
async def update_group(
    trip_id: UUID,
    group_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    result = await db.execute(select(ExpenseGroup).where(ExpenseGroup.id == group_id, ExpenseGroup.trip_id == trip_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")
    if "name" in data:
        group.name = data["name"]
    if "percentage" in data:
        group.percentage = data["percentage"]
    await db.commit()
    return {"message": "Group updated"}


@router.delete("/groups/{group_id}")
async def delete_group(
    trip_id: UUID,
    group_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    result = await db.execute(select(ExpenseGroup).where(ExpenseGroup.id == group_id, ExpenseGroup.trip_id == trip_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")
    gm_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    for gm in gm_result.scalars().all():
        await db.delete(gm)
    await db.delete(group)
    await db.commit()
    return {"message": "Group deleted"}


@router.post("/groups/{group_id}/members")
async def add_group_member(
    trip_id: UUID,
    group_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    target_user_id = UUID(str(data.get("user_id")))
    result = await db.execute(select(ExpenseGroup).where(ExpenseGroup.id == group_id, ExpenseGroup.trip_id == trip_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Group not found")
    existing = await db.execute(
        select(GroupMember).join(ExpenseGroup, ExpenseGroup.id == GroupMember.group_id)
        .where(ExpenseGroup.trip_id == trip_id, GroupMember.user_id == target_user_id)
    )
    for gm in existing.scalars().all():
        await db.delete(gm)
    await db.flush()
    gm = GroupMember(group_id=group_id, user_id=target_user_id, is_payer=data.get("is_payer", False))
    db.add(gm)
    await db.commit()
    return {"message": "Member assigned to group"}


@router.put("/groups/{group_id}/members/{member_user_id}")
@router.patch("/groups/{group_id}/members/{member_user_id}")
async def update_group_member(
    trip_id: UUID,
    group_id: UUID,
    member_user_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(trip_id, user, db)
    data = await request.json()
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == member_user_id)
    )
    gm = result.scalar_one_or_none()
    if not gm:
        raise HTTPException(404, "Group member not found")
    if "is_payer" in data:
        gm.is_payer = data["is_payer"]
    await db.commit()
    return {"message": "Payer status updated"}


# ── A2/S3: Admin photo upload for any user ──

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")

@router.post("/users/{user_id}/photo")
async def upload_user_photo(
    trip_id: UUID,
    user_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a profile photo for any user. Admin only."""
    await require_admin(trip_id, user, db)
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, "User not found")

    os.makedirs(f"{UPLOAD_DIR}/avatars", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{user_id}{ext}"
    filepath = f"{UPLOAD_DIR}/avatars/{filename}"

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/uploads/avatars/{filename}"
    if hasattr(target_user, 'avatar_url'):
        target_user.avatar_url = url

    await db.commit()
    return {"url": url, "message": "Photo uploaded"}


# ── A4: Bulk send login links ──

@router.post("/send-all-links")
async def send_all_links(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send login links to all non-admin members. Admin only."""
    await require_admin(trip_id, user, db)
    result = await db.execute(
        select(TripMember, User).join(User, User.id == TripMember.user_id)
        .where(TripMember.trip_id == trip_id)
    )
    sent = 0
    for tm, u in result.all():
        if u.id == user.id:
            continue
        code = f"{__import__('random').randint(0, 999999):06d}"
        magic_token = MagicToken(
            id=uuid4(), email=u.email, token=code,
            expires_at=datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
        )
        db.add(magic_token)
        try:
            await send_login_code_email(u.email, u.name or "there", code)
            sent += 1
        except Exception as e:
            print(f"Failed to send to {u.email}: {e}")
    await db.commit()
    return {"message": f"Login codes sent to {sent} members", "sent": sent}


# ── A15/S2: Delete trip ──

@router.delete("")
async def delete_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a trip and all associated data. Admin only."""
    await require_admin(trip_id, user, db)
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(404, "Trip not found")

    # Delete in dependency order: splits, expenses, itinerary votes/items,
    # media, group members, groups, trip members, trip
    from models.models import Expense, ExpenseSplit, ItineraryItem, ItineraryVote, Media

    # Expense splits
    expenses = await db.execute(select(Expense).where(Expense.trip_id == trip_id))
    for exp in expenses.scalars().all():
        splits = await db.execute(select(ExpenseSplit).where(ExpenseSplit.expense_id == exp.id))
        for s in splits.scalars().all():
            await db.delete(s)
        await db.delete(exp)

    # Itinerary votes + items
    items = await db.execute(select(ItineraryItem).where(ItineraryItem.trip_id == trip_id))
    for item in items.scalars().all():
        votes = await db.execute(select(ItineraryVote).where(ItineraryVote.item_id == item.id))
        for v in votes.scalars().all():
            await db.delete(v)
        await db.delete(item)

    # Media
    media = await db.execute(select(Media).where(Media.trip_id == trip_id))
    for m in media.scalars().all():
        await db.delete(m)

    # Group members + groups
    groups = await db.execute(select(ExpenseGroup).where(ExpenseGroup.trip_id == trip_id))
    for g in groups.scalars().all():
        gms = await db.execute(select(GroupMember).where(GroupMember.group_id == g.id))
        for gm in gms.scalars().all():
            await db.delete(gm)
        await db.delete(g)

    # Trip members
    tms = await db.execute(select(TripMember).where(TripMember.trip_id == trip_id))
    for tm in tms.scalars().all():
        await db.delete(tm)

    await db.delete(trip)
    await db.commit()
    return {"message": "Trip deleted"}


# ── A17: Duplicate trip ──

@router.post("/duplicate")
async def duplicate_trip(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Clone a trip with its groups/members but no expenses/photos/itinerary. Admin only."""
    await require_admin(trip_id, user, db)
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Trip not found")

    data = await request.json() if request.headers.get("content-length", "0") != "0" else {}

    new_trip = Trip(
        id=uuid4(),
        name=data.get("name", f"{original.name} (copy)"),
        location=getattr(original, 'location', None),
        status="planning",
        created_by=user.id,
    )
    for field in ["rental_url", "rental_title", "start_date", "end_date"]:
        if hasattr(original, field) and hasattr(new_trip, field):
            val = getattr(original, field)
            # Bump dates by 1 year for start_date and end_date
            if val and field in ("start_date", "end_date"):
                try:
                    from datetime import date as dt_date
                    if isinstance(val, str):
                        d = dt_date.fromisoformat(val)
                    else:
                        d = val
                    val = d.replace(year=d.year + 1).isoformat() if isinstance(val, str) else d.replace(year=d.year + 1)
                except (ValueError, TypeError):
                    pass
            setattr(new_trip, field, val)
    db.add(new_trip)
    await db.flush()

    # Copy trip members
    members_result = await db.execute(
        select(TripMember).where(TripMember.trip_id == trip_id)
    )
    for tm in members_result.scalars().all():
        db.add(TripMember(trip_id=new_trip.id, user_id=tm.user_id, role=tm.role))

    # Copy groups with members
    groups_result = await db.execute(
        select(ExpenseGroup).options(selectinload(ExpenseGroup.members))
        .where(ExpenseGroup.trip_id == trip_id)
    )
    for g in groups_result.scalars().all():
        new_group = ExpenseGroup(
            id=uuid4(), trip_id=new_trip.id,
            name=g.name, percentage=g.percentage,
        )
        db.add(new_group)
        await db.flush()
        for gm in g.members:
            db.add(GroupMember(group_id=new_group.id, user_id=gm.user_id, is_payer=gm.is_payer))

    await db.commit()
    await db.refresh(new_trip)
    return {"id": new_trip.id, "name": new_trip.name, "message": "Trip duplicated"}