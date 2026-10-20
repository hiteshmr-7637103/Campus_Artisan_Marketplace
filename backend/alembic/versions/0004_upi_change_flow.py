"""secure UPI change flow

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth_token_purpose ADD VALUE IF NOT EXISTS 'change_upi'")
    op.add_column('seller_private', sa.Column('pending_upi_id', sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column('seller_private', 'pending_upi_id')
    # Postgres cannot drop an enum value; left in place (harmless, unused after rollback code is reverted too).
