import io
import json

import pytest
from PIL import Image

from app.config import Settings
from app.models import Listing, ListingStatus, Order, OrderStatus, Payment, Payout, Review

from .conftest import PASSWORD


def png(size=(20, 20)) -> bytes:
    b = io.BytesIO()
    Image.new("RGB", size, "red").save(b, "PNG")
    return b.getvalue()


def cat_id(client):
    return client.get("/api/categories").json()[0]["id"]


# ---- seller flow -------------------------------------------------------------
def test_seller_apply_approve_and_listing_flow(client, world):
    buyer = world.user()
    h = world.headers(buyer)
    apply = {"display_name": "Asha", "bio": "hi", "phone": "9876543210", "instagram": "asha", "upi_id": "asha@okaxis"}
    assert client.post("/api/seller/apply", json=apply, headers=h).status_code == 201
    assert client.get("/api/seller/listings", headers=h).status_code == 403  # pending
    admin, ah = world.admin()
    sellers = client.get("/api/admin/sellers", headers=ah).json()
    assert client.post(f"/api/admin/sellers/{sellers[0]['id']}/decision", json={"decision": "approve"}, headers=ah).status_code == 200
    body = {"title": "Bead necklace", "category_id": cat_id(client), "description": "nice", "price_paise": 25000}
    r = client.post("/api/seller/listings", json=body, headers=h)
    assert r.status_code == 201 and r.json()["status"] == "pending_review"
    lid = r.json()["id"]
    assert client.get("/api/listings").json()["total"] == 0  # not public yet
    assert client.post(f"/api/admin/listings/{lid}/decision", json={"decision": "approve"}, headers=ah).status_code == 200
    page = client.get("/api/listings").json()
    assert page["total"] == 1 and "upi_id" not in json.dumps(page) and "phone" not in json.dumps(page)


def test_9_seller_cannot_self_activate(client, world):
    s = world.user(seller=True)
    h = world.headers(s)
    l = world.listing(s, status=ListingStatus.pending_review)
    for status in ("active", "sold"):
        assert client.patch(f"/api/seller/listings/{l.id}", json={"status": status}, headers=h).status_code == 422
        body = {"title": "abc", "category_id": cat_id(client), "description": "d", "price_paise": 100, "status": status}
        assert client.post("/api/seller/listings", json=body, headers=h).status_code == 422


def test_17_upload_restrictions(client, world):
    s = world.user(seller=True)
    h = world.headers(s)
    l = world.listing(s)
    url = f"/api/seller/listings/{l.id}/images"
    fake = client.post(url, files={"file": ("x.jpg", b"alert(1)", "image/jpeg")}, headers=h)
    assert fake.status_code == 400
    big = io.BytesIO()
    Image.frombytes("RGB", (1500, 1500), __import__("os").urandom(1500 * 1500 * 3)).save(big, "PNG")
    assert len(big.getvalue()) > 2 * 1024 * 1024
    assert client.post(url, files={"file": ("big.png", big.getvalue(), "image/png")}, headers=h).status_code == 413
    gif = io.BytesIO()
    Image.new("RGB", (5, 5)).save(gif, "GIF")
    assert client.post(url, files={"file": ("a.gif", gif.getvalue(), "image/gif")}, headers=h).status_code == 400
    for _ in range(3):
        assert client.post(url, files={"file": ("ok.png", png(), "image/png")}, headers=h).status_code == 201
    assert client.post(url, files={"file": ("ok.png", png(), "image/png")}, headers=h).status_code == 400
    # buyers cannot upload
    other = world.headers(world.user())
    assert client.post(url, files={"file": ("ok.png", png(), "image/png")}, headers=other).status_code == 403


def test_18_input_validation(client, world):
    s = world.user(seller=True)
    h = world.headers(s)
    base = {"title": "abc", "category_id": cat_id(client), "description": "d", "price_paise": 100}
    assert client.post("/api/seller/listings", json={**base, "price_paise": -5}, headers=h).status_code == 422
    assert client.post("/api/seller/listings", json={**base, "price_paise": 0}, headers=h).status_code == 422
    bad = {"display_name": "Asha", "bio": "", "phone": "abc", "upi_id": "asha@okaxis"}
    assert client.post("/api/seller/apply", json=bad, headers=world.headers(world.user())).status_code == 422
    assert client.patch("/api/me", json={"phone": "not-a-phone!"}, headers=h).status_code == 422
    b = world.user()
    o = world.order(world.headers(b), world.listing(s).id)
    assert client.post(f"/api/orders/{o['id']}/review", json={"rating": 9}, headers=world.headers(b)).status_code == 422
    assert client.post(f"/api/orders/{o['id']}/review", json={"rating": 5, "comment": "x" * 5000}, headers=world.headers(b)).status_code == 422


