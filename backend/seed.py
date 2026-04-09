"""
Seed the database with the Gamache family vacation data.
Run from backend/: python -m seed
"""
import asyncio
from database import engine, async_session, Base
from models.models import (
    User, Trip, TripMember, ExpenseGroup, GroupMember,
    ItineraryItem, ItineraryVote, Expense, ExpenseSplit,
    MemberRole, TripStatus, ItineraryStatus,
)


USERS = [
    {"email": "nathanpaulgamache@gmail.com", "name": "Nathan Gamache", "role": "admin"},
    {"email": "virginia@example.com", "name": "Virginia Holland", "role": "member"},
    {"email": "bradley@example.com", "name": "Bradley Gamache", "role": "member"},
    {"email": "christen@example.com", "name": "Christen Gamache", "role": "member"},
    {"email": "steve@example.com", "name": "Steve Gamache", "role": "member"},
    {"email": "sue@example.com", "name": "Sue Gamache", "role": "member"},
    {"email": "tomg@example.com", "name": "Tom Gamache", "role": "member"},
    {"email": "tomj@example.com", "name": "Tom Jozwiak", "role": "member"},
    {"email": "lynn@example.com", "name": "Lynn Jozwiak", "role": "member"},
    {"email": "wil@example.com", "name": "Wil Jozwiak", "role": "member"},
    {"email": "sydney@example.com", "name": "Sydney Petoskey", "role": "member"},
    {"email": "kiersten@example.com", "name": "Kiersten Jozwiak", "role": "member"},
    {"email": "ben@example.com", "name": "Ben Jozwiak", "role": "member"},
]

GROUPS = [
    {
        "name": "Nathan's Group", "percentage": 33.3,
        "members": ["nathanpaulgamache@gmail.com", "virginia@example.com",
                     "bradley@example.com", "christen@example.com", "steve@example.com"],
        "payers": ["nathanpaulgamache@gmail.com"],
    },
    {
        "name": "Sue & Tom G.", "percentage": 33.3,
        "members": ["sue@example.com", "tomg@example.com"],
        "payers": ["sue@example.com", "tomg@example.com"],
    },
    {
        "name": "Jozwiak Family", "percentage": 33.4,
        "members": ["tomj@example.com", "lynn@example.com", "wil@example.com",
                     "sydney@example.com", "kiersten@example.com", "ben@example.com"],
        "payers": ["tomj@example.com", "lynn@example.com"],
    },
]

ITINERARY = [
    {"title": "Drive Up Day", "description": "Road trip from Detroit to Traverse City. Stop at Great Lakes Crossing on the way up.", "date": "2026-07-11", "time": "08:00", "status": "final"},
    {"title": "Lake Day", "description": "Private beach all day. Kayaking, swimming, paddleboarding.", "date": "2026-07-12", "time": "10:00", "status": "final"},
    {"title": "Go Into Town Day", "description": "Explore downtown Traverse City. Cherry farms, wineries, and shops.", "date": "2026-07-13", "time": "09:00", "status": "final"},
    {"title": "Adventure Day", "description": "Sleeping Bear Dunes National Lakeshore. Dune Climb + Pierce Stocking Drive.", "date": "2026-07-14", "time": "07:30", "status": "voting"},
    {"title": "Chill & Grill Day", "description": "Rest day at the cottage. BBQ, board games, bonfire.", "date": "2026-07-15", "time": None, "status": "proposed"},
    {"title": "Winery Tour", "description": "Chateau Chantal, Left Foot Charley, Black Star Farms.", "date": "2026-07-16", "time": "11:00", "status": "proposed"},
    {"title": "Pack Up & Head Home", "description": "Clean up rental, drive back to Detroit.", "date": "2026-07-18", "time": "10:00", "status": "final"},
]

EXPENSES = [
    {"title": "Groceries - Meijer", "amount": 247.83, "paid_by": "nathanpaulgamache@gmail.com", "date": "2026-07-11", "has_receipt": True, "notes": "First day groceries"},
    {"title": "Gas - Shell", "amount": 62.50, "paid_by": "tomj@example.com", "date": "2026-07-11", "has_receipt": False, "notes": "Fill up on I-75"},
    {"title": "Kayak Rentals", "amount": 180.00, "paid_by": "nathanpaulgamache@gmail.com", "date": "2026-07-12", "has_receipt": True, "notes": "6 kayaks, 3 hours"},
    {"title": "Downtown Lunch - Red Ginger", "amount": 156.20, "paid_by": "sue@example.com", "date": "2026-07-13", "has_receipt": False, "notes": "Lunch for everyone"},
    {"title": "Wine Tasting", "amount": 90.00, "paid_by": "virginia@example.com", "date": "2026-07-13", "has_receipt": True, "notes": "Chateau Chantal group tasting"},
    {"title": "Ice Cream - Moomers", "amount": 48.75, "paid_by": "lynn@example.com", "date": "2026-07-13", "has_receipt": False, "notes": "Ice cream for the crew"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async with async_session() as db:
        user_map = {}
        for u in USERS:
            user = User(email=u["email"], name=u["name"])
            db.add(user)
            await db.flush()
            user_map[u["email"]] = user
            print(f"  Created user: {u['name']} <{u['email']}>")

        nathan = user_map["nathanpaulgamache@gmail.com"]
        trip = Trip(
            name="Gamache Family Vacation", location="Traverse City, Michigan",
            start_date="2026-07-11", end_date="2026-07-18", status=TripStatus.active,
            rental_url="https://www.vrbo.com/example", rental_title="Lakefront Cottage on West Bay",
            created_by=nathan.id,
        )
        db.add(trip)
        await db.flush()

        for u_data in USERS:
            role = MemberRole.admin if u_data["role"] == "admin" else MemberRole.member
            db.add(TripMember(trip_id=trip.id, user_id=user_map[u_data["email"]].id, role=role))

        group_map = {}
        for g in GROUPS:
            group = ExpenseGroup(trip_id=trip.id, name=g["name"], percentage=g["percentage"])
            db.add(group)
            await db.flush()
            group_map[g["name"]] = group
            for email in g["members"]:
                db.add(GroupMember(group_id=group.id, user_id=user_map[email].id, is_payer=email in g["payers"]))

        for it in ITINERARY:
            item = ItineraryItem(trip_id=trip.id, title=it["title"], description=it["description"],
                                 date=it["date"], time=it["time"], status=ItineraryStatus(it["status"]), created_by=nathan.id)
            db.add(item)
            await db.flush()
            if it["status"] in ("final", "voting"):
                for voter in list(user_map.values())[:7]:
                    db.add(ItineraryVote(item_id=item.id, user_id=voter.id, vote=True))

        all_gids = [g.id for g in group_map.values()]
        for e in EXPENSES:
            expense = Expense(trip_id=trip.id, title=e["title"], amount=e["amount"],
                              paid_by=user_map[e["paid_by"]].id, date=e["date"],
                              has_receipt=e["has_receipt"], notes=e["notes"])
            db.add(expense)
            await db.flush()
            for gid in all_gids:
                db.add(ExpenseSplit(expense_id=expense.id, group_id=gid))

        await db.commit()

    print(f"\nSeed complete! Trip ID: {trip.id}")
    print(f"Login: POST /api/auth/magic-link {{\"email\": \"nathanpaulgamache@gmail.com\"}}")
    print("Check terminal for the magic link.\n")

if __name__ == "__main__":
    asyncio.run(seed())