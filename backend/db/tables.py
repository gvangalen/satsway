from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.database import Base
from backend.core.time import utc_now


class UserTable(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PaymentRequestTable(Base):
    __tablename__ = "payment_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    amount_eur: Mapped[float] = mapped_column(Numeric(12, 2))
    amount_sats: Mapped[int | None] = mapped_column(nullable=True)
    settlement_currency: Mapped[str] = mapped_column(String(8), default="EUR")
    lightning_address: Mapped[str | None] = mapped_column(String(320), nullable=True)
    participant_count: Mapped[int] = mapped_column(default=1)
    description: Mapped[str | None] = mapped_column(String(280), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class GridSandboxLinkTable(Base):
    __tablename__ = "grid_sandbox_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    amount_usd: Mapped[float] = mapped_column(Numeric(12, 2))
    lightning_address: Mapped[str] = mapped_column(String(320))
    owner_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    payer_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    quote_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    quote_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    quote_sats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quote_fee_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fiat_status: Mapped[str] = mapped_column(String(32), default="not_paid")
    payout_status: Mapped[str] = mapped_column(String(32), default="not_sent")
    funding_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payout_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PaymentQuoteTable(Base):
    __tablename__ = "payment_quotes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("payment_requests.id"),
        index=True,
    )
    payment_currency: Mapped[str] = mapped_column(String(8))
    settlement_currency: Mapped[str] = mapped_column(String(8))
    payment_amount: Mapped[float] = mapped_column(Numeric(18, 8))
    settlement_amount: Mapped[float] = mapped_column(Numeric(18, 8))
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 8))
    provider: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PaymentShareTable(Base):
    __tablename__ = "payment_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("payment_requests.id"),
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer)
    amount_eur: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    locked_sats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    locked_rate: Mapped[float | None] = mapped_column(Numeric(18, 8), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invoice_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lightning_invoice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class TransactionTable(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("payment_requests.id"),
        index=True,
    )
    quote_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    payment_method: Mapped[str] = mapped_column(String(32))
    amount: Mapped[float] = mapped_column(Numeric(18, 8))
    currency: Mapped[str] = mapped_column(String(8))
    settlement_amount: Mapped[float | None] = mapped_column(Numeric(18, 8), nullable=True)
    settlement_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    external_id: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PosterTable(Base):
    __tablename__ = "posters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    image_url: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    sponsor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sponsor_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class WebhookEventTable(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    event_type: Mapped[str] = mapped_column(String(128), index=True)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class ReceiptScanTable(Base):
    __tablename__ = "receipt_scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(128))
    file_path: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="uploaded", index=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class AuthCodeTable(Base):
    __tablename__ = "auth_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class AuthTokenTable(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
