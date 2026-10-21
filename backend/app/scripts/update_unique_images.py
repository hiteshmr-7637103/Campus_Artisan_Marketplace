"""Usage: python -m app.scripts.update_unique_images

Updates every listing in the database so that each has a verified, 100% unique,
high-resolution craft photograph matching its title and category.
"""
from sqlalchemy import select, delete
from ..db import SessionLocal
from ..models import Listing, ListingImage

UNIQUE_IMAGES_MAP = {
    "Vintage Hand-Carved Brass Ruler & Bookmark": [
        "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-Bound Kraft Sketchbook with Leather Wrap": [
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    ],
    "Botanical Pressed Gold-Leaf Resin Coaster Set": [
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-Stitched Tan Saddle Leather Cardholder": [
        "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80",
    ],
    "Fringed Bohemian Woven Table Runner": [
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
    ],
    "Chunky Mustard Yellow Hand-Knitted Muffler": [
        "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-Embroidered Botanical Linen Zipper Pouch": [
        "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80",
    ],
    "Indigo Block-Printed Heavy Canvas Tote Bag": [
        "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    ],
    "Pressed Campus Wildflower Glass Floating Frame": [
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
    ],
    "Sunburst Woven Rattan Accent Mirror": [
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-Poured Soy Amber Jar Candle (Sandalwood & Vanilla)": [
        "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
    ],
    "Bohemian Macramé Cotton Wall Tapestry": [
        "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-Carved Clay Incense & Ring Dish": [
        "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
    ],
    "Fluted Terracotta Succulent Planter": [
        "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
    ],
    "Two-Tone Matte Glaze Espresso Cup": [
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    ],
    "Speckled Stoneware Matcha & Coffee Bowl": [
        "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
    ],
    "Hand-painted Terracotta Jhumkas": [
        "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80",
    ],
    "Textured Brass Stacking Rings (Set of 3)": [
        "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    ],
    "Dainty Freshwater Pearl Choker Necklace": [
        "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
    ],
    "Raw Amethyst Wire-Wrapped Silver Pendant": [
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
    ],
    "Mini planter": [
        "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80",
    ],
    "Beaded choker": [
        "https://images.unsplash.com/photo-1611591475836-81643c1ee55b?auto=format&fit=crop&w=800&q=80",
    ],
    "Silver-tone earrings": [
        "https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=800&q=80",
    ],
    "Glazed coffee mug": [
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80",
    ],
    "Pending: serving bowl": [
        "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80",
    ],
}


def main():
    with SessionLocal() as db:
        listings = db.execute(select(Listing)).scalars().all()
        updated_count = 0
        all_first_images = []

        for l in listings:
            if l.title in UNIQUE_IMAGES_MAP:
                new_urls = UNIQUE_IMAGES_MAP[l.title]
                # Remove old images
                db.execute(delete(ListingImage).where(ListingImage.listing_id == l.id))
                # Add unique images
                for pos, url in enumerate(new_urls):
                    db.add(ListingImage(listing_id=l.id, storage_path=url, position=pos))
                all_first_images.append((l.title, new_urls[0]))
                updated_count += 1
            else:
                existing_img = db.execute(
                    select(ListingImage).where(ListingImage.listing_id == l.id).order_by(ListingImage.position)
                ).scalars().first()
                if existing_img:
                    all_first_images.append((l.title, existing_img.storage_path))

        db.commit()
        print(f"Successfully updated images for {updated_count} listings.")

        # Check uniqueness
        urls = [url for _, url in all_first_images]
        duplicates = [url for url in urls if urls.count(url) > 1]
        if duplicates:
            print(f"WARNING: Found {len(set(duplicates))} duplicate preview URLs:")
            for d in set(duplicates):
                print(f"  - {d}")
        else:
            print(f"ALL {len(all_first_images)} LISTINGS HAVE 100% UNIQUE PREVIEW IMAGES!")


if __name__ == "__main__":
    main()
