"""initial schema

Revision ID: 0001
Revises: 
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS citext')
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    op.create_table('app_config',
    sa.Column('id', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('commission_rate', sa.Numeric(precision=5, scale=4), nullable=False),
    sa.CheckConstraint('id', name='app_config_singleton'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('categories',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('slug', sa.String(length=60), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('users',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('email', postgresql.CITEXT(), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('role', sa.Enum('buyer', 'seller', 'admin', name='user_role'), server_default='buyer', nullable=False),
    sa.Column('seller_status', sa.Enum('none', 'pending', 'approved', 'rejected', name='seller_status'), server_default='none', nullable=False),
    sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('webhook_events',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('event_id', sa.String(length=120), nullable=False),
    sa.Column('type', sa.String(length=80), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id')
    )
    op.create_table('auth_tokens',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('purpose', sa.Enum('verify_email', 'reset_password', name='auth_token_purpose'), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_auth_tokens_user_id'), 'auth_tokens', ['user_id'], unique=False)
    op.create_table('listings',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('category_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('description', sa.String(length=2000), nullable=False),
    sa.Column('price_paise', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.Enum('pending_review', 'active', 'sold', 'rejected', 'archived', name='listing_status'), server_default='pending_review', nullable=False),
    sa.Column('reject_reason', sa.String(length=300), nullable=True),
    sa.CheckConstraint('price_paise > 0', name='listings_price_positive'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_listings_seller_id'), 'listings', ['seller_id'], unique=False)
    op.create_index('ix_listings_status_created', 'listings', ['status', 'created_at'], unique=False)
    op.create_table('refresh_tokens',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    op.create_table('seller_private',
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('instagram', sa.String(length=60), nullable=True),
    sa.Column('upi_id', sa.String(length=80), nullable=False),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('seller_id')
    )
    op.create_table('seller_public',
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('display_name', sa.String(length=80), nullable=False),
    sa.Column('bio', sa.String(length=600), server_default='', nullable=False),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('seller_id')
    )
    op.create_table('listing_images',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('listing_id', sa.UUID(), nullable=False),
    sa.Column('storage_path', sa.String(length=300), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.CheckConstraint('position between 0 and 2', name='listing_images_position_range'),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('listing_id', 'position', name='uq_listing_images_position')
    )
    op.create_index(op.f('ix_listing_images_listing_id'), 'listing_images', ['listing_id'], unique=False)
    op.create_table('orders',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('buyer_id', sa.UUID(), nullable=False),
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('listing_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('commission_rate', sa.Numeric(precision=5, scale=4), nullable=False),
    sa.Column('commission_paise', sa.BigInteger(), nullable=False),
    sa.Column('seller_amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.Enum('pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded', name='order_status'), server_default='pending_payment', nullable=False),
    sa.Column('needs_refund', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('razorpay_payment_link_id', sa.String(length=80), nullable=True),
    sa.Column('payment_url', sa.String(length=500), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('fulfilled_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('amount_paise > 0', name='orders_amount_positive'),
    sa.CheckConstraint('buyer_id <> seller_id', name='orders_buyer_not_seller'),
    sa.CheckConstraint('commission_paise + seller_amount_paise = amount_paise', name='orders_amounts_add_up'),
    sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_buyer_id'), 'orders', ['buyer_id'], unique=False)
    op.create_index(op.f('ix_orders_listing_id'), 'orders', ['listing_id'], unique=False)
    op.create_index(op.f('ix_orders_seller_id'), 'orders', ['seller_id'], unique=False)
    op.create_table('payments',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('razorpay_payment_id', sa.String(length=80), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('raw_event', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('razorpay_payment_id')
    )
    op.create_index(op.f('ix_payments_order_id'), 'payments', ['order_id'], unique=False)
    op.create_table('payouts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.Enum('pending', 'paid', name='payout_status'), server_default='pending', nullable=False),
    sa.Column('upi_txn_ref', sa.String(length=80), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    op.create_index(op.f('ix_payouts_seller_id'), 'payouts', ['seller_id'], unique=False)
    op.create_table('reviews',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('buyer_id', sa.UUID(), nullable=False),
    sa.Column('seller_id', sa.UUID(), nullable=False),
    sa.Column('listing_id', sa.UUID(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('comment', sa.String(length=1000), server_default='', nullable=False),
    sa.CheckConstraint('rating between 1 and 5', name='reviews_rating_range'),
    sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    op.create_index(op.f('ix_reviews_seller_id'), 'reviews', ['seller_id'], unique=False)

    # ---- public-safe views (never expose seller_private or user emails) ----
    op.execute("""
        CREATE VIEW seller_ratings AS
        SELECT seller_id, round(avg(rating)::numeric, 2) AS avg_rating, count(*)::int AS review_count
        FROM reviews GROUP BY seller_id
    """)
    op.execute("""
        CREATE VIEW public_listings AS
        SELECT l.id, l.title, l.description, l.price_paise, l.created_at,
               c.name AS category_name, c.slug AS category_slug,
               l.seller_id, sp.display_name AS seller_display_name,
               sr.avg_rating, COALESCE(sr.review_count, 0) AS review_count,
               COALESCE((SELECT json_agg(li.storage_path ORDER BY li.position)
                         FROM listing_images li WHERE li.listing_id = l.id), '[]'::json) AS image_paths
        FROM listings l
        JOIN categories c ON c.id = l.category_id
        JOIN seller_public sp ON sp.seller_id = l.seller_id
        LEFT JOIN seller_ratings sr ON sr.seller_id = l.seller_id
        WHERE l.status = 'active'
    """)

    # ---- seed data ----
    from app.config import get_settings

    op.execute(
        "INSERT INTO categories (name, slug) VALUES ('Jewelry','jewelry'),('Decor','decor'),('Textiles','textiles'),('Pottery','pottery'),('Other','other')"
    )
    op.execute(sa.text("INSERT INTO app_config (id, commission_rate) VALUES (true, :r)").bindparams(r=get_settings().commission_rate))


def downgrade() -> None:
    op.execute('DROP VIEW IF EXISTS public_listings')
    op.execute('DROP VIEW IF EXISTS seller_ratings')
    op.drop_index(op.f('ix_reviews_seller_id'), table_name='reviews')
    op.drop_table('reviews')
    op.drop_index(op.f('ix_payouts_seller_id'), table_name='payouts')
    op.drop_table('payouts')
    op.drop_index(op.f('ix_payments_order_id'), table_name='payments')
    op.drop_table('payments')
    op.drop_index(op.f('ix_orders_seller_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_listing_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_buyer_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_listing_images_listing_id'), table_name='listing_images')
    op.drop_table('listing_images')
    op.drop_table('seller_public')
    op.drop_table('seller_private')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index('ix_listings_status_created', table_name='listings')
    op.drop_index(op.f('ix_listings_seller_id'), table_name='listings')
    op.drop_table('listings')
    op.drop_index(op.f('ix_auth_tokens_user_id'), table_name='auth_tokens')
    op.drop_table('auth_tokens')
    op.drop_table('webhook_events')
    op.drop_table('users')
    op.drop_table('categories')
    op.drop_table('app_config')
    for enum in ('user_role','seller_status','auth_token_purpose','listing_status','order_status','payout_status'):
        op.execute(f'DROP TYPE IF EXISTS {enum}')
