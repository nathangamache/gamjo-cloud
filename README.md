# GamJo Cloud

Private family vacation management PWA. Plan itineraries, split expenses, share photos, and vote on activities together.

Built for groups who travel together annually and need a single hub instead of scattered group texts, Venmo requests, and shared Google Docs.

## Features

**Itinerary Planning**
- Full trip calendar with day headings and day titles ("Lake Day", "Golf Day")
- Anyone can add/edit items, admin locks confirmed plans
- Slack/Discord-style like/dislike reaction voting with color-coded voter names
- Push vote system highlights one item on everyone's home page
- Required date + time on all items, sorted chronologically

**Expense Tracking**
- Add expenses with payer, amount, category, date, and receipt photos
- Group-based splitting with configurable percentages (e.g. 1/3, 1/3, 1/3)
- Per-person and per-day spending breakdowns
- Settlement calculator showing who owes who
- Mark groups as settled when paid up
- Tab-aware sidebar (All = trip total, My receipts = stat cards, My group = teal card)
- CSV export

**Photos**
- Unified gallery grid view (merged Gallery + Photos into one page)
- Upload multiple photos at once with preview and progress tracking
- Three-tier image optimization: thumbnail (400px), display (1200px), original stored
- Lightbox viewer with swipe navigation and keyboard support
- Edit photos (caption, date, location) via edit overlay; delete from edit sheet
- Bulk select and delete mode
- Grouped by date with date headers

**Home Dashboard**
- Time-aware greetings with personality
- Today's itinerary at a glance
- Trip countdown / day counter
- Highlighted vote card
- Expense stats with fun facts
- Polaroid-style recent photos strip
- Weather for the trip location (Open-Meteo)
- Recent activity feed with SVG icon badges
- Crew member grid with tap-to-view profile photo lightbox
- Rental listing link card

**User Preferences (persisted to database)**
- Appearance: System / Light / Dark (system follows device `prefers-color-scheme`)
- Reduce motion: disables all animations and transitions
- Accessibility mode: 20px minimum font, high-contrast black/white text, larger nav icons, 2px borders
- All preferences sync across devices via `/api/auth/me`

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
- 6-digit magic codes via Resend (PWA-safe, no redirect)
- 90-day session cookies
- No account creation needed, admin invites users by email
- Session storage persistence (returning from inbox restores login state)

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
| Image Processing | Pillow (thumbnail + display generation) |
| Hosting | Ubuntu 24.04, nginx, CloudPanel, Cloudflare |

## Design System

"Lake House at Dusk" warm aesthetic:

- **Fonts:** DM Sans (body) + DM Serif Display (headings)
- **Colors:** Cream backgrounds, deep lake blue primary, driftwood warm accent, sage green success
- **Cards:** Soft shadows (no borders), 16px radius
- **Dark mode:** Full variable swap with dark overlays on hero banners, system preference detection
- **Accessibility mode:** 20px minimum font, forced black/white text, 2px borders, enlarged nav icons, underlined links
- **Accessibility:** WCAG AA contrast, 44px touch targets, focus indicators, 16px minimum inputs, skeleton loaders
- **Animations:** Page fades, sheet slides, button micro-interactions, hover lifts (all respect reduce-motion)

## Project Structure

