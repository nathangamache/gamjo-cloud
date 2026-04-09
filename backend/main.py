from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os, logging

from database import init_db
from config import get_settings
from routes import auth, trips, expenses, itinerary, media, admin, global_admin
try:
    from routes import activity as activity_routes
except ImportError:
    activity_routes = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Gamjo Cloud API...")
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "photos"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "receipts"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "avatars"), exist_ok=True)
    logger.info("Database tables created / verified")
    yield
    logger.info("Shutting down Gamjo Cloud API...")


app = FastAPI(title="Gamjo Cloud API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(trips.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(itinerary.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(global_admin.router, prefix="/api")
if activity_routes:
    app.include_router(activity_routes.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "gamjo-cloud"}


# ── SPA catch-all: serve frontend ──

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="frontend-assets")


@app.get("/{full_path:path}")
async def spa_catch_all(full_path: str):
    """Serve index.html for all non-API routes (SPA routing)."""
    if full_path.startswith("api/"):
        raise HTTPException(404, "Not found")

    # Try to serve the exact file first (favicon.svg, manifest.json, sw.js, icons)
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)

    # Fall back to index.html for SPA routing
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    raise HTTPException(404, "Frontend not built")