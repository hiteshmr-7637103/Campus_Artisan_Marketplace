"""Usage: python -m app.scripts.seed_demo

Creates a demo admin, two approved sellers, sample listings and one fulfilled order.
All demo accounts use the password 'demo-password-1'. Never run against production.
"""
from datetime import datetime, timezone

from sqlalchemy import select

from ..config import get_settings
from ..db import SessionLocal
from ..models import (
    Category, Listing, ListingStatus, Order, OrderStatus, Payment, Payout, SellerPrivate, SellerPublic,
    SellerStatus, User, UserRole,
)
from ..security import hash_password

PASSWORD = "demo-password-1"


def user(db, email, name, role=UserRole.buyer, seller=False):
    u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if u:
        return u
    u = User(
        email=email, password_hash=hash_password(PASSWORD), full_name=name, role=role,
        email_verified_at=datetime.now(timezone.utc),
        seller_status=SellerStatus.approved if seller else SellerStatus.none,
    )
    db.add(u)
    db.flush()
    return u


def main() -> None:
    if get_settings().is_production:
        raise SystemExit("Refusing to seed demo data in production")
    with SessionLocal() as db:
        user(db, "admin@example.com", "Demo Admin", UserRole.admin)
        buyer = user(db, "buyer@example.com", "Demo Buyer")
        sellers = []
        for email, name, disp, bio in [
            ("asha@example.com", "Asha Rao", "Asha's Beads", "Handmade beaded jewelry from the hostel common room."),
            ("ravi@example.com", "Ravi Kumar", "Ravi Clayworks", "Small-batch pottery, glazed by hand."),
        ]:
            s = user(db, email, name, UserRole.seller, seller=True)
            if db.get(SellerPublic, s.id) is None:
                db.add(SellerPublic(seller_id=s.id, display_name=disp, bio=bio))
                db.add(SellerPrivate(seller_id=s.id, phone="9876543210", instagram=disp.lower().replace(" ", "").replace("'", ""), upi_id=f"{email.split('@')[0]}@okaxis"))
            sellers.append(s)
        db.flush()
        cats = {c.slug: c for c in db.execute(select(Category)).scalars()}
        if db.execute(select(Listing.id).limit(1)).first() is None:
            items = [
                (sellers[0], "jewelry", "Beaded choker", "Blue and gold glass beads.", 29900),
                (sellers[0], "jewelry", "Silver-tone earrings", "Lightweight dangling earrings.", 19900),
                (sellers[1], "pottery", "Glazed coffee mug", "Wheel-thrown, dishwasher safe.", 45000),
                (sellers[1], "decor", "Mini planter", "Fits a small succulent.", 25000),
                (sellers[1], "pottery", "Pending: serving bowl", "Waiting for admin review.", 80000),
            ]
            made = []
            for i, (s, cat, title, desc, price) in enumerate(items):
                l = Listing(seller_id=s.id, category_id=cats[cat].id, title=title, description=desc, price_paise=price,
                            status=ListingStatus.pending_review if i == 4 else ListingStatus.active)
                db.add(l)
                made.append(l)
            db.flush()
            sold = made[1]
            sold.status = ListingStatus.sold
            commission = sold.price_paise // 10
            o = Order(buyer_id=buyer.id, seller_id=sold.seller_id, listing_id=sold.id, amount_paise=sold.price_paise,
                      commission_rate=0.1, commission_paise=commission, seller_amount_paise=sold.price_paise - commission,
                      status=OrderStatus.paid, paid_at=datetime.now(timezone.utc))
            db.add(o)
            db.flush()
            db.add(Payment(order_id=o.id, razorpay_payment_id="demo_pay_1", amount_paise=o.amount_paise, status="captured"))
            db.add(Payout(order_id=o.id, seller_id=o.seller_id, amount_paise=o.seller_amount_paise))
        db.commit()
    print(f"Demo data ready. Logins: admin@example.com / buyer@example.com / asha@example.com / ravi@example.com  password: {PASSWORD}")


if __name__ == "__main__":
    main()
