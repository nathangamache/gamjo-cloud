from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# ── Auth ──
class MagicLinkRequest(BaseModel):
    email: EmailStr
    trip_id: Optional[UUID] = None

class MagicLinkVerify(BaseModel):
    token: str

class AuthResponse(BaseModel):
    session_token: str
    user: "UserOut"

# ── Users ──
class UserOut(BaseModel):
    id: UUID
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

# ── Trips ──
class TripCreate(BaseModel):
    name: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rental_url: Optional[str] = None
    rental_title: Optional[str] = None

class TripUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    rental_url: Optional[str] = None
    rental_title: Optional[str] = None
    rental_notes: Optional[str] = None

class GroupMemberOut(BaseModel):
    id: UUID
    user_id: UUID
    is_payer: bool
    user: UserOut
    class Config:
        from_attributes = True

class ExpenseGroupOut(BaseModel):
    id: UUID
    name: str
    percentage: float
    members: list[GroupMemberOut] = []
    class Config:
        from_attributes = True

class TripMemberOut(BaseModel):
    id: UUID
    user_id: UUID
    role: str
    user: UserOut
    class Config:
        from_attributes = True

class TripOut(BaseModel):
    id: UUID
    name: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    rental_url: Optional[str] = None
    rental_title: Optional[str] = None
    rental_notes: Optional[str] = None
    hero_image_url: Optional[str] = None
    created_at: datetime
    members: list[TripMemberOut] = []
    groups: list[ExpenseGroupOut] = []
    class Config:
        from_attributes = True

# ── Invite ──
class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"

# ── Groups ──
class GroupCreate(BaseModel):
    name: str
    percentage: float
    member_ids: list[UUID]
    payer_ids: list[UUID]

# ── Expenses ──
class ExpenseCreate(BaseModel):
    title: str
    amount: float
    paid_by: UUID
    date: Optional[str] = None
    has_receipt: bool = False
    notes: Optional[str] = None
    group_ids: list[UUID]

class ExpenseSplitOut(BaseModel):
    group_id: UUID
    group_name: str = ""
    class Config:
        from_attributes = True

class ExpenseOut(BaseModel):
    id: UUID
    title: str
    amount: float
    paid_by: UUID
    paid_by_user: UserOut
    date: Optional[str] = None
    has_receipt: bool
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    splits: list[ExpenseSplitOut] = []
    class Config:
        from_attributes = True

# ── Itinerary ──
class ItineraryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None

class ItineraryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None

class VoteOut(BaseModel):
    user_id: UUID
    vote: bool
    user_name: Optional[str] = None
    class Config:
        from_attributes = True

class ItineraryOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    status: str
    created_by: UUID
    votes: list[VoteOut] = []
    class Config:
        from_attributes = True

# ── Media ──
class MediaOut(BaseModel):
    id: UUID
    file_url: str
    thumbnail_url: Optional[str] = None
    filename: Optional[str] = None
    caption: Optional[str] = None
    location: Optional[str] = None
    taken_at: Optional[datetime] = None
    uploaded_by: UUID
    uploaded_by_user: UserOut
    created_at: datetime
    class Config:
        from_attributes = True

# ── Balances ──
class GroupBalance(BaseModel):
    group_id: UUID
    group_name: str
    percentage: float
    total_owed: float
    total_paid: float
    balance: float
    members: list[GroupMemberOut] = []

class BalanceResponse(BaseModel):
    trip_total: float
    expense_count: int
    groups: list[GroupBalance]
