import json

import stripe
from fastapi import APIRouter, Header, HTTPException, Request, status

from backend.core.config import settings
from backend.repositories.webhook_event_repository import webhook_event_repository
from backend.services.river_service import (
    handle_webhook as handle_river_webhook,
    verify_webhook_signature as verify_river_webhook_signature,
)
from backend.services.stripe_service import handle_webhook as handle_stripe_webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    if stripe_signature is None:
        print("Stripe webhook rejected: missing Stripe-Signature header")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header",
        )

    if not settings.stripe_webhook_secret:
        print("Stripe webhook rejected: missing STRIPE_WEBHOOK_SECRET")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing STRIPE_WEBHOOK_SECRET",
        )

    payload = await request.body()

    try:
        stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
        event = json.loads(payload)
    except ValueError:
        print("Stripe webhook rejected: invalid payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )
    except stripe.SignatureVerificationError:
        print("Stripe webhook rejected: invalid signature")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        )

    event_id = event.get("id")
    event_type = event.get("type", "unknown")
    if event_id and not webhook_event_repository.reserve(event_id, "stripe", event_type):
        print(f"Stripe webhook duplicate ignored: {event_id}")
        return {"status": "duplicate"}

    handle_stripe_webhook(event)
    if event_id:
        webhook_event_repository.mark_processed(event_id)

    return {"status": "received"}


@router.post("/river")
async def river_webhook(
    request: Request,
    river_signature: str | None = Header(default=None, alias="River-Signature"),
) -> dict[str, str]:
    payload = await request.body()

    if river_signature is None:
        print("River webhook rejected: missing River-Signature header")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing River-Signature header",
        )

    if not verify_river_webhook_signature(payload, river_signature):
        print("River webhook rejected: invalid signature")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid River signature",
        )

    try:
        event = json.loads(payload)
    except ValueError:
        print("River webhook rejected: invalid payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )

    event_id = event.get("id") or event.get("event_id")
    event_type = event.get("type", "unknown")
    if event_id and not webhook_event_repository.reserve(event_id, "river", event_type):
        print(f"River webhook duplicate ignored: {event_id}")
        return {"status": "duplicate"}

    handle_river_webhook(event)
    if event_id:
        webhook_event_repository.mark_processed(event_id)

    return {"status": "received"}