# ---- privacy -------------------------------------------------------------------
def test_6_7_8_contact_masking_and_isolation(client, world):
    s = world.user(seller=True)
    l = world.listing(s)
    buyer, other = world.user(), world.user()
    bh, oh = world.headers(buyer), world.headers(other)
    secrets = ["9876500000", "shop_ig", "shop@okaxis"]
    for resp in (client.get("/api/listings"), client.get(f"/api/listings/{l.id}"), client.get(f"/api/sellers/{s.id}")):
        assert not any(x in resp.text for x in secrets)
    o = world.order(bh, l.id)
    assert o["seller_contact"] is None and not any(x in json.dumps(o) for x in secrets)
    assert client.get(f"/api/orders/{o['id']}", headers=oh).status_code == 404  # 8
    assert client.get(f"/api/orders/{o['id']}", headers=bh).json()["seller_contact"] is None
    assert world.webhook(o["id"], l.price_paise).status_code == 200
    mine = client.get(f"/api/orders/{o['id']}", headers=bh).json()
    assert mine["status"] == "paid" and mine["seller_contact"]["phone"] == "9876500000"  # 7
    l2 = world.listing(s)
    o2 = world.order(oh, l2.id)  # a different buyer, unpaid: still nothing
    assert o2["seller_contact"] is None
    # seller sees buyer contact only after payment; listings of another seller are 404
    sh = world.headers(s)
    rows = client.get("/api/seller/orders", headers=sh).json()
    by = {r["id"]: r for r in rows}
    assert by[o["id"]]["buyer_phone"] is None or by[o["id"]]["buyer_name"]
    assert by[o2["id"]]["buyer_name"] is None
    s2 = world.user(seller=True)
    assert client.get(f"/api/seller/listings/{l.id}", headers=world.headers(s2)).status_code == 404
    assert client.patch(f"/api/seller/listings/{l.id}", json={"title": "hax"}, headers=world.headers(s2)).status_code == 404


# ---- checkout / payments ---------------------------------------------------------
def test_1_price_server_side(client, world, db):
    s = world.user(seller=True)
    l = world.listing(s, price=50000)
    bh = world.headers(world.user())
    r = client.post("/api/orders", json={"listing_id": str(l.id), "amount_paise": 1}, headers=bh)
    assert r.status_code == 422
    o = world.order(bh, l.id)
    row = db.get(Order, o["id"])
    assert row.amount_paise == 50000 and row.commission_paise == 5000 and row.seller_amount_paise == 45000


def test_10_cannot_buy_own_listing(client, world):
    s = world.user(seller=True)
    l = world.listing(s)
    assert client.post("/api/orders", json={"listing_id": str(l.id)}, headers=world.headers(s)).status_code == 400


def test_2_webhook_signature(client, world, db):
    s = world.user(seller=True)
    l = world.listing(s)
    o = world.order(world.headers(world.user()), l.id)
    assert world.webhook(o["id"], l.price_paise, sign=False).status_code == 400
    assert world.webhook(o["id"], l.price_paise, secret="wrong").status_code == 400
    assert db.get(Order, o["id"]).status == OrderStatus.pending_payment
    assert db.query(Payment).count() == 0


def test_3_webhook_idempotent(client, world, db, outbox):
    s = world.user(seller=True)
    l = world.listing(s)
    o = world.order(world.headers(world.user()), l.id)
    assert world.webhook(o["id"], l.price_paise, payment_id="pay_1", event_id="evt_1").json()["status"] == "ok"
    n = len(outbox)
    assert world.webhook(o["id"], l.price_paise, payment_id="pay_1", event_id="evt_1").json()["status"] == "duplicate"
    # even a replay with a fresh event id changes nothing
    assert world.webhook(o["id"], l.price_paise, payment_id="pay_1", event_id="evt_2").status_code == 200
    assert (db.query(Payment).count(), db.query(Payout).count(), len(outbox)) == (1, 1, n)


