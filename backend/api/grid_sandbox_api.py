"""Development-only links for quoting USD to Lightning in Grid's sandbox."""

from datetime import datetime, timezone
from decimal import Decimal
from secrets import compare_digest
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy import or_, update

from backend.core.config import settings
from backend.core.database import SessionLocal
from backend.db.tables import GridSandboxLinkTable, UserTable
from backend.models.auth import AuthTokenResponse
from backend.models.user import UserRead
from backend.repositories.auth_repository import auth_repository
from backend.services.grid_sandbox_service import (
    GridSandboxError,
    create_usd_lightning_quote,
    execute_quote,
    get_quote,
    get_transaction,
    simulate_usd_funding,
)


router = APIRouter(prefix="/api/sandbox/grid-links", tags=["grid-sandbox"])


class LinkCreate(BaseModel):
    amount_usd: Decimal = Field(gt=0, decimal_places=2)
    lightning_address: str = Field(min_length=3, max_length=320)

    @validator("lightning_address")
    def validate_address(cls, value: str) -> str:
        address = value.strip()
        if address.count("@") != 1 or any(char.isspace() for char in address):
            raise ValueError("Enter a Lightning address like name@wallet.example")
        return address


def _require_sandbox() -> None:
    if not settings.grid_sandbox_links_enabled:
        raise HTTPException(status_code=404, detail="Grid sandbox links are disabled")


def _sandbox_user(authorization: str | None = Header(default=None)) -> UserRead:
    _require_sandbox()
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Log in to the Satsway sandbox first")
    user = auth_repository.get_user_by_token(authorization.split(" ", 1)[1])
    if user is None:
        raise HTTPException(status_code=401, detail="Satsway sandbox login expired")
    return user


def _display_name(user_id: str | None) -> str | None:
    if not user_id:
        return None
    with SessionLocal() as session:
        user = session.get(UserTable, user_id)
        return user.name if user else None


def _as_response(link: GridSandboxLinkTable) -> dict:
    expires_at = link.quote_expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    quote_valid = bool(expires_at and expires_at > datetime.now(timezone.utc))
    show_quote = quote_valid or link.payout_status != "not_sent"
    return {
        "id": link.id,
        "amount_usd": float(link.amount_usd),
        "lightning_address": link.lightning_address,
        "owner_user_id": link.owner_user_id,
        "owner_name": _display_name(link.owner_user_id),
        "payer_user_id": link.payer_user_id,
        "payer_name": _display_name(link.payer_user_id),
        "quote_id": link.quote_id if show_quote else None,
        "quote_sats": link.quote_sats if show_quote else None,
        "quote_fee_cents": link.quote_fee_cents if show_quote else None,
        "quote_expires_at": expires_at.isoformat() if show_quote and expires_at else None,
        "fiat_status": link.fiat_status,
        "sats_status": link.payout_status,
        "payout_transaction_id": link.payout_transaction_id,
        "last_error": link.last_error,
        "created_at": link.created_at.isoformat(),
    }


@router.get("/availability")
def sandbox_availability() -> dict:
    _require_sandbox()
    return {"enabled": True}


@router.post("/test-login/{persona}", response_model=AuthTokenResponse)
def test_login(
    persona: str,
    request: Request,
    demo_access_code: str | None = Header(default=None, alias="X-Satsway-Demo-Code"),
) -> AuthTokenResponse:
    _require_sandbox()
    configured_code = settings.grid_sandbox_demo_access_code
    if configured_code:
        if not demo_access_code or not compare_digest(demo_access_code, configured_code):
            raise HTTPException(status_code=403, detail="Vul de toegangscode voor de demo in")
    elif request.client is None or request.client.host not in ("127.0.0.1", "::1", "testclient"):
        raise HTTPException(status_code=403, detail="Test login is local only")
    personas = {
        "noor": ("noor.demo@example.com", "Noor"),
        "sam": ("sam.demo@example.com", "Sam"),
    }
    if persona not in personas:
        raise HTTPException(status_code=404, detail="Unknown test user")
    email, name = personas[persona]
    code, _ = auth_repository.create_login_code(email)
    token = auth_repository.verify_code(email=email, code=code, name=name)
    if token is None:
        raise HTTPException(status_code=500, detail="Could not start test session")
    return token


@router.post("", status_code=201)
def create_link(payload: LinkCreate, current_user: UserRead = Depends(_sandbox_user)) -> dict:
    link = GridSandboxLinkTable(
        id=str(uuid4()),
        amount_usd=payload.amount_usd,
        lightning_address=payload.lightning_address,
        owner_user_id=str(current_user.id),
    )
    with SessionLocal() as session:
        session.add(link)
        session.commit()
        session.refresh(link)
        return _as_response(link)


