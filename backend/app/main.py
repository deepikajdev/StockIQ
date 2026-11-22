from contextlib import asynccontextmanager
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .db import Base, SessionLocal, engine
from .logging_config import configure_logging
from .routers import (
    auth,
    intelligence,
    inventory,
    products,
    purchases,
    sales,
    suppliers,
)

configure_logging()
logger = logging.getLogger("stockiq")

API_SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}
if settings.is_production:
    API_SECURITY_HEADERS["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    from . import models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
    logger.info("application_ready", extra={"event": "application_ready"})
    yield


app = FastAPI(
    title="StockIQ API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.openapi_enabled else None,
)

cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def structured_request_logging(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()

    response = await call_next(request)

    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    for name, value in API_SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    logger.info(
        "http_request",
        extra={
            "event": "http_request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return a generic 500 and log only safe metadata, never exception text."""
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        "unhandled_exception",
        extra={
            "event": "unhandled_exception",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "exception_type": type(exc).__name__,
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"X-Request-ID": request_id} if request_id else None,
    )


for r in (
    auth.router,
    products.router,
    suppliers.router,
    purchases.router,
    sales.router,
    inventory.router,
    intelligence.router,
):
    app.include_router(r)


@app.get("/health", tags=["meta"])
def health():
    """Liveness: the process is running."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["meta"])
def readiness():
    """Readiness: the process can reach its database."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning(
            "readiness_check_failed",
            extra={
                "event": "readiness_check_failed",
                "exception_type": type(exc).__name__,
            },
        )
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "unavailable"},
        )
    return {"status": "ready", "database": "ok"}
