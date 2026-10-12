import hashlib
import hmac
import logging

import httpx

from ..config import get_settings
from ..models import Order

log = logging.getLogger("app.razorpay")
API = "https://api.razorpay.com/v1"


def create_payment_link(order: Order, title: str, buyer_name: str, buyer_email: str) -> tuple[str, str]:
    """Returns (payment_link_id, url). In mock mode points at the local fake checkout page."""
    s = get_settings()
    if s.payment_mode == "mock":
        return f"mock_{order.id}", f"{s.frontend_url.rstrip('/')}/mock-pay/{order.id}"
    r = httpx.post(
        f"{API}/payment_links",
        auth=(s.razorpay_key_id, s.razorpay_key_secret),
        json={
            "amount": order.amount_paise,
            "currency": "INR",
            "reference_id": str(order.id),
            "description": title[:200],
            "customer": {"name": buyer_name, "email": buyer_email},
            "notify": {"sms": False, "email": False},
            "callback_url": f"{s.frontend_url.rstrip('/')}/checkout/return?order_id={order.id}",
            "callback_method": "get",
        },
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return data["id"], data["short_url"]


def cancel_payment_link(link_id: str | None) -> None:
    s = get_settings()
    if s.payment_mode == "mock" or not link_id or link_id.startswith("mock_"):
        return
    try:
        httpx.post(f"{API}/payment_links/{link_id}/cancel", auth=(s.razorpay_key_id, s.razorpay_key_secret), timeout=15).raise_for_status()
    except Exception:  # noqa: BLE001
        log.exception("could not cancel payment link %s", link_id)


def verify_signature(raw_body: bytes, signature: str | None) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
