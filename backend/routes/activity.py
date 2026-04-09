"""
Activity log routes.
Add to backend/routes/activity.py and register in main.py.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from datetime import datetime
from database import get_db
from models.models import User
from utils.deps import get_current_user
from routes.trips import get_trip_for_user

router = APIRouter(prefix="/api/trips/{trip_id}/activity", tags=["activity"])


async def log_activity(
    db: AsyncSession,
    trip_id: UUID,
    user: User,
    action: str,
    entity_type: str,
    entity_id: UUID = None,
    summary: str = "",
    old_data: dict = None,
    new_data: dict = None,
):
    """Helper to log an activity. Call from other routes."""
    import json
    await db.execute(
        text("""
            INSERT INTO activity_log (id, trip_id, user_id, user_name, action, entity_type, entity_id, summary, old_data, new_data, created_at)
            VALUES (:id, :trip_id, :user_id, :user_name, :action, :entity_type, :entity_id, :summary, :old_data, :new_data, :created_at)
        """),
        {
            "id": str(uuid4()),
            "trip_id": str(trip_id),
            "user_id": str(user.id) if user else None,
            "user_name": user.name if user else "System",
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "summary": summary,
            "old_data": json.dumps(old_data) if old_data else None,
            "new_data": json.dumps(new_data) if new_data else None,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


@router.get("")
async def get_activity(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 30,
    offset: int = 0,
):
    """Get recent activity for a trip."""
    await get_trip_for_user(trip_id, user, db)

    result = await db.execute(
        text("""
            SELECT id, user_id, user_name, action, entity_type, entity_id, summary, old_data, created_at
            FROM activity_log
            WHERE trip_id = :trip_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"trip_id": str(trip_id), "limit": limit, "offset": offset}
    )
    rows = result.fetchall()

    return [
        {
            "id": str(r[0]),
            "user_id": str(r[1]) if r[1] else None,
            "user_name": r[2],
            "action": r[3],
            "entity_type": r[4],
            "entity_id": str(r[5]) if r[5] else None,
            "summary": r[6],
            "old_data": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
        }
        for r in rows
    ]


@router.post("/{activity_id}/restore")
async def restore_item(
    trip_id: UUID,
    activity_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a deleted item from activity log."""
    await get_trip_for_user(trip_id, user, db)

    result = await db.execute(
        text("SELECT action, entity_type, old_data FROM activity_log WHERE id = :id AND trip_id = :trip_id"),
        {"id": activity_id, "trip_id": str(trip_id)}
    )
    row = result.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Activity not found")

    action, entity_type, old_data = row
    if action != "deleted" or not old_data:
        from fastapi import HTTPException
        raise HTTPException(400, "Can only restore deleted items")

    import json
    data = json.loads(old_data) if isinstance(old_data, str) else old_data

    if entity_type == "expense":
        from models.models import Expense
        expense = Expense(
            id=uuid4(),
            trip_id=trip_id,
            title=data.get("title", "Restored expense"),
            amount=data.get("amount", 0),
            paid_by=data.get("paid_by"),
            date=data.get("date"),
            notes=data.get("notes", "") + " (restored)",
            category=data.get("category"),
        )
        if hasattr(expense, 'group_ids'):
            expense.group_ids = data.get("group_ids")
        db.add(expense)
        await db.commit()
        await log_activity(db, trip_id, user, "restored", "expense", expense.id, f"Restored expense: {data.get('title')}")
        await db.commit()
        return {"message": "Expense restored", "id": str(expense.id)}

    elif entity_type == "itinerary":
        from models.models import ItineraryItem
        item = ItineraryItem(
            id=uuid4(),
            trip_id=trip_id,
            title=data.get("title", "Restored item"),
            description=data.get("description"),
            date=data.get("date"),
            time=data.get("time"),
            status=data.get("status", "proposed"),
            created_by=user.id,
        )
        if hasattr(item, 'location'):
            item.location = data.get("location")
        db.add(item)
        await db.commit()
        await log_activity(db, trip_id, user, "restored", "itinerary", item.id, f"Restored: {data.get('title')}")
        await db.commit()
        return {"message": "Item restored", "id": str(item.id)}

    from fastapi import HTTPException
    raise HTTPException(400, f"Cannot restore {entity_type} items")