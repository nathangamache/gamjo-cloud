"""Updated trips routes with multi-banner support.
Replace backend/routes/trips.py with this file.
Banners stored as JSON arrays in desktop_banners/mobile_banners columns.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Form
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
import os, shutil, json
from database import get_db
from models.models import (
    Trip, TripMember, User, ExpenseGroup, GroupMember, MemberRole
)
from utils.deps import get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")


# ── Helpers ──

async def get_trip_for_user(trip_id: UUID, user: User, db: AsyncSession) -> Trip:
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(404, "Trip not found")
    member = await db.execute(
        select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == user.id)
    )
    if not member.scalar_one_or_none():
        raise HTTPException(403, "Not a member of this trip")
    return trip


async def is_admin(trip_id: UUID, user: User, db: AsyncSession) -> bool:
    result = await db.execute(
        select(TripMember).where(
            TripMember.trip_id == trip_id, TripMember.user_id == user.id,
            TripMember.role == MemberRole.admin
        )
    )
    return result.scalar_one_or_none() is not None


def _get_banners(trip, banner_type):
    """Parse banner JSON from trip column."""
    field = f"{banner_type}_banners"
    raw = getattr(trip, field, None) if hasattr(trip, field) else None
    if not raw:
        return []
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _set_banners(trip, banner_type, urls):
    """Write banner JSON to trip column."""
    field = f"{banner_type}_banners"
    if hasattr(trip, field):
        setattr(trip, field, json.dumps(urls))


async def serialize_trip(trip: Trip, db: AsyncSession) -> dict:
    count_result = await db.execute(
        select(func.count()).select_from(TripMember).where(TripMember.trip_id == trip.id)
    )
    member_count = count_result.scalar() or 0

    desktop = _get_banners(trip, "desktop")
    mobile = _get_banners(trip, "mobile")

    # Fallback banner_url: pick first available for backward compat
    fallback_banner = (desktop[0] if desktop else mobile[0] if mobile else
                       getattr(trip, 'hero_image_url', None))

    # Parse settled groups
    settled_raw = getattr(trip, 'settled_groups', None) if hasattr(trip, 'settled_groups') else None
    try:
        settled = json.loads(settled_raw) if isinstance(settled_raw, str) else (settled_raw or [])
    except (json.JSONDecodeError, TypeError):
        settled = []

    # Parse day titles
    dt_raw = getattr(trip, 'day_titles', None) if hasattr(trip, 'day_titles') else None
    try:
        day_titles = json.loads(dt_raw) if isinstance(dt_raw, str) else (dt_raw or {})
    except (json.JSONDecodeError, TypeError):
        day_titles = {}

    return {
        "id": trip.id,
        "name": trip.name,
        "location": getattr(trip, 'location', None),
        "start_date": str(trip.start_date) if trip.start_date else None,
        "end_date": str(trip.end_date) if trip.end_date else None,
        "status": trip.status.value if hasattr(trip.status, 'value') else str(trip.status),
        "hero_image_url": getattr(trip, 'hero_image_url', None),
        "banner_url": fallback_banner,
        "desktop_banners": desktop,
        "mobile_banners": mobile,
        "settled_groups": settled,
        "day_titles": day_titles,
        "rental_url": getattr(trip, 'rental_url', None),
        "rental_title": getattr(trip, 'rental_title', None),
        "member_count": member_count,
        "created_at": str(trip.created_at) if hasattr(trip, 'created_at') and trip.created_at else None,
    }


# ── Trip CRUD ──

@router.get("")
async def list_trips(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Trip).join(TripMember, TripMember.trip_id == Trip.id)
        .where(TripMember.user_id == user.id).order_by(Trip.start_date.desc())
    )
    trips = result.scalars().all()
    return [await serialize_trip(t, db) for t in trips]


@router.post("")
async def create_trip(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await request.json()
    trip = Trip(id=uuid4(), name=data.get("name", "New Trip"),
                location=data.get("location"), start_date=data.get("start_date"),
                end_date=data.get("end_date"), status=data.get("status", "planning"),
                created_by=user.id)
    for field in ["rental_url", "rental_title"]:
        if hasattr(trip, field) and field in data:
            setattr(trip, field, data[field])
    db.add(trip)
    await db.flush()
    db.add(TripMember(trip_id=trip.id, user_id=user.id, role=MemberRole.admin))
    await db.commit()
    await db.refresh(trip)
    return await serialize_trip(trip, db)


@router.get("/{trip_id}")
async def get_trip(trip_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    trip = await get_trip_for_user(trip_id, user, db)
    return await serialize_trip(trip, db)


@router.put("/{trip_id}")
@router.patch("/{trip_id}")
async def update_trip(trip_id: UUID, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")
    trip = await get_trip_for_user(trip_id, user, db)
    data = await request.json()
    for field in ["name", "location", "start_date", "end_date", "status", "rental_url", "rental_title"]:
        if field in data and hasattr(trip, field):
            setattr(trip, field, data[field])
    await db.commit()
    await db.refresh(trip)
    return await serialize_trip(trip, db)


# ── Banners (multi-image, desktop + mobile) ──

@router.get("/{trip_id}/banners")
async def list_banners(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all banners for a trip."""
    trip = await get_trip_for_user(trip_id, user, db)
    return {
        "desktop": _get_banners(trip, "desktop"),
        "mobile": _get_banners(trip, "mobile"),
    }


