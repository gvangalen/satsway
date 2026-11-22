"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "payment_requests",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("amount_eur", sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_sats", sa.Integer(), nullable=True),
        sa.Column("settlement_currency", sa.String(length=8), nullable=False),
        sa.Column("description", sa.String(length=280), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_requests_user_id", "payment_requests", ["user_id"])
    op.create_index("ix_payment_requests_status", "payment_requests", ["status"])
    op.create_table(
        "payment_quotes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column("payment_currency", sa.String(length=8), nullable=False),
        sa.Column("settlement_currency", sa.String(length=8), nullable=False),
        sa.Column("payment_amount", sa.Numeric(18, 8), nullable=False),
        sa.Column("settlement_amount", sa.Numeric(18, 8), nullable=False),
        sa.Column("exchange_rate", sa.Numeric(18, 8), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["payment_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_quotes_request_id", "payment_quotes", ["request_id"])
    op.create_index("ix_payment_quotes_expires_at", "payment_quotes", ["expires_at"])
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column("quote_id", sa.String(length=36), nullable=True),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Numeric(18, 8), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("settlement_amount", sa.Numeric(18, 8), nullable=True),
        sa.Column("settlement_currency", sa.String(length=8), nullable=True),
        sa.Column("external_id", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["payment_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_request_id", "transactions", ["request_id"])
    op.create_index("ix_transactions_quote_id", "transactions", ["quote_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_table(
        "posters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("sponsor_name", sa.String(length=255), nullable=True),
        sa.Column("sponsor_url", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_posters_active", "posters", ["active"])
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("processed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_events_provider", "webhook_events", ["provider"])
    op.create_index("ix_webhook_events_event_type", "webhook_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("webhook_events")
    op.drop_table("posters")
    op.drop_table("transactions")
    op.drop_table("payment_quotes")
    op.drop_table("payment_requests")
    op.drop_table("users")