def test_11_double_sale(client, world, db):
    s = world.user(seller=True)
    l = world.listing(s)
    o1 = world.order(world.headers(world.user()), l.id)
    o2 = world.order(world.headers(world.user()), l.id)
    world.webhook(o1["id"], l.price_paise)
    world.webhook(o2["id"], l.price_paise)
    db.expire_all()
    assert db.get(Listing, l.id).status == ListingStatus.sold
    assert not db.get(Order, o1["id"]).needs_refund and db.get(Order, o2["id"]).needs_refund
    assert db.query(Payout).count() == 1 and db.query(Payment).count() == 2


def test_amount_mismatch_flagged(client, world, db):
    s = world.user(seller=True)
    l = world.listing(s)
    o = world.order(world.headers(world.user()), l.id)
    world.webhook(o["id"], l.price_paise - 100)
    db.expire_all()
    assert db.get(Order, o["id"]).needs_refund and db.query(Payout).count() == 0


def test_4_money_not_client_writable(client, world):
    b = world.user()
    h = world.headers(b)
    s = world.user(seller=True)
    o = world.order(h, world.listing(s).id)
    for method, path in [
        ("patch", f"/api/orders/{o['id']}"), ("put", f"/api/orders/{o['id']}"), ("delete", f"/api/orders/{o['id']}"),
        ("post", "/api/payments"), ("post", "/api/payouts"), ("post", f"/api/admin/orders/{o['id']}/fulfill"),
        ("post", f"/api/admin/payouts/{o['id']}/mark-paid"), ("post", f"/api/orders/{o['id']}/pay"),
    ]:
        assert getattr(client, method)(path, headers=h).status_code in (403, 404, 405), (method, path)


def test_22_checkout_return_never_trusts_url(client, world):
    s = world.user(seller=True)
    b = world.user()
    bh = world.headers(b)
    o = world.order(bh, world.listing(s).id)
    # the API has no way to be told "success"; status only changes via the verified payment path
    assert client.get(f"/api/orders/{o['id']}?status=success&razorpay_payment_link_status=paid", headers=bh).json()["status"] == "pending_payment"


def test_24_mock_mode_safety(client, world, monkeypatch):
    with pytest.raises(RuntimeError):
        Settings(environment="production", payment_mode="mock").check_startup()
    Settings(environment="production", payment_mode="razorpay", razorpay_key_id="k", razorpay_key_secret="s",
             razorpay_webhook_secret="w", jwt_secret="x" * 40).check_startup()
    # in razorpay mode the dev route doesn't exist
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import create_app

    monkeypatch.setattr(get_settings(), "payment_mode", "razorpay")
    app2 = create_app()
    assert TestClient(app2).post("/api/dev/simulate-payment/00000000-0000-0000-0000-000000000000").status_code == 404


def test_mock_checkout_uses_same_path(client, world, db):
    s = world.user(seller=True)
    l = world.listing(s)
    bh = world.headers(world.user())
    o = world.order(bh, l.id)
    assert o["payment_url"].endswith(f"/mock-pay/{o['id']}")
    assert client.post(f"/api/dev/simulate-payment/{o['id']}").status_code == 200
    assert client.get(f"/api/orders/{o['id']}", headers=bh).json()["status"] == "paid"


def test_expiry_cancels_stale_orders(client, world, db):
    from datetime import datetime, timedelta, timezone

    from app.services.payments import expire_stale_orders

    s = world.user(seller=True)
    o = world.order(world.headers(world.user()), world.listing(s).id)
    db.query(Order).update({"created_at": datetime.now(timezone.utc) - timedelta(minutes=45)})
    db.commit()
    assert expire_stale_orders(db) == 1
    db.expire_all()
    assert db.get(Order, o["id"]).status == OrderStatus.cancelled
    # a payment that still arrives is not lost
    world.webhook(o["id"], 50000)
    db.expire_all()
    assert db.get(Order, o["id"]).needs_refund


