"""Usage: python -m app.scripts.seed_rich_marketplace

Seeds the database with a rich catalog of student artisans, diverse categories,
real high-res craft photography, and customer accounts with orders and reviews.
All demo accounts use password 'demo-password-1'.
"""
from datetime import datetime, timezone
import uuid

from sqlalchemy import select

from ..config import get_settings
from ..db import SessionLocal
from ..models import (
    Category, Listing, ListingImage, ListingStatus, Order, OrderStatus, Payment, Payout,
    Review, SellerPrivate, SellerPublic, SellerStatus, User, UserRole,
)
from ..security import hash_password

PASSWORD = "demo-password-1"


def get_or_create_user(db, email, name, role=UserRole.buyer, seller=False):
    u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if u:
        return u
    u = User(
        email=email,
        password_hash=hash_password(PASSWORD),
        full_name=name,
        role=role,
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
        # 1. Admin & Buyers
        admin = get_or_create_user(db, "admin@example.com", "Demo Admin", UserRole.admin)
        buyer1 = get_or_create_user(db, "buyer@example.com", "Demo Buyer", UserRole.buyer)
        buyer2 = get_or_create_user(db, "kavya@example.com", "Kavya Sharma", UserRole.buyer)
        buyer3 = get_or_create_user(db, "rahul@example.com", "Rahul Verma", UserRole.buyer)
        buyer4 = get_or_create_user(db, "sneha@example.com", "Sneha Nair", UserRole.buyer)

        # 2. Student Artisans
        artisan_specs = [
            (
                "asha@example.com",
                "Asha Rao",
                "Asha's Beads",
                "Crafting handcrafted silver-wire, glass bead jewelry, and dorm rings from Hostel 4 common room.",
                "9876543210",
                "ashabeads",
                "asha@okaxis",
            ),
            (
                "ravi@example.com",
                "Ravi Kumar",
                "Ravi Clayworks",
                "Wheel-thrown ceramics, matte-glazed espresso cups, and hand-pinched succulent planters.",
                "9876543211",
                "raviclayworks",
                "ravi@okaxis",
            ),
            (
                "meera@example.com",
                "Meera Sen",
                "Meera's Dorm Decor",
                "Interior design student making botanical art prints, macramé hangings, and hand-poured soy candles.",
                "9876543212",
                "meeradecor",
                "meera@okaxis",
            ),
            (
                "diya@example.com",
                "Diya Patel",
                "Diya Woven Studio",
                "Textiles student specializing in botanical hand-embroidery, canvas tote bags, and hand-knitted pieces.",
                "9876543213",
                "diyawoven",
                "diya@okaxis",
            ),
            (
                "arjun@example.com",
                "Arjun Varma",
                "Arjun Craft & Leather",
                "Industrial design maker hand-stitching saddle leather goods, brass bookmarks, and resin stationery.",
                "9876543214",
                "arjunleather",
                "arjun@okaxis",
            ),
        ]

        sellers = {}
        for email, name, disp, bio, phone, insta, upi in artisan_specs:
            s = get_or_create_user(db, email, name, UserRole.seller, seller=True)
            sellers[email] = s
            if db.get(SellerPublic, s.id) is None:
                db.add(SellerPublic(seller_id=s.id, display_name=disp, bio=bio))
                db.add(SellerPrivate(seller_id=s.id, phone=phone, instagram=insta, upi_id=upi))
            else:
                pub = db.get(SellerPublic, s.id)
                pub.display_name, pub.bio = disp, bio
        db.flush()

        cats = {c.slug: c for c in db.execute(select(Category)).scalars()}

        # 3. Rich catalog of crafts with high-res Unsplash photography
        catalog_items = [
            # --- JEWELRY ---
            {
                "seller": sellers["asha@example.com"],
                "category": "jewelry",
                "title": "Raw Amethyst Wire-Wrapped Silver Pendant",
                "desc": "Hand-wrapped raw amethyst crystal with tarnish-resistant German silver wire. Comes on an adjustable black waxed cord.",
                "price": 45000,
                "images": [
                    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
                    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["asha@example.com"],
                "category": "jewelry",
                "title": "Dainty Freshwater Pearl Choker Necklace",
                "desc": "Cultured freshwater pearls spaced with tiny gold-plated beads. Minimalist, elegant, and perfect for daily wear.",
                "price": 38000,
                "images": [
                    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["asha@example.com"],
                "category": "jewelry",
                "title": "Textured Brass Stacking Rings (Set of 3)",
                "desc": "Three hand-hammered raw brass bands of varying textures. Coated with organic micro-crystalline wax to protect luster.",
                "price": 32000,
                "images": [
                    "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["asha@example.com"],
                "category": "jewelry",
                "title": "Hand-painted Terracotta Jhumkas",
                "desc": "Fired terracotta bells painted in turquoise and burnt orange with golden accents. Ultra-lightweight on ears.",
                "price": 22000,
                "images": [
                    "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80",
                ],
            },

            # --- POTTERY ---
            {
                "seller": sellers["ravi@example.com"],
                "category": "pottery",
                "title": "Speckled Stoneware Matcha & Coffee Bowl",
                "desc": "Wheel-thrown speckled stoneware clay with a serene sage-green food-safe glaze. Comfortable organic grip.",
                "price": 54000,
                "images": [
                    "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
                    "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["ravi@example.com"],
                "category": "pottery",
                "title": "Two-Tone Matte Glaze Espresso Cup",
                "desc": "Hand-thrown double shot espresso tumbler. Raw toasted clay exterior with a silky cream interior glaze.",
                "price": 28000,
                "images": [
                    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["ravi@example.com"],
                "category": "pottery",
                "title": "Fluted Terracotta Succulent Planter",
                "desc": "Breathable unglazed natural terracotta planter with built-in drainage hole and fluted sides. Ideal for dorm desks.",
                "price": 25000,
                "images": [
                    "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["ravi@example.com"],
                "category": "pottery",
                "title": "Hand-Carved Clay Incense & Ring Dish",
                "desc": "Shallow organic tray with a center brass eyelet for incense sticks. Features celestial crescent moon impressions.",
                "price": 19000,
                "images": [
                    "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
                ],
            },

            # --- DECOR ---
            {
                "seller": sellers["meera@example.com"],
                "category": "decor",
                "title": "Bohemian Macramé Cotton Wall Tapestry",
                "desc": "Knotted using 100% natural unbleached cotton cord hung on a sanded campus drift branch. Adds warmth to dorm walls.",
                "price": 68000,
                "images": [
                    "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["meera@example.com"],
                "category": "decor",
                "title": "Hand-Poured Soy Amber Jar Candle (Sandalwood & Vanilla)",
                "desc": "Poured in small batches using non-toxic natural soy wax and lead-free cotton wick. Burns cleanly for 35+ hours.",
                "price": 34000,
                "images": [
                    "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["meera@example.com"],
                "category": "decor",
                "title": "Sunburst Woven Rattan Accent Mirror",
                "desc": "Hand-woven natural rattan frame surrounding a 6-inch optical glass mirror. Lightweight and easy to hang with command strips.",
                "price": 79000,
                "images": [
                    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["meera@example.com"],
                "category": "decor",
                "title": "Pressed Campus Wildflower Glass Floating Frame",
                "desc": "Real wild bougainvillea and ferns collected around the college quad, carefully pressed and sealed in brass-edged glass.",
                "price": 42000,
                "images": [
                    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
                ],
            },

            # --- TEXTILES ---
            {
                "seller": sellers["diya@example.com"],
                "category": "textiles",
                "title": "Indigo Block-Printed Heavy Canvas Tote Bag",
                "desc": "Durable 14oz unbleached canvas tote with hand-stamped botanical block prints in natural indigo. Reinforced straps hold laptops & heavy books.",
                "price": 45000,
                "images": [
                    "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["diya@example.com"],
                "category": "textiles",
                "title": "Hand-Embroidered Botanical Linen Zipper Pouch",
                "desc": "Natural linen fabric embroidered with daisy blossoms and foliage. Sturdy brass YKK zipper with satin lining.",
                "price": 29000,
                "images": [
                    "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["diya@example.com"],
                "category": "textiles",
                "title": "Chunky Mustard Yellow Hand-Knitted Muffler",
                "desc": "Ultra-soft wool blend hand-knitted in ribbed stitch. Warm, cozy, and vibrant for chilly morning lectures.",
                "price": 62000,
                "images": [
                    "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["diya@example.com"],
                "category": "textiles",
                "title": "Fringed Bohemian Woven Table Runner",
                "desc": "Woven on a student loom using recycled cotton threads in earthy sand and terracotta stripes with knotted fringes.",
                "price": 52000,
                "images": [
                    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
                ],
            },

            # --- OTHER ---
            {
                "seller": sellers["arjun@example.com"],
                "category": "other",
                "title": "Hand-Stitched Tan Saddle Leather Cardholder",
                "desc": "Full-grain vegetable-tanned leather hand-stitched with waxed polyester thread. Features 3 card slots and center cash pocket.",
                "price": 49000,
                "images": [
                    "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["arjun@example.com"],
                "category": "other",
                "title": "Hand-Bound Kraft Sketchbook with Leather Wrap",
                "desc": "120 pages of 140gsm mixed-media drawing paper bound in raw cardboard with an oiled leather strap and metal clasp.",
                "price": 39000,
                "images": [
                    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["arjun@example.com"],
                "category": "other",
                "title": "Botanical Pressed Gold-Leaf Resin Coaster Set",
                "desc": "Set of 2 hexagonal epoxy resin coasters embedded with real baby's breath flowers and 24k gold leaf flakes.",
                "price": 36000,
                "images": [
                    "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
                ],
            },
            {
                "seller": sellers["arjun@example.com"],
                "category": "other",
                "title": "Vintage Hand-Carved Brass Ruler & Bookmark",
                "desc": "Solid 15cm brass bookmark engraved with celestial constellations. Will develop a rich antique patina over time.",
                "price": 24000,
                "images": [
                    "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80",
                ],
            },
        ]

        created_listings = []
        for item in catalog_items:
            existing = db.execute(
                select(Listing).where(Listing.title == item["title"], Listing.seller_id == item["seller"].id)
            ).scalar_one_or_none()

            if existing is None:
                l = Listing(
                    seller_id=item["seller"].id,
                    category_id=cats[item["category"]].id,
                    title=item["title"],
                    description=item["desc"],
                    price_paise=item["price"],
                    status=ListingStatus.active,
                )
                db.add(l)
                db.flush()
                # Add images
                for pos, img_url in enumerate(item["images"]):
                    db.add(ListingImage(listing_id=l.id, storage_path=img_url, position=pos))
                created_listings.append(l)
            else:
                # Ensure images exist
                img_count = db.execute(select(ListingImage).where(ListingImage.listing_id == existing.id)).scalars().all()
                if not img_count:
                    for pos, img_url in enumerate(item["images"]):
                        db.add(ListingImage(listing_id=existing.id, storage_path=img_url, position=pos))
                created_listings.append(existing)

        db.flush()

        # 4. Create sample fulfilled orders & verified reviews
        reviews_data = [
            (buyer1, created_listings[0], 5, "Stunning craftsmanship! The amethyst crystal is so vibrant in sunlight."),
            (buyer2, created_listings[1], 5, "Met Asha at the Library foyer. The choker is delicate and looks even prettier in person!"),
            (buyer3, created_listings[4], 5, "Ravi's matcha bowl is my daily favorite now. Great weight and finish."),
            (buyer4, created_listings[5], 4, "Really lovely espresso tumbler. Smooth handoff outside the cafeteria."),
            (buyer2, created_listings[8], 5, "Transformed my dorm room instantly. Beautiful natural macrame work."),
            (buyer3, created_listings[9], 5, "Smells incredible and burns so evenly. Definitely buying more candles from Meera."),
            (buyer1, created_listings[12], 5, "The tote bag is super sturdy! Easily holds my 15-inch laptop and textbooks."),
            (buyer4, created_listings[16], 5, "Arjun's leatherwork is top-notch. Real craftsmanship on campus."),
        ]

        now = datetime.now(timezone.utc)
        for buyer, listing, rating, comment in reviews_data:
            # Check if order already exists for this buyer and listing
            existing_order = db.execute(
                select(Order).where(Order.buyer_id == buyer.id, Order.listing_id == listing.id)
            ).scalar_one_or_none()

            if existing_order is None:
                commission = int(listing.price_paise * 0.1)
                order = Order(
                    buyer_id=buyer.id,
                    seller_id=listing.seller_id,
                    listing_id=listing.id,
                    amount_paise=listing.price_paise,
                    commission_rate=0.10,
                    commission_paise=commission,
                    seller_amount_paise=listing.price_paise - commission,
                    status=OrderStatus.fulfilled,
                    paid_at=now,
                    fulfilled_at=now,
                )
                db.add(order)
                db.flush()
                # Add review
                db.add(
                    Review(
                        order_id=order.id,
                        buyer_id=buyer.id,
                        seller_id=listing.seller_id,
                        listing_id=listing.id,
                        rating=rating,
                        comment=comment,
                    )
                )

        db.commit()

    print("\n✅ Rich marketplace demo seed complete!")
    print("----------------------------------------------------------------------")
    print(f"Password for all accounts: {PASSWORD}\n")
    print("Makers & Studios:")
    print(" • Asha Rao       (Jewelry):   asha@example.com")
    print(" • Ravi Kumar     (Pottery):   ravi@example.com")
    print(" • Meera Sen      (Decor):     meera@example.com")
    print(" • Diya Patel     (Textiles):  diya@example.com")
    print(" • Arjun Varma    (Leather):   arjun@example.com\n")
    print("Customers & Buyers:")
    print(" • Demo Buyer:                 buyer@example.com")
    print(" • Kavya Sharma:               kavya@example.com")
    print(" • Rahul Verma:                rahul@example.com")
    print(" • Sneha Nair:                 sneha@example.com\n")
    print("Admin:")
    print(" • Demo Admin:                 admin@example.com")
    print("----------------------------------------------------------------------\n")


if __name__ == "__main__":
    main()
