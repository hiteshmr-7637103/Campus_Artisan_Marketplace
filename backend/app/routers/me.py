from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import MeUpdate, UserOut

router = APIRouter(tags=["me"])


def user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, full_name=u.full_name, phone=u.phone, role=u.role,
        seller_status=u.seller_status, email_verified=u.email_verified_at is not None,
    )


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(current_user)):
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # MeUpdate forbids extra fields, so role/seller_status/email can never be written here.
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return user_out(user)