@router.post("/{trip_id}/banners")
async def upload_banner(
    trip_id: UUID,
    file: UploadFile = File(...),
    banner_type: str = Form("desktop"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a banner image. banner_type must be 'desktop' or 'mobile'."""
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")
    if banner_type not in ("desktop", "mobile"):
        raise HTTPException(400, "banner_type must be 'desktop' or 'mobile'")

    trip = await get_trip_for_user(trip_id, user, db)

    os.makedirs(f"{UPLOAD_DIR}/banners/{trip_id}", exist_ok=True)
    file_id = uuid4()
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{banner_type}_{file_id}{ext}"
    filepath = f"{UPLOAD_DIR}/banners/{trip_id}/{filename}"

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/uploads/banners/{trip_id}/{filename}"

    # Append to the appropriate banner list
    banners = _get_banners(trip, banner_type)
    banners.append(url)
    _set_banners(trip, banner_type, banners)

    # Also update legacy hero_image_url with the first desktop banner
    if banner_type == "desktop" and hasattr(trip, 'hero_image_url'):
        trip.hero_image_url = banners[0]

    await db.commit()
    return {
        "url": url,
        "banner_type": banner_type,
        "total": len(banners),
        "message": f"Banner uploaded ({banner_type})",
    }


@router.delete("/{trip_id}/banners")
async def delete_banner(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a banner by URL. Body: { "url": "...", "banner_type": "desktop"|"mobile" }"""
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")

    trip = await get_trip_for_user(trip_id, user, db)
    data = await request.json()
    url = data.get("url")
    banner_type = data.get("banner_type", "desktop")

    if not url:
        raise HTTPException(400, "url required")

    banners = _get_banners(trip, banner_type)
    if url in banners:
        banners.remove(url)
        _set_banners(trip, banner_type, banners)

        # Delete file from disk
        filepath = url.lstrip("/")
        if os.path.exists(filepath):
            os.remove(filepath)

        await db.commit()
        return {"message": "Banner deleted", "remaining": len(banners)}

    raise HTTPException(404, "Banner not found")


# Keep old single-banner endpoint for backward compat
@router.post("/{trip_id}/banner")
async def upload_banner_legacy(
    trip_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy single banner upload. Adds to desktop banners."""
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")
    trip = await get_trip_for_user(trip_id, user, db)

    os.makedirs(f"{UPLOAD_DIR}/banners/{trip_id}", exist_ok=True)
    file_id = uuid4()
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"desktop_{file_id}{ext}"
    filepath = f"{UPLOAD_DIR}/banners/{trip_id}/{filename}"

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/uploads/banners/{trip_id}/{filename}"
    banners = _get_banners(trip, "desktop")
    banners.append(url)
    _set_banners(trip, "desktop", banners)

    if hasattr(trip, 'hero_image_url'):
        trip.hero_image_url = banners[0]

    await db.commit()
    return {"url": url, "message": "Banner uploaded"}


# ── Day Titles ──

@router.put("/{trip_id}/day-title")
async def set_day_title(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set or update a day title for a specific date. Any trip member."""
    trip = await get_trip_for_user(trip_id, user, db)
    data = await request.json()
    date = data.get("date")
    title = data.get("title", "").strip()
    if not date:
        raise HTTPException(400, "Date required")

    dt_raw = getattr(trip, 'day_titles', None) if hasattr(trip, 'day_titles') else None
    try:
        day_titles = json.loads(dt_raw) if isinstance(dt_raw, str) else (dt_raw or {})
    except (json.JSONDecodeError, TypeError):
        day_titles = {}

    if title:
        day_titles[date] = title
    else:
        day_titles.pop(date, None)

    if hasattr(trip, 'day_titles'):
        trip.day_titles = json.dumps(day_titles)
    await db.commit()
    return {"day_titles": day_titles}


# ── Settlement tracking ──

@router.post("/{trip_id}/settle/{group_id}")
async def toggle_settle_group(
    trip_id: UUID,
    group_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a group's settled status. Admin only."""
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")
    trip = await get_trip_for_user(trip_id, user, db)

    settled_raw = getattr(trip, 'settled_groups', None) if hasattr(trip, 'settled_groups') else None
    try:
        settled = json.loads(settled_raw) if isinstance(settled_raw, str) else (settled_raw or [])
    except (json.JSONDecodeError, TypeError):
        settled = []

    gid_str = str(group_id)
    if gid_str in settled:
        settled.remove(gid_str)
        is_settled = False
    else:
        settled.append(gid_str)
        is_settled = True

    if hasattr(trip, 'settled_groups'):
        trip.settled_groups = json.dumps(settled)
    await db.commit()
    return {"settled": is_settled, "settled_groups": settled}


# ── Members ──

@router.get("/{trip_id}/members")
async def get_members(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_trip_for_user(trip_id, user, db)
    result = await db.execute(
        select(TripMember, User).join(User, User.id == TripMember.user_id)
        .where(TripMember.trip_id == trip_id)
    )
    rows = result.all()
    groups_result = await db.execute(
        select(ExpenseGroup).options(selectinload(ExpenseGroup.members))
        .where(ExpenseGroup.trip_id == trip_id)
    )
    groups = groups_result.scalars().all()

    members = []
    for tm, u in rows:
        group_name = None
        is_payer = False
        for g in groups:
            for gm in g.members:
                if gm.user_id == u.id:
                    group_name = g.name
                    is_payer = gm.is_payer
                    break
        members.append({
            "id": u.id, "user_id": u.id, "name": u.name, "email": u.email,
            "role": tm.role.value if hasattr(tm.role, 'value') else str(tm.role),
            "avatar_url": getattr(u, 'avatar_url', None),
            "profile_photo": getattr(u, 'avatar_url', None),
            "group_name": group_name, "is_payer": is_payer,
        })
    return members


# ── Groups ──

@router.get("/{trip_id}/groups")
async def get_groups(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_trip_for_user(trip_id, user, db)
    result = await db.execute(
        select(ExpenseGroup).options(selectinload(ExpenseGroup.members))
        .where(ExpenseGroup.trip_id == trip_id)
    )
    groups = result.scalars().all()
    return [{
        "id": g.id, "name": g.name,
        "percentage": float(g.percentage) if g.percentage else 0,
        "members": [{"user_id": gm.user_id, "is_payer": gm.is_payer} for gm in g.members]
    } for g in groups]