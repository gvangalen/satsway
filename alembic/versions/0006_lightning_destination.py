"""Store Lightning destination for sats requests.

Revision ID: 0006_lightning_destination
Revises: 0005_payment_shares
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_lightning_destination"
down_revision = "0005_payment_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_requests",
        sa.Column("lightning_address", sa.String(length=320), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payment_requests", "lightning_address")
