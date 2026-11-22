"""receipt scans

Revision ID: 0002_receipt_scans
Revises: 0001_initial_schema
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_receipt_scans"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "receipt_scans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_receipt_scans_user_id", "receipt_scans", ["user_id"])
    op.create_index("ix_receipt_scans_status", "receipt_scans", ["status"])


def downgrade() -> None:
    op.drop_table("receipt_scans")