@router.get("/mine")
def my_links(current_user: UserRead = Depends(_sandbox_user)) -> list[dict]:
    with SessionLocal() as session:
        links = (
            session.query(GridSandboxLinkTable)
            .filter(
                or_(
                    GridSandboxLinkTable.owner_user_id == str(current_user.id),
                    GridSandboxLinkTable.payer_user_id == str(current_user.id),
                )
            )
            .order_by(GridSandboxLinkTable.created_at.desc())
            .limit(20)
            .all()
        )
        return [_as_response(link) for link in links]


@router.get("/{link_id}")
def get_link(link_id: UUID) -> dict:
    _require_sandbox()
    with SessionLocal() as session:
        link = session.get(GridSandboxLinkTable, str(link_id))
        if link is None:
            raise HTTPException(status_code=404, detail="Link not found")
        return _as_response(link)


@router.post("/{link_id}/quote")
def quote_link(link_id: UUID) -> dict:
    _require_sandbox()
    with SessionLocal() as session:
        link = session.get(GridSandboxLinkTable, str(link_id))
        if link is None:
            raise HTTPException(status_code=404, detail="Link not found")
        if link.fiat_status != "not_paid":
            return _as_response(link)
        if _as_response(link)["quote_id"]:
            return _as_response(link)

        try:
            quote = create_usd_lightning_quote(Decimal(link.amount_usd), link.lightning_address)
        except GridSandboxError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        if quote.get("status") != "PENDING":
            raise HTTPException(status_code=502, detail="Grid did not return a pending quote")

        link.quote_id = quote["id"]
        link.quote_sats = quote["totalReceivingAmount"]
        link.quote_fee_cents = quote["feesIncluded"]
        link.quote_expires_at = datetime.fromisoformat(quote["expiresAt"].replace("Z", "+00:00"))
        session.commit()
        session.refresh(link)
        return _as_response(link)


@router.post("/{link_id}/simulate")
def simulate_link_payment(link_id: UUID, current_user: UserRead = Depends(_sandbox_user)) -> dict:
    """Use fake USD only; never accept a bank or card payment."""
    _require_sandbox()
    with SessionLocal() as session:
        link = session.get(GridSandboxLinkTable, str(link_id))
        if link is None:
            raise HTTPException(status_code=404, detail="Link not found")
        if link.owner_user_id == str(current_user.id):
            raise HTTPException(status_code=403, detail="The recipient cannot pay their own test link")
        if link.fiat_status != "not_paid":
            return _as_response(link)
        if not _as_response(link)["quote_id"]:
            raise HTTPException(status_code=409, detail="Get a current Grid quote first")

        try:
            quote = get_quote(link.quote_id)
            if quote.get("status") != "PENDING":
                raise GridSandboxError("Quote is no longer pending; refresh it")
        except GridSandboxError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

        # Claim this link atomically before the external call; never fund twice.
        claim = session.execute(
            update(GridSandboxLinkTable)
            .where(GridSandboxLinkTable.id == str(link_id), GridSandboxLinkTable.fiat_status == "not_paid")
            .values(fiat_status="funding", payer_user_id=str(current_user.id))
        )
        session.commit()
        if claim.rowcount != 1:
            session.refresh(link)
            return _as_response(link)
        try:
            funding = simulate_usd_funding(quote, int(Decimal(link.amount_usd) * 100))
        except GridSandboxError as error:
            link.fiat_status = "needs_review"
            link.last_error = str(error)[:500]
            session.commit()
            raise HTTPException(status_code=502, detail="Sandbox funding needs review") from error

        link.fiat_status = "simulated_received"
        link.funding_transaction_id = funding.get("transactionId")
        link.payout_status = "processing"
        session.commit()
        try:
            executed = execute_quote(link.quote_id)
            link.payout_transaction_id = executed.get("transactionId")
            if executed.get("status") == "FAILED":
                link.payout_status = "failed"
            session.commit()
        except GridSandboxError as error:
            # The execute call may have reached Grid. Poll its status; do not send again.
            link.last_error = str(error)[:500]
            session.commit()
        session.refresh(link)
        return _as_response(link)


@router.get("/{link_id}/status")
def get_link_status(link_id: UUID) -> dict:
    _require_sandbox()
    with SessionLocal() as session:
        link = session.get(GridSandboxLinkTable, str(link_id))
        if link is None:
            raise HTTPException(status_code=404, detail="Link not found")
        if link.payout_status == "processing" and link.quote_id:
            try:
                quote = get_quote(link.quote_id)
                transaction_id = quote.get("transactionId")
                if transaction_id:
                    link.payout_transaction_id = transaction_id
                    transaction = get_transaction(transaction_id)
                    if transaction.get("status") == "COMPLETED":
                        link.payout_status = "completed"
                    elif transaction.get("status") in ("FAILED", "REJECTED", "EXPIRED"):
                        link.payout_status = "failed"
                elif quote.get("status") in ("FAILED", "EXPIRED"):
                    link.payout_status = "failed"
                session.commit()
            except GridSandboxError as error:
                link.last_error = str(error)[:500]
                session.commit()
        return _as_response(link)
