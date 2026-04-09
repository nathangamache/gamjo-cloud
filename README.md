# Gamjo Cloud

Private family vacation management PWA. Plan itineraries, split expenses, share photos, and vote on activities together.

Built for groups who travel together annually and need a single hub instead of scattered group texts, Venmo requests, and shared Google Docs.

## Features

**Itinerary Planning**
- Full trip calendar with day headings and day titles ("Lake Day", "Golf Day")
- Anyone can add/edit items, admin locks confirmed plans
- Slack/Discord-style like/dislike reaction voting with voter tooltips
- Push vote system highlights one item on everyone's home page
- Required date + time on all items, sorted chronologically

**Expense Tracking**
- Add expenses with payer, amount, category, date, and receipt photos
- Group-based splitting with configurable percentages (e.g. 1/3, 1/3, 1/3)
- Per-person and per-day spending breakdowns
- Settlement calculator showing who owes who
- Mark groups as settled when paid up
- CSV export

**Photo Gallery**
- Upload multiple photos at once with progress tracking
- Masonry grid layout with subtle rotations
- Lightbox viewer with keyboard navigation
- Captions, dates, and locations on each photo

**Home Dashboard**
- Time-aware greetings with personality
- Today's itinerary at a glance
- Trip countdown / day counter
- Highlighted vote card
- Expense stats with fun facts
- Polaroid-style recent photos strip
- Weather for the trip location (Open-Meteo)
- Recent activity feed
- Squad member grid

**Admin Tools**
- Invite users (silent add for existing, welcome email for new)
- Manage expense groups and payer assignments
- Upload trip banner photos
- Push votes to spotlight
- Duplicate trips for next year
- Day title management
- Send login codes to all members

**Activity Log**
- Tracks all creates/edits/deletes across expenses and itinerary
- Stores old data for deleted items
- Restore accidentally deleted expenses and itinerary items
- Recent activity feed on home page

**Authentication**
- Passwordless email-based login
- 6-digit magic codes via Resend
- 90-day session cookies
- No account creation needed, admin invites users by email

**PWA**
- Installable on iOS and Android home screens
- Service worker with network-first caching
- Safe area support for notched devices
- Standalone mode optimizations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, vanilla CSS |
| Backend | FastAPI, SQLAlchemy (async), Pydantic |
| Database | PostgreSQL |
| Cache | Redis |
| Email | Resend API |
| Weather | Open-Meteo (free, no key) |
| Hosting | Ubuntu 24.04, nginx |

## Design System

"Lake House at Dusk" warm aesthetic:

- **Fonts:** DM Sans (body) + DM Serif Display (headings)
- **Colors:** Cream backgrounds, deep lake blue primary, driftwood warm accent, sage green success
- **Cards:** Soft shadows (no borders), 16px radius
- **Accessibility:** WCAG AA contrast, 44px touch targets, focus indicators, 16px minimum inputs, skeleton loaders

## Project Structure

```
gamjo-cloud/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   └── icons/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Icons.jsx
│   │   │   └── Shared.jsx        # Sheet, Toast, Confirm, Skeletons, EmptyState
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── pages/
│   │   │   ├── HomePage.jsx      # Dashboard with weather, activity feed
│   │   │   ├── ItineraryPage.jsx # Day-by-day planning with voting
│   │   │   ├── ExpensesPage.jsx  # Tracking, categories, breakdowns
│   │   │   ├── PhotosPage.jsx    # Upload + grid gallery
│   │   │   ├── ProfilePage.jsx   # Per-vacation stats
│   │   │   ├── AdminPage.jsx     # People, groups, trip settings
│   │   │   ├── VacationsPage.jsx # Trip listing
│   │   │   ├── GalleryPage.jsx   # Masonry photo gallery
│   │   │   ├── LoginPage.jsx
│   │   │   └── GlobalAdminPage.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── helpers.js
│   │   ├── App.jsx               # Router, context, auth
│   │   └── index.css             # Full design system
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── routes/
│   │   ├── auth.py
│   │   ├── trips.py
│   │   ├── expenses.py
│   │   ├── itinerary.py
│   │   ├── media.py
│   │   ├── admin.py
│   │   ├── activity.py
│   │   └── global_admin.py
│   ├── models/
│   │   └── models.py
│   ├── services/
│   │   └── email.py
│   ├── utils/
│   │   └── deps.py
│   ├── config.py
│   ├── database.py
│   └── main.py
├── uploads/                      # User-uploaded files (gitignored)
├── .env                          # Environment config (gitignored)
├── .gitignore
└── README.md
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy[asyncio] asyncpg aioredis pydantic python-dotenv resend python-multipart

# Configure environment
cp .env.example .env
# Edit .env with your database URL, Redis URL, Resend API key

# Run migrations
python add_activity_log.py
python add_banner_columns.py
python add_day_titles_column.py
python fix_itinerary_columns.py

# Start server
uvicorn main:app --host 0.0.0.0 --port 8081 --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development
npm run dev -- --port 5173

# Production build
npm run build
```

### Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5433/gamjo
REDIS_URL=redis://localhost:6380
RESEND_API_KEY=re_your_key_here
FROM_EMAIL=Gamjo <noreply@gamjo.cloud>
MAGIC_LINK_EXPIRY_MINUTES=15
SESSION_EXPIRY_DAYS=90
UPLOAD_DIR=uploads
```

### nginx (production)

```nginx
server {
    listen 443 ssl;
    server_name gamjo.cloud;

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        alias /home/nathangamache/projects/gamjo-cloud/uploads/;
    }

    location / {
        root /home/nathangamache/projects/gamjo-cloud/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## Users

This app is private. There is no public registration. The admin (Nathan) invites users by email through the admin panel. Existing users are added silently; new users receive a welcome email with instructions.

Currently serving 13 users across 3 expense groups for an annual family lake vacation in Northern Michigan.

## License

Private. Not open source.