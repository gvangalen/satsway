from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, root_validator

from backend.core.enums import StringEnum
from backend.core.time import utc_now
from backend.models.poster import PosterRead
from backend.models.transaction import Currency


class PaymentRequestStatus(StringEnum):
    pending = "pending"
    paid = "paid"
    expired = "expired"


class PaymentShareRead(BaseModel):
    id: UUID
    request_id: UUID
    position: int
    amount_eur: Decimal
    status: PaymentRequestStatus
    paid_at: datetime | None = None
    locked_sats: int | None = None
    locked_rate: Decimal | None = None
    locked_at: datetime | None = None
    invoice_id: str | None = None
    invoice_expires_at: datetime | None = None
    lightning_invoice: str | None = None
    created_at: datetime


class PaymentRequestCreate(BaseModel):
    user_id: UUID = Field(default_factory=uuid4)
    amount_eur: Decimal = Field(gt=0, decimal_places=2)
    settlement_currency: Currency = Currency.eur
    lightning_address: str | None = Field(default=None, max_length=320)
    amount_sats: int | None = Field(default=None, gt=0)
    participant_count: int = Field(default=1, ge=1, le=100)
    share_amounts_eur: list[Decimal] | None = None
    description: str | None = Field(default=None, max_length=280)

    @root_validator
    def validate_share_amounts(cls, values):
        if values.get("settlement_currency") == Currency.btc:
            address = (values.get("lightning_address") or "").strip()
            if not address or "@" not in address or any(char.isspace() for char in address):
                raise ValueError("A valid Lightning address is required to receive sats")
            values["lightning_address"] = address
        share_amounts = values.get("share_amounts_eur")
        if share_amounts is None:
            return values

        amount_eur = values.get("amount_eur")
        participant_count = values.get("participant_count")
        if participant_count is not None and len(share_amounts) != participant_count:
            raise ValueError("share_amounts_eur must match participant_count")

        if any(amount <= 0 for amount in share_amounts):
            raise ValueError("share_amounts_eur must contain positive amounts")

        if amount_eur is not None:
            total = sum(share_amounts, Decimal("0.00")).quantize(Decimal("0.01"))
            expected_total = amount_eur.quantize(Decimal("0.01"))
            if total != expected_total:
                raise ValueError("share_amounts_eur must add up to amount_eur")

        return values


class PaymentRequest(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    amount_eur: Decimal
    settlement_currency: Currency = Currency.eur
    lightning_address: str | None = None
    amount_sats: int | None = None
    participant_count: int = 1
    description: str | None = None
    status: PaymentRequestStatus = PaymentRequestStatus.pending
    created_at: datetime = Field(default_factory=utc_now)


class PaymentRequestRead(PaymentRequest):
    paid_count: int = 0
    shares: list[PaymentShareRead] = []


class PaymentRequestWithPoster(PaymentRequestRead):
    poster: PosterRead | None = None


class PaymentRequestCheckout(BaseModel):
    request_id: UUID
    status: PaymentRequestStatus
    checkout_url: str


class PaymentSessionCreate(BaseModel):
    payment_currency: Currency
    share_id: UUID | None = None
    quote_id: UUID | None = None


class PaymentSessionRead(BaseModel):
    request_id: UUID
    share_id: UUID | None = None
    status: PaymentRequestStatus
    provider: str
    payment_currency: Currency
    settlement_currency: Currency
    settlement_amount: Decimal
    payment_amount: Decimal
    payment_amount_sats: int | None = None
    locked_sats: int | None = None
    locked_rate: Decimal | None = None
    locked_at: datetime | None = None
    invoice_id: str | None = None
    invoice_expires_at: datetime | None = None
    exchange_rate: Decimal
    checkout_url: str | None = None
    lightning_invoice: str | None = None
    lightning_payment_hash: str | None = None
    expires_at: datetime
