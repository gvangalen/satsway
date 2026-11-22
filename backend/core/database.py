from collections.abc import Generator
from uuid import UUID

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.core.config import settings
from backend.models.payment_request import PaymentRequestRead
from backend.models.poster import PosterRead
from backend.models.transaction import PaymentQuoteRead, Transaction


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_database() -> None:
    from backend.db import tables  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_payment_request_columns()
    _ensure_payment_share_lock_columns()
    _ensure_grid_sandbox_link_columns()


def _ensure_payment_request_columns() -> None:
    inspector = inspect(engine)
    if "payment_requests" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("payment_requests")}
    with engine.begin() as connection:
        if "participant_count" not in existing_columns:
            connection.execute(text("ALTER TABLE payment_requests ADD COLUMN participant_count INTEGER NOT NULL DEFAULT 1"))
        if "lightning_address" not in existing_columns:
            connection.execute(text("ALTER TABLE payment_requests ADD COLUMN lightning_address VARCHAR(320)"))


def _ensure_payment_share_lock_columns() -> None:
    inspector = inspect(engine)
    if "payment_shares" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("payment_shares")}
    column_definitions = {
        "locked_sats": "INTEGER",
        "locked_rate": "NUMERIC(18, 8)",
        "locked_at": "DATETIME",
        "invoice_id": "VARCHAR(255)",
        "invoice_expires_at": "DATETIME",
        "lightning_invoice": "TEXT",
    }

    with engine.begin() as connection:
        for column_name, column_definition in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE payment_shares ADD COLUMN {column_name} {column_definition}"),
                )


def _ensure_grid_sandbox_link_columns() -> None:
    inspector = inspect(engine)
    if "grid_sandbox_links" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("grid_sandbox_links")}
    column_definitions = {
        "owner_user_id": "VARCHAR(36)",
        "payer_user_id": "VARCHAR(36)",
        "fiat_status": "VARCHAR(32) NOT NULL DEFAULT 'not_paid'",
        "payout_status": "VARCHAR(32) NOT NULL DEFAULT 'not_sent'",
        "funding_transaction_id": "VARCHAR(128)",
        "payout_transaction_id": "VARCHAR(128)",
        "last_error": "VARCHAR(500)",
    }
    with engine.begin() as connection:
        for column_name, column_definition in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE grid_sandbox_links ADD COLUMN {column_name} {column_definition}"))


class InMemoryDatabase:
    def __init__(self) -> None:
        self.payment_requests: dict[UUID, PaymentRequestRead] = {}
        self.posters: dict[UUID, PosterRead] = {}
        self.payment_quotes: dict[UUID, PaymentQuoteRead] = {}
        self.transactions: dict[UUID, Transaction] = {}


db = InMemoryDatabase()
