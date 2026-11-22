"""add payment request participant count

Revision ID: 0004_participants
Revises: 0003_auth_codes_tokens
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_participants"
down_revision = "0003_auth_codes_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_requests",
        sa.Column(
            "participant_count",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.alter_column("payment_requests", "participant_count", server_default=None)


def downgrade() -> None:
    op.drop_column("payment_requests", "participant_count")
