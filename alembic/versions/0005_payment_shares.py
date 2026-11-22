"""add payment shares

Revision ID: 0005_payment_shares
Revises: 0004_participants
Create Date: 2026-05-03
"""

from decimal import Decimal
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "0005_payment_shares"
down_revision = "0004_participants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_shares",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("amount_eur", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["payment_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_shares_request_id", "payment_shares", ["request_id"])
    op.create_index("ix_payment_shares_status", "payment_shares", ["status"])

    connection = op.get_bind()
    requests = connection.execute(
        sa.text(
            "SELECT id, amount_eur, participant_count, status, created_at "
            "FROM payment_requests"
        ),
    )
    for request in requests:
        participant_count = max(int(request.participant_count or 1), 1)
        share_amount = (Decimal(str(request.amount_eur)) / participant_count).quantize(
            Decimal("0.01"),
        )
        share_status = "paid" if request.status == "paid" else "pending"
        paid_at = request.created_at if share_status == "paid" else None
        for position in range(1, participant_count + 1):
            connection.execute(
                sa.text(
                    "INSERT INTO payment_shares "
                    "(id, request_id, position, amount_eur, status, paid_at, created_at) "
                    "VALUES (:id, :request_id, :position, :amount_eur, :status, :paid_at, :created_at)"
                ),
                {
                    "id": str(uuid4()),
                    "request_id": request.id,
                    "position": position,
                    "amount_eur": share_amount,
                    "status": share_status,
                    "paid_at": paid_at,
                    "created_at": request.created_at,
                },
            )


def downgrade() -> None:
    op.drop_table("payment_shares")
