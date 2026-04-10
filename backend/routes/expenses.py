"""Updated expenses routes.
Replace backend/routes/expenses.py with this file.
Adds: DELETE expense, POST receipt upload, has_receipt in response, group_ids.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from datetime import date
import os, shutil
from database import get_db
from models.models import Expense, ExpenseSplit, Trip, TripMember, User, ExpenseGroup, MemberRole
from utils.deps import get_current_user
from routes.trips import get_trip_for_user, is_admin

try:
    from routes.activity import log_activity
except ImportError:
    async def log_activity(*args, **kwargs): pass

router = APIRouter(prefix="/trips/{trip_id}/expenses", tags=["expenses"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")


def serialize_expense(exp: Expense) -> dict:
    """Serialize expense with has_receipt and group_ids."""
    group_ids = []
    if hasattr(exp, 'splits') and exp.splits:
        group_ids = [s.group_id for s in exp.splits]
    
    return {
        "id": exp.id,
        "title": exp.title,
        "amount": float(exp.amount) if exp.amount else 0,
        "paid_by": exp.paid_by,
        "date": str(exp.date) if exp.date else None,
        "notes": getattr(exp, 'notes', None),
        "receipt_url": getattr(exp, 'receipt_url', None),
        "has_receipt": bool(getattr(exp, 'receipt_url', None)),
        "group_ids": group_ids,
        "created_at": str(exp.created_at) if hasattr(exp, 'created_at') and exp.created_at else None,
        "created_by": str(exp.created_by) if hasattr(exp, 'created_by') and exp.created_by else None,
    }


@router.get("")
async def list_expenses(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all expenses for a trip."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Expense)
        .options(selectinload(Expense.splits))
        .where(Expense.trip_id == trip_id)
        .order_by(Expense.date.desc())
    )
    expenses = result.scalars().all()
    return [serialize_expense(e) for e in expenses]


@router.post("")
async def create_expense(
    trip_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new expense."""
    await get_trip_for_user(trip_id, user, db)
    data = await request.json()
    
    expense = Expense(
        id=uuid4(),
        trip_id=trip_id,
        title=data.get("title", ""),
        amount=data.get("amount", 0),
        paid_by=data.get("paid_by", user.id),
        date=data.get("date", str(date.today())),
    )
    if hasattr(expense, 'notes'):
        expense.notes = data.get("notes")
    if hasattr(expense, 'created_by'):
        expense.created_by = user.id
    
    db.add(expense)
    await db.flush()
    
    # Create splits for selected groups
    group_ids = data.get("group_ids", [])
    if group_ids:
        for gid in group_ids:
            try:
                split = ExpenseSplit(
                    id=uuid4(),
                    expense_id=expense.id,
                    group_id=UUID(str(gid)) if not isinstance(gid, UUID) else gid,
                )
                db.add(split)
            except Exception:
                pass
    
    await db.commit()
    await db.refresh(expense)

    # Log activity
    try:
        await log_activity(db, trip_id, user, "created", "expense", expense.id,
            f"Added expense: {expense.title} (${expense.amount:.2f})",
            new_data={"title": expense.title, "amount": float(expense.amount), "date": str(expense.date) if expense.date else None})
        await db.commit()
    except Exception:
        pass
    
    # Reload with splits
    result = await db.execute(
        select(Expense).options(selectinload(Expense.splits))
        .where(Expense.id == expense.id)
    )
    expense = result.scalar_one()
    return serialize_expense(expense)


