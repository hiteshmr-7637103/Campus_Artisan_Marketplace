import re

from app.models import SellerPrivate
from .conftest import PASSWORD


def test_request_requires_correct_password(client, world):
    s = world.user(seller=True)
    h = world.headers(s)
    r = client.post("/api/seller/upi/request-change", json={"password": "wrong-password", "new_upi_id": "new@okaxis"}, headers=h)
    assert r.status_code == 401


def test_full_change_flow(client, world, db, outbox):
    s = world.user(seller=True)
    h = world.headers(s)
    r = client.post("/api/seller/upi/request-change", json={"password": PASSWORD, "new_upi_id": "new@okaxis"}, headers=h)
    assert r.status_code == 202
    priv = db.get(SellerPrivate, s.id)
    assert priv.pending_upi_id == "new@okaxis" and priv.upi_id != "new@okaxis"

    token = re.search(r"token=([\w-]+)", [m["body"] for m in outbox if m["to"] == s.email][-1]).group(1)
    confirm = client.post("/api/seller/upi/confirm-change", json={"token": token})
    assert confirm.status_code == 200
    db.expire_all()
    priv = db.get(SellerPrivate, s.id)
    assert priv.upi_id == "new@okaxis" and priv.pending_upi_id is None and priv.upi_updated_at is not None

    # single-use
    assert client.post("/api/seller/upi/confirm-change", json={"token": token}).status_code == 400


def test_bad_token_rejected(client):
    assert client.post("/api/seller/upi/confirm-change", json={"token": "not-a-real-token-xxxxxxxxxx"}).status_code == 400


def test_other_seller_cannot_request_for_someone_else(client, world):
    s = world.user(seller=True)
    buyer = world.user()
    h = world.headers(buyer)
    assert client.post("/api/seller/upi/request-change", json={"password": PASSWORD, "new_upi_id": "new@okaxis"}, headers=h).status_code == 403
