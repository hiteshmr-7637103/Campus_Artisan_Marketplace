import hashlib
import json
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Order, OrderStatus, WebhookEvent
from ..services import payments, razorpay
from ..services import email as email_service

log = logging.getLogger("app.webhook")
router = APIRouter(tags=["payments"])


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    raw = await request.body()  # signature is over the RAW body
    if not razorpay.verify_signature(raw, request.headers.get("x-razorpay-signature")):
        raise HTTPException(400, "Invalid signature")
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Invalid payload") from None

    event_id = request.headers.get("x-razorpay-event-id") or hashlib.sha256(raw).hexdigest()
    etype = str(event.get("event", ""))
    inserted = db.execute(
        insert(WebhookEvent).values(event_id=event_id, type=etype[:80]).on_conflict_do_nothing(index_elements=["event_id"]).returning(WebhookEvent.id)
    ).first()
    db.commit()
    if inserted is None:
        return {"status": "duplicate"}

    if etype in ("payment_link.paid", "payment.captured", "order.paid"):
        try:
            payload = event.get("payload", {})
            link = payload.get("payment_link", {}).get("entity", {})
            pay = payload.get("payment", {}).get("entity", {})
            order_id = uuid.UUID(link.get("reference_id") or pay.get("notes", {}).get("reference_id", ""))
            payment_id = pay["id"]
            amount = int(pay.get("amount", link.get("amount_paid", 0)))
            outcome = payments.mark_order_paid(db, order_id, payment_id, amount, raw_event=event)
        except Exception:
            # Release the idempotency row so Razorpay's retry can process it, and alert.
            db.rollback()
            db.execute(WebhookEvent.__table__.delete().where(WebhookEvent.event_id == event_id))
            db.commit()
            log.exception("webhook processing failed for event %s", event_id)
            background.add_task(email_service.send_alert, "Razorpay webhook failed", f"event {event_id} ({etype}) failed; see logs")
            raise HTTPException(500, "Processing failed") from None
        background.add_task(payments.send_paid_emails, outcome)
    return {"status": "ok"}


# Dev-only: registered only in mock mode (otherwise the route does not exist -> 404).
dev_router = APIRouter(tags=["dev"])


@dev_router.post("/dev/simulate-payment/{order_id}")
def simulate_payment(order_id: uuid.UUID, background: BackgroundTasks, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if order is None or order.status != OrderStatus.pending_payment:
        raise HTTPException(404, "No pending order")
    outcome = payments.mark_order_paid(db, order.id, f"mock_pay_{uuid.uuid4().hex[:16]}", order.amount_paise, raw_event={"mock": True})
    background.add_task(payments.send_paid_emails, outcome)
    return {"status": "paid" if outcome.changed else "ignored"}
