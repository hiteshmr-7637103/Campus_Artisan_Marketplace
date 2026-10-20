"""google oauth linking + admin 2FA

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=50), nullable=True))
    op.create_unique_constraint('uq_users_google_sub', 'users', ['google_sub'])
    op.add_column('users', sa.Column('totp_secret', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('users', sa.Column('totp_confirmed_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('refresh_tokens', sa.Column('mfa', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    op.create_table('recovery_codes',
    sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', postgresql.UUID(), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code_hash'),
    )
    op.create_index(op.f('ix_recovery_codes_user_id'), 'recovery_codes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_recovery_codes_user_id'), table_name='recovery_codes')
    op.drop_table('recovery_codes')
    op.drop_column('refresh_tokens', 'mfa')
    op.drop_column('users', 'totp_confirmed_at')
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
    op.drop_constraint('uq_users_google_sub', 'users', type_='unique')
    op.drop_column('users', 'google_sub')
