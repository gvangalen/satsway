import base64
import hashlib
import hmac
import json
from uuid import UUID

import requests

from backend.core.config import settings
from backend.models.transaction import PaymentQuoteRead
from backend.services.fx_service import fx_service
from backend.services.request_service import request_service


def create_lightning_invoice(
    quote: PaymentQuoteRead,
    request_id: UUID,
    share_id: UUID | None = None,
) -> dict[str, str]:
    if settings.river_api_key and settings.river_account_id:
        invoice = _create_river_deposit_intent(
            quote=quote,
            request_id=request_id,
            share_id=share_id,
        )
        if invoice is not None:
            return invoice

    return _create_mock_invoice(quote=quote, request_id=request_id)


def handle_webhook(event: dict) -> None:
    event_type = event.get("type")
    print(f"River webhook received: {event_type}")

    if event_type not in {"deposit.settled", "deposit_intent.settled", "deposit.completed"}:
        print(f"River webhook ignored: {event_type}")
        return

    request_id = _extract_request_id(event)
    share_id = _extract_share_id(event)
    if request_id is None:
        print("River webhook missing request_id metadata")
        return

    try:
        updated_request = (
            request_service.mark_share_paid(UUID(share_id))
            if share_id
            else request_service.mark_paid(UUID(request_id))
        )
    except ValueError:
        print(f"River webhook invalid request_id: {request_id}")
        return

    if updated_request is None:
        print(f"River webhook request not found: {request_id}")
        return

    print(f"River webhook marked request paid: {request_id}")


def verify_webhook_signature(payload: bytes, river_signature: str) -> bool:
    if not settings.river_webhook_secret:
        return False

    header = _parse_river_signature(river_signature)
    timestamp = header.get("timestamp")
    signature = header.get("signature")
    if not timestamp or not signature:
        return False

    signed_payload = f"{timestamp}.{payload.decode()}".encode()
    expected = hmac.new(
        bytes.fromhex(settings.river_webhook_secret),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def _create_river_deposit_intent(
    quote: PaymentQuoteRead,
    request_id: UUID,
    share_id: UUID | None = None,
) -> dict[str, str] | None:
    sats = fx_service.btc_to_sats(quote.payment_amount)
    url = (
        f"{settings.river_api_base_url.rstrip('/')}"
        f"/accounts/{settings.river_account_id}/deposit_intents"
    )
    payload = {
        "amount_sats": sats,
        "memo": f"Satsway request {request_id}",
        "metadata": {
            "request_id": str(request_id),
            "share_id": str(share_id) if share_id else "",
            "quote_id": str(quote.id),
        },
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": _basic_auth_header(settings.river_api_key),
                "Content-Type": "application/json",
                "Idempotency-Key": str(quote.id),
            },
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"River API deposit intent failed, using mock invoice: {error}")
        return None

    data = response.json()
    invoice = (
        data.get("lightning_invoice")
        or data.get("invoice")
        or data.get("bolt11")
        or data.get("payment_request")
    )
    payment_hash = (
        data.get("payment_hash")
        or data.get("id")
        or data.get("deposit_intent_id")
    )
    if not invoice or not payment_hash:
        print("River API response missing invoice fields, using mock invoice")
        return None

    return {
        "invoice": invoice,
        "payment_hash": payment_hash,
    }


def _create_mock_invoice(quote: PaymentQuoteRead, request_id: UUID) -> dict[str, str]:
    sats = fx_service.btc_to_sats(quote.payment_amount)
    payment_hash = f"mock_hash_{request_id}_{quote.id}"

    return {
        "invoice": f"lnbc{sats}n1psatswaymock{request_id.hex[:12]}{quote.id.hex[:8]}",
        "payment_hash": payment_hash,
    }


def _basic_auth_header(api_key: str) -> str:
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    return f"Basic {token}"


def _parse_river_signature(header: str) -> dict[str, str]:
    try:
        parsed = json.loads(header)
        return {
            "timestamp": str(parsed.get("timestamp", "")),
            "signature": str(parsed.get("signature", "")),
        }
    except json.JSONDecodeError:
        pass

    parts = {}
    for piece in header.split(","):
        if "=" not in piece:
            continue
        key, value = piece.split("=", 1)
        parts[key.strip()] = value.strip()

    return {
        "timestamp": parts.get("timestamp") or parts.get("t", ""),
        "signature": parts.get("signature") or parts.get("v1", ""),
    }


def _extract_request_id(event: dict) -> str | None:
    data = event.get("data", {})
    obj = data.get("object", data)
    metadata = obj.get("metadata", {})

    return (
        metadata.get("request_id")
        or obj.get("request_id")
        or event.get("request_id")
    )


def _extract_share_id(event: dict) -> str | None:
    data = event.get("data", {})
    obj = data.get("object", data)
    metadata = obj.get("metadata", {})

    return metadata.get("share_id") or obj.get("share_id") or event.get("share_id")