# ---- admin / reviews -----------------------------------------------------------------
def test_14_admin_routes_protected(client, world):
    s = world.user(seller=True)
    b = world.user()
    routes = [
        ("get", "/api/admin/sellers"), ("get", "/api/admin/listings"), ("get", "/api/admin/orders"),
        ("get", "/api/admin/payouts"), ("get", "/api/admin/metrics"),
        ("post", f"/api/admin/sellers/{s.id}/decision"), ("post", f"/api/admin/listings/{s.id}/decision"),
        ("post", f"/api/admin/orders/{s.id}/fulfill"), ("post", f"/api/admin/orders/{s.id}/cancel"),
        ("post", f"/api/admin/orders/{s.id}/refund"), ("post", f"/api/admin/payouts/{s.id}/mark-paid"),
    ]
    for h in (world.headers(b), world.headers(s)):
        for method, path in routes:
            r = getattr(client, method)(path, headers=h)
            assert r.status_code == 403 and "error" in r.json() and len(r.text) < 100, (method, path)
    for method, path in routes:
        assert getattr(client, method)(path).status_code == 401


def test_12_reviews_gated_and_full_admin_flow(client, world, db, outbox):
    s = world.user(seller=True)
    l = world.listing(s)
    b, other = world.user(name="Bina Rao"), world.user()
    bh, oh = world.headers(b), world.headers(other)
    o = world.order(bh, l.id)
    review = {"rating": 5, "comment": "great"}
    assert client.post(f"/api/orders/{o['id']}/review", json=review, headers=bh).status_code == 400  # unpaid
    world.webhook(o["id"], l.price_paise)
    assert client.post(f"/api/orders/{o['id']}/review", json=review, headers=bh).status_code == 400  # not fulfilled
    admin, ah = world.admin()
    assert client.post(f"/api/admin/orders/{o['id']}/fulfill", headers=ah).status_code == 200
    assert client.post(f"/api/orders/{o['id']}/review", json=review, headers=oh).status_code == 404  # someone else's
    assert client.post(f"/api/orders/{o['id']}/review", json=review, headers=bh).status_code == 201
    assert client.post(f"/api/orders/{o['id']}/review", json=review, headers=bh).status_code == 409  # second
    assert db.query(Review).count() == 1
    prof = client.get(f"/api/sellers/{s.id}").json()
    assert prof["avg_rating"] == 5 and prof["review_count"] == 1 and prof["reviews"][0]["buyer_name"] == "Bina"
    # payouts
    pay = client.get("/api/admin/payouts", headers=ah).json()
    assert pay[0]["upi_id"] == "shop@okaxis" and pay[0]["amount_paise"] == 45000
    assert client.post(f"/api/admin/payouts/{pay[0]['id']}/mark-paid", json={"upi_txn_ref": "UTR12345"}, headers=ah).status_code == 200
    assert client.get("/api/seller/payouts", headers=world.headers(s)).json()[0]["status"] == "paid"
    m = client.get("/api/admin/metrics", headers=ah).json()
    assert m["paid_orders"] == 1 and m["gmv_paise"] == 50000 and m["commission_paise"] == 5000
    assert any("review" in x["body"].lower() for x in outbox if x["to"] == b.email)


def test_search_and_pagination(client, world):
    s = world.user(seller=True)
    world.listing(s, title="Red 100% vase")
    world.listing(s, title="Blue mug")
    assert client.get("/api/listings?q=vase").json()["total"] == 1
    assert client.get("/api/listings?q=%25").json()["total"] == 1  # wildcard is escaped
    assert client.get("/api/listings?q=' OR 1=1 --").json()["total"] == 0
    assert client.get("/api/listings?category=nope").json()["total"] == 0
    assert client.get("/health").status_code in (200, 404)


# ---- static checks (#19, #20) ------------------------------------------------------
def test_19_no_raw_sql_or_xss_sinks():
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parents[2]
    for f in (root / "backend" / "app").rglob("*.py"):
        src = f.read_text()
        assert not re.search(r"""(execute|text)\(\s*f["']""", src) or f.name == "catalog_queries.py", f
    for f in (root / "frontend" / "src").rglob("*.tsx"):
        assert "dangerouslySetInnerHTML" not in f.read_text(), f


def test_20_secrets_not_in_git_or_frontend():
    import pathlib
    import subprocess

    root = pathlib.Path(__file__).resolve().parents[2]
    tracked = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True).stdout.split()
    assert not [t for t in tracked if t.endswith(".env")]
    for f in (root / "frontend" / "src").rglob("*"):
        if f.is_file():
            t = f.read_text().lower()
            assert "razorpay_key_secret" not in t and "jwt_secret" not in t, f
