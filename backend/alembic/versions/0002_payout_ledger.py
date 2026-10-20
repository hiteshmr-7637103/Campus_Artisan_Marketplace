"""payout ledger: states, adjustments, statements

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres 12+ allows adding enum values inside a transaction as long as the new
    # value isn't used by DML in that same transaction, which this migration doesn't do.
    for v in ('eligible', 'processing', 'failed', 'on_hold', 'reversed'):
        op.execute(f"ALTER TYPE payout_status ADD VALUE IF NOT EXISTS '{v}'")

    op.add_column('seller_private', sa.Column('upi_updated_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('payouts', sa.Column('gross_paise', sa.BigInteger(), nullable=True))
    op.add_column('payouts', sa.Column('commission_paise', sa.BigInteger(), nullable=True))
    op.execute("""
        UPDATE payouts p SET gross_paise = o.amount_paise, commission_paise = o.commission_paise
        FROM orders o WHERE o.id = p.order_id
    """)
    op.alter_column('payouts', 'gross_paise', nullable=False)
    op.alter_column('payouts', 'commission_paise', nullable=False)
    op.add_column('payouts', sa.Column('provider', sa.String(length=20), server_default='manual', nullable=False))
    op.add_column('payouts', sa.Column('eligible_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('payouts', sa.Column('is_exception', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('payouts', sa.Column('exception_reason', sa.String(length=200), nullable=True))
    op.add_column('payouts', sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('payouts', sa.Column('failed_reason', sa.String(length=200), nullable=True))
    op.create_check_constraint('payouts_amounts_add_up', 'payouts', 'commission_paise + amount_paise = gross_paise')

    op.create_table('payout_adjustments',
    sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('seller_id', postgresql.UUID(), nullable=False),
    sa.Column('payout_id', postgresql.UUID(), nullable=True),
    sa.Column('order_id', postgresql.UUID(), nullable=True),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('reason', sa.String(length=200), nullable=False),
    sa.Column('settled_in_payout_id', postgresql.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id']),
    sa.ForeignKeyConstraint(['payout_id'], ['payouts.id']),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
    sa.ForeignKeyConstraint(['settled_in_payout_id'], ['payouts.id']),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_payout_adjustments_seller_id'), 'payout_adjustments', ['seller_id'], unique=False)

    op.create_table('payout_statements',
    sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('seller_id', postgresql.UUID(), nullable=False),
    sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
    sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
    sa.Column('lines', postgresql.JSONB(), nullable=False),
    sa.Column('gross_paise', sa.BigInteger(), nullable=False),
    sa.Column('commission_paise', sa.BigInteger(), nullable=False),
    sa.Column('net_paise', sa.BigInteger(), nullable=False),
    sa.Column('paid_paise', sa.BigInteger(), nullable=False),
    sa.Column('pending_paise', sa.BigInteger(), nullable=False),
    sa.Column('held_paise', sa.BigInteger(), nullable=False),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id']),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('seller_id', 'period_start', name='uq_statement_seller_period'),
    )
    op.create_index(op.f('ix_payout_statements_seller_id'), 'payout_statements', ['seller_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payout_statements_seller_id'), table_name='payout_statements')
    op.drop_table('payout_statements')
    op.drop_index(op.f('ix_payout_adjustments_seller_id'), table_name='payout_adjustments')
    op.drop_table('payout_adjustments')
    op.drop_constraint('payouts_amounts_add_up', 'payouts', type_='check')
    for col in ('failed_reason', 'attempt_count', 'exception_reason', 'is_exception', 'eligible_at', 'provider', 'commission_paise', 'gross_paise'):
        op.drop_column('payouts', col)
    op.drop_column('seller_private', 'upi_updated_at')
    # Postgres cannot drop enum values; the old values are left in place (harmless, unused after rollback code is reverted too).
