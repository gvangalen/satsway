from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

import stripe

from backend.core.config import settings
from backend.services.request_service import request_service

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(
    amount_eur: Decimal,
    request_id: UUID,
    share_id: UUID | None = None,
) -> str:
    if settings.stripe_secret_key == "sk_test_placeholder":
        return f"https://checkout.stripe.com/c/pay/cs_test_placeholder_{request_id}"

    share_query = f"&share={share_id}" if share_id else ""
    success_url = f"{settings.frontend_success_url.rstrip('/')}/pay/{request_id}?success=true{share_query}"
    cancel_url = f"{settings.frontend_cancel_url.rstrip('/')}/pay/{request_id}?canceled=true{share_query}"

    amount_cents = int(
        (amount_eur * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP),
    )

    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": "Satsway payment request",
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            },
        ],
        metadata={
            "request_id": str(request_id),
            "payment_request_id": str(request_id),
            "share_id": str(share_id) if share_id else "",
        },
        success_url=success_url,
        cancel_url=cancel_url,
    )

    return session.url


def handle_webhook(event: dict) -> None:
    if hasattr(event, "to_dict_recursive"):
        event = event.to_dict_recursive()

    event_type = event.get("type")
    print(f"Stripe webhook received: {event_type}")

    if event_type != "checkout.session.completed":
        print(f"Stripe webhook ignored: {event_type}")
        return

    session = event.get("data", {}).get("object", {})
    session_id = session.get("id")
    metadata = session.get("metadata", {})
    request_id = metadata.get("request_id") or metadata.get("payment_request_id")
    share_id = metadata.get("share_id")
    print(
        "Stripe checkout session completed: "
        f"session_id={session_id}, request_id={request_id}, share_id={share_id}"
    )
    if request_id is None:
        print(f"Stripe webhook missing request metadata: session_id={session_id}")
        return

    try:
        updated_request = (
            request_service.mark_share_paid(UUID(share_id))
            if share_id
            else request_service.mark_paid(UUID(request_id))
        )
    except ValueError:
        print(
            "Stripe webhook invalid metadata: "
            f"request_id={request_id}, share_id={share_id}, session_id={session_id}"
        )
        return

    if updated_request is None:
        print(f"Stripe webhook request not found: request_id={request_id}, session_id={session_id}")
        return

    print(f"Stripe webhook marked request paid: request_id={request_id}, session_id={session_id}, status=paid")
