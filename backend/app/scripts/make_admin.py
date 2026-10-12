"""Usage: python -m app.scripts.make_admin <email>

The only way to create an admin. The user must have signed up already.
"""
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from ..db import SessionLocal
from ..models import User, UserRole


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.email == sys.argv[1])).scalar_one_or_none()
        if user is None:
            print(f"No user with email {sys.argv[1]!r}. Sign up first, then run this again.")
            return 1
        user.role = UserRole.admin
        user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)
        db.commit()
        print(f"{user.email} is now an admin.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