```
gamjo-cloud/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   ├── favicon.svg
│   │   └── icons/              # icon-192, icon-512, maskable variants
│   ├── src/
│   │   ├── components/
│   │   │   ├── Icons.jsx
│   │   │   └── Shared.jsx      # Sheet, Toast, Confirm, Skeletons, EmptyState
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── pages/
│   │   │   ├── HomePage.jsx      # Dashboard with weather, crew lightbox, activity feed
│   │   │   ├── ItineraryPage.jsx # Day-by-day planning with voting
│   │   │   ├── ExpensesPage.jsx  # Tracking, categories, breakdowns
│   │   │   ├── GalleryPage.jsx   # Unified photo gallery with upload + lightbox
│   │   │   ├── ProfilePage.jsx   # Stats, appearance, accessibility settings
│   │   │   ├── AdminPage.jsx     # People, groups, trip settings
│   │   │   ├── VacationsPage.jsx # Trip listing (full-image cards)
│   │   │   ├── LoginPage.jsx
│   │   │   └── GlobalAdminPage.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── helpers.js
│   │   ├── App.jsx               # Router, context, auth, preference sync
│   │   ├── config.json           # Greetings, fun facts, empty states
│   │   └── index.css             # Full design system + dark mode + a11y mode
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── routes/
│   │   ├── auth.py               # Login, /me with preferences (raw SQL)
│   │   ├── trips.py
│   │   ├── expenses.py
│   │   ├── itinerary.py
│   │   ├── media.py              # Upload with image optimization
│   │   ├── admin.py
│   │   ├── activity.py
│   │   └── global_admin.py
│   ├── models/
│   │   └── models.py
│   ├── services/
│   │   └── email.py
│   ├── utils/
│   │   ├── deps.py
│   │   └── image_processing.py   # Thumbnail + display generation (Pillow)
│   ├── config.py
│   ├── database.py
│   └── main.py
├── uploads/                      # User-uploaded files (gitignored)
│   └── media/{trip_id}/
│       ├── {uuid}.jpg            # Original (full resolution)
│       ├── thumb_{uuid}.jpg      # Thumbnail (400px max, 70% quality)
│       └── disp_{uuid}.jpg       # Display (1200px max, 82% quality)
├── .env                          # Environment config (gitignored)
├── .gitignore
└── README.md
```

**Removed files:**
- `PhotosPage.jsx` — merged into `GalleryPage.jsx` (unified photo experience)

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Pillow (`pip install Pillow --break-system-packages`)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy[asyncio] asyncpg aioredis pydantic python-dotenv resend python-multipart Pillow

# Configure environment
cp .env.example .env
# Edit .env with your database URL, Redis URL, Resend API key

# Run migrations
python add_activity_log.py
python add_banner_columns.py
python add_day_titles_column.py
python fix_itinerary_columns.py
python add_itinerary_location.py
python add_onboarded.py
python add_user_preferences.py      # theme, reduce_motion, a11y_mode columns
python add_media_thumbnails.py       # thumbnail_url, display_url columns

# Backfill image thumbnails for existing photos
python backfill_thumbnails.py

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
FROM_EMAIL=GamJo <noreply@gamjo.cloud>
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

## Database Columns Added via Migrations

These columns are added by migration scripts rather than defined in the SQLAlchemy model. The backend reads/writes them via raw SQL.

| Table | Column | Type | Migration Script |
|-------|--------|------|-----------------|
| users | theme | VARCHAR(10) | add_user_preferences.py |
| users | reduce_motion | BOOLEAN | add_user_preferences.py |
| users | a11y_mode | BOOLEAN | add_user_preferences.py |
| users | onboarded | BOOLEAN | add_onboarded.py |
| media | thumbnail_url | VARCHAR(500) | add_media_thumbnails.py |
| media | display_url | VARCHAR(500) | add_media_thumbnails.py |

## Image Optimization

When a photo is uploaded, the backend generates up to three versions:

| Version | Max Dimension | JPEG Quality | Served To |
|---------|--------------|--------------|-----------|
| Thumbnail | 400px | 70% | Gallery grid, photo list, home page strip |
| Display | 1200px | 82% | Lightbox viewer |
| Original | As uploaded | Untouched | Stored on disk, never served |

Images smaller than the target size skip that tier. EXIF orientation is corrected automatically. RGBA/palette images are converted to RGB for JPEG output.

## Users

This app is private. There is no public registration. The admin (Nathan) invites users by email through the admin panel. Existing users are added silently; new users receive a welcome email with instructions.

Currently serving 13 users across 3 expense groups for an annual family lake vacation in Northern Michigan.

## License

Private. Not open source.