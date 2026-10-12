"""Reads the public-safe SQL views (public_listings, seller_ratings) with bound parameters only."""
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..schemas import ListingOut, SellerBrief
from .uploads import image_url

_COLS = "id, title, description, price_paise, category_name, category_slug, seller_id, seller_display_name, avg_rating, review_count, image_paths, created_at"


def _row_to_listing(r) -> ListingOut:
    return ListingOut(
        id=r.id,
        title=r.title,
        description=r.description,
        price_paise=r.price_paise,
        category=r.category_name,
        category_slug=r.category_slug,
        images=[image_url(p) for p in (r.image_paths or [])],
        seller=SellerBrief(id=r.seller_id, display_name=r.seller_display_name, avg_rating=float(r.avg_rating) if r.avg_rating is not None else None, review_count=r.review_count),
        created_at=r.created_at,
    )


def _escape_like(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_public(db: Session, category: str | None, q: str | None, page: int, page_size: int, seller_id: uuid.UUID | None = None):
    where = ["true"]
    params: dict = {"limit": page_size, "offset": (page - 1) * page_size}
    if category:
        where.append("category_slug = :category")
        params["category"] = category
    if q:
        where.append("title ILIKE :q ESCAPE '\\'")
        params["q"] = f"%{_escape_like(q)}%"
    if seller_id:
        where.append("seller_id = :seller_id")
        params["seller_id"] = seller_id
    clause = " AND ".join(where)  # fixed fragments only; all values are bound parameters
    total = db.execute(text(f"SELECT count(*) FROM public_listings WHERE {clause}"), params).scalar_one()
    rows = db.execute(text(f"SELECT {_COLS} FROM public_listings WHERE {clause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"), params).all()
    return [_row_to_listing(r) for r in rows], total


def get_public(db: Session, listing_id: uuid.UUID) -> ListingOut | None:
    r = db.execute(text(f"SELECT {_COLS} FROM public_listings WHERE id = :id"), {"id": listing_id}).first()
    return _row_to_listing(r) if r else None


def seller_rating(db: Session, seller_id: uuid.UUID) -> tuple[float | None, int]:
    r = db.execute(text("SELECT avg_rating, review_count FROM seller_ratings WHERE seller_id = :id"), {"id": seller_id}).first()
    if not r:
        return None, 0
    return (float(r.avg_rating) if r.avg_rating is not None else None), r.review_count
