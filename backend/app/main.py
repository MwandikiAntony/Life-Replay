"""
LifeReplay Backend - FastAPI Application Entry Point
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.db.firestore import get_db, close_db
from app.api import auth, sessions, websocket

# Setup structured logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup + shutdown."""
    logger.info("LifeReplay backend starting", environment=settings.environment)

    # Initialize Firestore connection
    try:
        db = get_db()
        logger.info("Firestore connected")
    except Exception as e:
        logger.error("Firestore connection failed", error=str(e))
        # Don't crash on startup; endpoints will fail gracefully

    yield

    # Shutdown
    await close_db()
    logger.info("LifeReplay backend stopped")


app = FastAPI(
    title="LifeReplay API",
    description="Real-time AI-powered communication coaching platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# ─── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"
    return response


# ─── Exception Handlers ───────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(websocket.router)  # WS at /ws/session


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "lifereplay-api",
        "version": "1.0.0",
        "environment": settings.environment,
    }


@app.get("/")
async def root():
    return {
        "message": "LifeReplay API",
        "docs": "/docs",
        "health": "/health",
    }
