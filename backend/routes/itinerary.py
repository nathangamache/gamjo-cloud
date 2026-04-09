"""Updated itinerary routes v2.
Replace backend/routes/itinerary.py with this file.
Adds: DELETE endpoint for removing items.
Keeps: location, pushed fields; vote_count, user_voted in responses.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from database import get_db
from models.models import ItineraryItem, ItineraryVote, User
from utils.deps import get_current_user
from routes.trips import get_trip_for_user, is_admin

try:
    from routes.activity import log_activity
except ImportError:
    async def log_activity(*args, **kwargs): pass

router = APIRouter(prefix="/trips/{trip_id}/itinerary", tags=["itinerary"])


def serialize_item(item: ItineraryItem, current_user_id=None) -> dict:
    """Serialize with likes, dislikes, user_vote, location, pushed."""
    votes = getattr(item, 'votes', []) or []
    likes = [v for v in votes if v.vote is True]
    dislikes = [v for v in votes if v.vote is False]
    user_vote = None
    for v in votes:
        if v.user_id == current_user_id:
            user_vote = 'like' if v.vote else 'dislike'
            break

    return {
        "id": item.id,
        "title": item.title,
        "description": getattr(item, 'description', None),
        "date": str(item.date) if item.date else None,
        "time": getattr(item, 'time', None),
        "status": item.status.value if hasattr(item.status, 'value') else str(item.status),
        "location": getattr(item, 'location', None),
        "pushed": getattr(item, 'pushed', False),
        "is_day_title": getattr(item, 'is_day_title', False) or False,
        "likes": len(likes),
        "dislikes": len(dislikes),
        "user_vote": user_vote,
        "like_users": {str(v.user_id): True for v in likes},
        "dislike_users": {str(v.user_id): True for v in dislikes},
        # Keep legacy fields for compatibility
        "vote_count": len(likes),
        "user_voted": user_vote == 'like',
        "votes": {str(v.user_id): v.vote for v in votes},
        "created_at": str(item.created_at) if hasattr(item, 'created_at') and item.created_at else None,
    }


@router.get("")
async def list_items(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_trip_for_user(trip_id, user, db)
    result = await db.execute(
        select(ItineraryItem)
        .options(selectinload(ItineraryItem.votes))
        .where(ItineraryItem.trip_id == trip_id)
        .order_by(ItineraryItem.date.asc().nullslast())
    )
    items = result.scalars().all()
    return [serialize_item(i, user.id) for i in items]


@router.post("")
async def create_item(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_trip_for_user(trip_id, user, db)
    data = await request.json()

    item = ItineraryItem(
        id=uuid4(),
        trip_id=trip_id,
        title=data.get("title", ""),
        description=data.get("description"),
        date=data.get("date"),
        time=data.get("time"),
        status=data.get("status", "proposed"),
        created_by=user.id,
    )
    if hasattr(item, 'location'):
        item.location = data.get("location")
    if hasattr(item, 'pushed'):
        item.pushed = data.get("pushed", False)
    if hasattr(item, 'is_day_title'):
        item.is_day_title = data.get("is_day_title", False)

    db.add(item)
    await db.commit()
    await db.refresh(item)

    try:
        await log_activity(db, trip_id, user, "created", "itinerary", item.id,
            f"Added to itinerary: {item.title}",
            new_data={"title": item.title, "date": str(item.date) if item.date else None, "time": getattr(item, 'time', None)})
        await db.commit()
    except Exception:
        pass

    return serialize_item(item, user.id)


@router.put("/{item_id}")
@router.patch("/{item_id}")
async def update_item(
    trip_id: UUID,
    item_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_trip_for_user(trip_id, user, db)
    result = await db.execute(
        select(ItineraryItem)
        .options(selectinload(ItineraryItem.votes))
        .where(ItineraryItem.id == item_id, ItineraryItem.trip_id == trip_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")

    data = await request.json()
    for field in ["title", "description", "date", "time", "status", "location", "pushed", "is_day_title"]:
        if field in data and hasattr(item, field):
            setattr(item, field, data[field])

    # Only one item can be pushed at a time per trip
    if data.get("pushed") is True and hasattr(item, 'pushed'):
        others = await db.execute(
            select(ItineraryItem).where(
                ItineraryItem.trip_id == trip_id,
                ItineraryItem.id != item_id,
            )
        )
        for other in others.scalars().all():
            if getattr(other, 'pushed', False):
                other.pushed = False

    await db.commit()
    await db.refresh(item)
    return serialize_item(item, user.id)


@router.delete("/{item_id}")
async def delete_item(
    trip_id: UUID,
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an itinerary item. Admin only."""
    if not await is_admin(trip_id, user, db):
        raise HTTPException(403, "Admin only")
    
    result = await db.execute(
        select(ItineraryItem).where(
            ItineraryItem.id == item_id,
            ItineraryItem.trip_id == trip_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")
    
    # Delete votes first
    votes_result = await db.execute(
        select(ItineraryVote).where(ItineraryVote.item_id == item_id)
    )
    for vote in votes_result.scalars().all():
        await db.delete(vote)
    
    await db.delete(item)
    await db.commit()
    return {"message": "Item deleted"}


@router.post("/{item_id}/vote")
async def toggle_vote(
    trip_id: UUID,
    item_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle vote on an itinerary item. Send {"vote": true} for like, {"vote": false} for dislike."""
    await get_trip_for_user(trip_id, user, db)

    result = await db.execute(
        select(ItineraryItem)
        .options(selectinload(ItineraryItem.votes))
        .where(ItineraryItem.id == item_id, ItineraryItem.trip_id == trip_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")

    # Get vote type from body (default True for backwards compat)
    try:
        data = await request.json()
        vote_value = data.get("vote", True)
    except Exception:
        vote_value = True

    # Check if already voted
    existing = await db.execute(
        select(ItineraryVote).where(
            ItineraryVote.item_id == item_id,
            ItineraryVote.user_id == user.id
        )
    )
    vote = existing.scalar_one_or_none()

    if vote:
        if vote.vote == vote_value:
            # Same vote type: toggle off
            await db.delete(vote)
        else:
            # Different vote type: switch
            vote.vote = vote_value
    else:
        new_vote = ItineraryVote(
            id=uuid4(),
            item_id=item_id,
            user_id=user.id,
            vote=vote_value,
        )
        db.add(new_vote)

    await db.commit()

    # Re-fetch for response
    result = await db.execute(
        select(ItineraryItem)
        .options(selectinload(ItineraryItem.votes))
        .where(ItineraryItem.id == item_id)
    )
    item = result.scalar_one()
    return serialize_item(item, user.id)