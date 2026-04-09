import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, Integer, Text, DateTime,
    ForeignKey, JSON, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


class TripStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    completed = "completed"


class ItineraryStatus(str, enum.Enum):
    proposed = "proposed"
    voting = "voting"
    final = "final"


class MemberRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    trip_memberships = relationship("TripMember", back_populates="user", lazy="selectin")
    group_memberships = relationship("GroupMember", back_populates="user", lazy="selectin")
    expenses_paid = relationship("Expense", back_populates="paid_by_user", lazy="selectin")
    photos = relationship("Media", back_populates="uploaded_by_user", lazy="selectin")
    votes = relationship("ItineraryVote", back_populates="user", lazy="selectin")


class MagicToken(Base):
    __tablename__ = "magic_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    user = relationship("User", lazy="selectin")


class Trip(Base):
    __tablename__ = "trips"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    start_date = Column(String(10), nullable=True)
    end_date = Column(String(10), nullable=True)
    status = Column(SAEnum(TripStatus), default=TripStatus.planning, nullable=False)
    rental_url = Column(String(1024), nullable=True)
    rental_title = Column(String(255), nullable=True)
    rental_notes = Column(Text, nullable=True)
    hero_image_url = Column(String(512), nullable=True)
    desktop_banners = Column(Text, default='[]')
    mobile_banners = Column(Text, default='[]')
    settled_groups = Column(Text, default="[]")
    day_titles = Column(Text, default="{}")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    members = relationship("TripMember", back_populates="trip", lazy="selectin", cascade="all, delete-orphan")
    groups = relationship("ExpenseGroup", back_populates="trip", lazy="selectin", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="trip", lazy="selectin", cascade="all, delete-orphan")
    itinerary_items = relationship("ItineraryItem", back_populates="trip", lazy="selectin", cascade="all, delete-orphan")
    media = relationship("Media", back_populates="trip", lazy="selectin", cascade="all, delete-orphan")
    creator = relationship("User", lazy="selectin")


class TripMember(Base):
    __tablename__ = "trip_members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(SAEnum(MemberRole), default=MemberRole.member, nullable=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("trip_id", "user_id"),)
    trip = relationship("Trip", back_populates="members")
    user = relationship("User", back_populates="trip_memberships", lazy="selectin")


class ExpenseGroup(Base):
    __tablename__ = "expense_groups"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    name = Column(String(255), nullable=False)
    percentage = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    trip = relationship("Trip", back_populates="groups")
    members = relationship("GroupMember", back_populates="group", lazy="selectin", cascade="all, delete-orphan")
    expense_splits = relationship("ExpenseSplit", back_populates="group", lazy="selectin")


class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("expense_groups.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_payer = Column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)
    group = relationship("ExpenseGroup", back_populates="members")
    user = relationship("User", back_populates="group_memberships", lazy="selectin")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    title = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    paid_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(String(10), nullable=True)
    has_receipt = Column(Boolean, default=False)
    receipt_url = Column(String(512), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    trip = relationship("Trip", back_populates="expenses")
    paid_by_user = relationship("User", back_populates="expenses_paid", lazy="selectin")
    splits = relationship("ExpenseSplit", back_populates="expense", lazy="selectin", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("expense_groups.id"), nullable=False)
    __table_args__ = (UniqueConstraint("expense_id", "group_id"),)
    expense = relationship("Expense", back_populates="splits")
    group = relationship("ExpenseGroup", back_populates="expense_splits")


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    date = Column(String(10), nullable=True)
    time = Column(String(5), nullable=True)
    status = Column(SAEnum(ItineraryStatus), default=ItineraryStatus.proposed, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    pushed = Column(Boolean, default=False)
    is_day_title = Column(Boolean, default=False)
    trip = relationship("Trip", back_populates="itinerary_items")
    votes = relationship("ItineraryVote", back_populates="item", lazy="selectin", cascade="all, delete-orphan")
    creator = relationship("User", lazy="selectin")


class ItineraryVote(Base):
    __tablename__ = "itinerary_votes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    item_id = Column(UUID(as_uuid=True), ForeignKey("itinerary_items.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("item_id", "user_id"),)
    item = relationship("ItineraryItem", back_populates="votes")
    user = relationship("User", back_populates="votes", lazy="selectin")


class Media(Base):
    __tablename__ = "media"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_url = Column(String(512), nullable=False)
    thumbnail_url = Column(String(512), nullable=True)
    filename = Column(String(255), nullable=True)
    caption = Column(String(500), nullable=True)
    location = Column(String(255), nullable=True)
    taken_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    trip = relationship("Trip", back_populates="media")
    uploaded_by_user = relationship("User", back_populates="photos", lazy="selectin")


class TripBalance(Base):
    __tablename__ = "trip_balances"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("expense_groups.id"), nullable=False)
    total_owed = Column(Float, nullable=False)
    total_paid = Column(Float, nullable=False)
    balance = Column(Float, nullable=False)
    finalized_at = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("trip_id", "group_id"),)