@router.put("/{expense_id}")
@router.patch("/{expense_id}")
async def update_expense(
    trip_id: UUID,
    expense_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an expense. Admin or the person who created it."""
    await get_trip_for_user(trip_id, user, db)
    result = await db.execute(
        select(Expense).options(selectinload(Expense.splits))
        .where(Expense.id == expense_id, Expense.trip_id == trip_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")

    admin = await is_admin(trip_id, user, db)
    created_by = getattr(expense, 'created_by', None)
    if not admin and expense.paid_by != user.id and created_by != user.id:
        raise HTTPException(403, "Only admins or the creator can edit expenses")

    data = await request.json()
    for field in ["title", "amount", "paid_by", "date", "notes"]:
        if field in data and hasattr(expense, field):
            setattr(expense, field, data[field])

    # Update splits if group_ids provided
    if "group_ids" in data:
        # Delete existing splits
        for split in expense.splits:
            await db.delete(split)
        await db.flush()
        # Create new splits
        for gid in data["group_ids"]:
            try:
                split = ExpenseSplit(
                    id=uuid4(),
                    expense_id=expense.id,
                    group_id=UUID(str(gid)) if not isinstance(gid, UUID) else gid,
                )
                db.add(split)
            except Exception:
                pass

    await db.commit()

    result = await db.execute(
        select(Expense).options(selectinload(Expense.splits))
        .where(Expense.id == expense.id)
    )
    expense = result.scalar_one()
    return serialize_expense(expense)


@router.delete("/{expense_id}")
async def delete_expense(
    trip_id: UUID,
    expense_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an expense. Admin or the person who created it."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.trip_id == trip_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    
    # Check permission: admin, payer, or creator
    admin = await is_admin(trip_id, user, db)
    created_by = getattr(expense, 'created_by', None)
    if not admin and expense.paid_by != user.id and created_by != user.id:
        raise HTTPException(403, "Only admins or the creator can delete expenses")
    
    # Delete splits first
    splits_result = await db.execute(
        select(ExpenseSplit).where(ExpenseSplit.expense_id == expense_id)
    )
    for split in splits_result.scalars().all():
        await db.delete(split)
    
    # Log before deleting (capture old data for restore)
    old_data = {"title": expense.title, "amount": float(expense.amount) if expense.amount else 0,
                "paid_by": str(expense.paid_by) if expense.paid_by else None,
                "date": str(expense.date) if expense.date else None,
                "notes": getattr(expense, 'notes', ''),
                "category": getattr(expense, 'category', None)}

    await db.delete(expense)
    await db.commit()

    try:
        await log_activity(db, trip_id, user, "deleted", "expense", expense_id,
            f"Deleted expense: {old_data['title']} (${old_data['amount']:.2f})", old_data=old_data)
        await db.commit()
    except Exception:
        pass

    return {"message": "Expense deleted"}


@router.post("/{expense_id}/receipt")
async def upload_receipt(
    trip_id: UUID,
    expense_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a receipt image for an expense."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.trip_id == trip_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    
    os.makedirs(f"{UPLOAD_DIR}/receipts", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{expense_id}{ext}"
    filepath = f"{UPLOAD_DIR}/receipts/{filename}"
    
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    url = f"/uploads/receipts/{filename}"
    if hasattr(expense, 'receipt_url'):
        expense.receipt_url = url
    
    await db.commit()
    return {"url": url, "message": "Receipt uploaded"}


@router.get("/balances")
async def get_balances(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Calculate group balances for the trip."""
    await get_trip_for_user(trip_id, user, db)
    
    # Get expenses with splits
    expenses_result = await db.execute(
        select(Expense).options(selectinload(Expense.splits))
        .where(Expense.trip_id == trip_id)
    )
    expenses = expenses_result.scalars().all()
    
    # Get groups with members
    groups_result = await db.execute(
        select(ExpenseGroup).options(selectinload(ExpenseGroup.members))
        .where(ExpenseGroup.trip_id == trip_id)
    )
    groups = groups_result.scalars().all()
    
    # Calculate
    group_totals = {g.id: 0.0 for g in groups}
    payer_totals = {}
    
    for exp in expenses:
        payer_totals[exp.paid_by] = payer_totals.get(exp.paid_by, 0) + float(exp.amount or 0)
        
        exp_groups = [g for g in groups if any(s.group_id == g.id for s in exp.splits)] if exp.splits else groups
        total_pct = sum(float(g.percentage or 0) for g in exp_groups) or 100
        
        for g in exp_groups:
            group_totals[g.id] += float(exp.amount or 0) * (float(g.percentage or 0) / total_pct)
    
    balances = []
    for g in groups:
        owed = round(group_totals.get(g.id, 0), 2)
        # Count payments from ALL members in this group
        member_ids = [gm.user_id for gm in g.members]
        paid = round(sum(payer_totals.get(pid, 0) for pid in member_ids), 2)
        balances.append({
            "group_id": g.id,
            "group_name": g.name,
            "percentage": float(g.percentage or 0),
            "owed": owed,
            "paid": paid,
            "balance": round(paid - owed, 2),
        })
    
    return balances