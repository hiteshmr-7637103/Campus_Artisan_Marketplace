"""Transactional email via Resend. Prints to the console when no API key is set.

Every public function swallows its own errors: an email failure must never break a flow.
"""
import html
import logging
from collections.abc import Callable
from functools import wraps

import httpx

from ..config import get_settings

log = logging.getLogger("app.email")


def _safe(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception:  # noqa: BLE001
            log.exception("email %s failed", fn.__name__)

    return wrapper


def send_email(to: str, subject: str, body_html: str) -> None:
    s = get_settings()
    if not s.resend_api_key:
        # Dev fallback. This does print links (verification/reset) so you can click them locally.
        print(f"\n--- EMAIL to={to} subject={subject!r} ---\n{body_html}\n--- end email ---\n", flush=True)
        return
    r = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {s.resend_api_key}"},
        json={"from": s.email_from, "to": [to], "subject": subject, "html": body_html},
        timeout=10,
    )
    r.raise_for_status()


def _link(path: str) -> str:
    return get_settings().frontend_url.rstrip("/") + path


def _wrap(title: str, body: str) -> str:
    return f"<h2>{html.escape(title)}</h2>{body}<p style='color:#888'>Campus Artisan Marketplace</p>"


def _e(s: str) -> str:
    return html.escape(s)


@_safe
def send_verification(to: str, token: str) -> None:
    url = _link(f"/verify-email?token={token}")
    send_email(to, "Verify your email", _wrap("Verify your email", f"<p><a href='{url}'>Confirm your email</a> (valid for 24 hours).</p><p>{url}</p>"))


@_safe
def send_password_reset(to: str, token: str) -> None:
    url = _link(f"/reset-password?token={token}")
    send_email(to, "Reset your password", _wrap("Reset your password", f"<p><a href='{url}'>Choose a new password</a> (valid for 1 hour).</p><p>{url}</p>"))


@_safe
def send_order_paid_buyer(to: str, title: str, order_id: str, needs_refund: bool) -> None:
    if needs_refund:
        body = f"<p>We received your payment for <b>{_e(title)}</b>, but the item was sold to someone else first. We will refund you manually; reply to this email if you have questions.</p>"
    else:
        body = f"<p>Your payment for <b>{_e(title)}</b> is confirmed. <a href='{_link(f'/orders/{order_id}')}'>View the order</a> to see the seller's contact details.</p>"
    send_email(to, "Payment received", _wrap("Payment received", body))


@_safe
def send_order_paid_seller(to: str, title: str) -> None:
    send_email(to, "You made a sale!", _wrap("You made a sale", f"<p><b>{_e(title)}</b> has been paid for. Check your seller dashboard for the buyer's details and arrange the handover.</p>"))


@_safe
def send_order_fulfilled(to: str, title: str, order_id: str) -> None:
    url = _link(f"/orders/{order_id}")
    send_email(to, "How was your purchase?", _wrap("Order complete", f"<p>Your order for <b>{_e(title)}</b> is complete. <a href='{url}'>Leave a review</a>.</p>"))


@_safe
def send_seller_decision(to: str, approved: bool, reason: str | None) -> None:
    if approved:
        body = f"<p>You're approved as a seller! <a href='{_link('/sell')}'>Open your dashboard</a> and add your first listing.</p>"
    else:
        body = f"<p>Your seller application was not approved.{' Reason: ' + _e(reason) if reason else ''}</p>"
    send_email(to, "Seller application update", _wrap("Seller application", body))


@_safe
def send_listing_decision(to: str, title: str, approved: bool, reason: str | None) -> None:
    if approved:
        body = f"<p><b>{_e(title)}</b> is now live.</p>"
    else:
        body = f"<p><b>{_e(title)}</b> was not approved.{' Reason: ' + _e(reason) if reason else ''}</p>"
    send_email(to, "Listing update", _wrap("Listing update", body))


@_safe
def send_alert(subject: str, body: str) -> None:
    """Operational alert (5xx, webhook failures) to the founder, if configured."""
    s = get_settings()
    import os

    to = os.environ.get("ALERT_EMAIL", "")
    if to:
        send_email(to, f"[alert] {subject}", f"<pre>{_e(body)}</pre>")
