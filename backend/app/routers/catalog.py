import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Listing, Review, SellerPublic, SellerStatus, User
from ..schemas import CategoryOut, ListingOut, ListingPage, ReviewOut, SellerProfileOut
from ..services import catalog_queries as cq

router = APIRouter(tags=["catalog"])
PAGE_SIZE = 24


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: Session = Depends(get_db)):
    return db.execute(select(Category).order_by(Category.name)).scalars().all()


@router.get("/listings", response_model=ListingPage)
def listings(
    category: str | None = Query(default=None, max_length=60),
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1, le=10_000),
    db: Session = Depends(get_db),
):
    items, total = cq.list_public(db, category, q, page, PAGE_SIZE)
    return ListingPage(items=items, page=page, page_size=PAGE_SIZE, total=total)


@router.get("/listings/{listing_id}", response_model=ListingOut)
def listing_detail(listing_id: uuid.UUID, db: Session = Depends(get_db)):
    item = cq.get_public(db, listing_id)
    if item is None:
        raise HTTPException(404, "Listing not found")
    return item


@router.get("/sellers/{seller_id}", response_model=SellerProfileOut)
def seller_profile(seller_id: uuid.UUID, db: Session = Depends(get_db)):
    user = db.get(User, seller_id)
    pub = db.get(SellerPublic, seller_id)
    if user is None or pub is None or user.seller_status != SellerStatus.approved:
        raise HTTPException(404, "Seller not found")
    avg, count = cq.seller_rating(db, seller_id)
    rows = db.execute(
        select(Review, User.full_name, Listing.title)
        .join(User, User.id == Review.buyer_id)
        .join(Listing, Listing.id == Review.listing_id)
        .where(Review.seller_id == seller_id)
        .order_by(Review.created_at.desc())
        .limit(20)
    ).all()
    reviews = [
        ReviewOut(id=r.id, rating=r.rating, comment=r.comment, buyer_name=name.split()[0] if name.split() else "Buyer", listing_title=title, created_at=r.created_at)
        for r, name, title in rows
    ]
    items, _ = cq.list_public(db, None, None, 1, 50, seller_id=seller_id)
    return SellerProfileOut(id=seller_id, display_name=pub.display_name, bio=pub.bio, avg_rating=avg, review_count=count, reviews=reviews, listings=items)
