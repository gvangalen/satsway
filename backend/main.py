from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.api.auth_api import router as auth_router
from backend.api.poster_api import router as poster_router
from backend.api.public_request_api import router as public_request_router
from backend.api.quote_api import router as quote_router
from backend.api.rate_api import router as rate_router
from backend.api.receipt_api import router as receipt_router
from backend.api.request_api import router as request_router
from backend.api.webhook_api import router as webhook_router
from backend.api.grid_sandbox_api import router as grid_sandbox_router
from backend.core.config import settings
from backend.core.database import SessionLocal, init_database


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_database()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Satsway backend API for payment requests, fiat checkout, Lightning payments, posters, and receipt uploads.",
    openapi_tags=[
        {"name": "auth", "description": "Passwordless login and current user endpoints."},
        {"name": "requests", "description": "Create, list, retrieve, and pay Satsway requests."},
        {"name": "receipts", "description": "Receipt upload and scan status endpoints."},
        {"name": "posters", "description": "Sponsored and educational poster content."},
        {"name": "rates", "description": "FX and BTC/EUR rate endpoints."},
        {"name": "webhooks", "description": "Provider webhook receivers for Stripe and River."},
        {"name": "system", "description": "Operational health checks."},
    ],
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(request_router)
app.include_router(public_request_router)
app.include_router(auth_router)
app.include_router(receipt_router)
app.include_router(poster_router)
app.include_router(rate_router)
app.include_router(quote_router)
app.include_router(webhook_router)
app.include_router(grid_sandbox_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db", tags=["system"])
def database_health_check() -> dict[str, str]:
    with SessionLocal() as session:
        session.execute(text("select 1"))

    return {"status": "ok", "database": "ok"}


@app.get("/health/config", tags=["system"])
def config_health_check() -> dict[str, bool | list[str]]:
    return {
        "postgres": settings.uses_postgres,
        "stripe": settings.stripe_configured,
        "stripe_webhook": settings.stripe_webhook_configured,
        "river": settings.river_configured,
        "cors_origins": settings.allowed_cors_origins,
    }
