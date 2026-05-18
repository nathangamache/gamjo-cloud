"""Standalone health-check server for Gamjo Cloud backend.

Runs as a separate uvicorn process on a dedicated port (default 8082), distinct
from the main API (8081). The point is to give an external monitor a small,
non-API surface to poll without widening the public attack surface.

Binds to 127.0.0.1 by default - reach it from the public internet by adding a
`/health` location to nginx that proxies to 127.0.0.1:8082 (same pattern as the
existing `/api/` proxy to :8081). Override with HEALTH_HOST=0.0.0.0 only if you
intend to expose 8082 directly and have firewalled it appropriately.

Endpoints:
  GET /healthz  - liveness only (process is up). Returns 200 always.
  GET /health   - readiness. Verifies database connectivity. Returns 503 on failure.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from config import get_settings
from database import async_session, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Gamjo Cloud Health", version="1.0.0", lifespan=lifespan)


async def check_database() -> tuple[bool, str | None]:
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


@app.get("/healthz")
async def healthz():
    """Liveness probe - process is responding. No dependency checks."""
    return {
        "status": "ok",
        "app": "gamjo-cloud-backend",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
async def health():
    """Readiness probe - process is responding AND database is reachable."""
    db_ok, db_err = await check_database()
    overall_ok = db_ok
    body = {
        "status": "ok" if overall_ok else "degraded",
        "app": "gamjo-cloud-backend",
        "time": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "database": {"ok": db_ok, "error": db_err},
        },
    }
    return JSONResponse(content=body, status_code=200 if overall_ok else 503)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HEALTH_HOST", "127.0.0.1"),
        port=int(os.environ.get("HEALTH_PORT", "8082")),
        log_level="warning",
    )
