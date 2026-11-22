from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from backend.models.rate import BtcQuoteRead
from backend.services.payment_share_service import payment_share_service
from backend.services.quote_service import quote_service
from backend.services.request_service import request_service

router = APIRouter(prefix="/api/quotes", tags=["rates"])


@router.get("/btc", response_model=BtcQuoteRead)
def get_btc_quote(
    amount_eur: Decimal = Query(gt=0, decimal_places=2),
) -> BtcQuoteRead:
    return quote_service.create_btc_quote(amount_eur=amount_eur)


@router.get("/requests/{request_id}/shares/{share_id}/btc", response_model=BtcQuoteRead)
def get_share_btc_quote(request_id: UUID, share_id: UUID) -> BtcQuoteRead:
    payment_request = request_service.get(request_id)
    share = payment_share_service.get(share_id)
    if payment_request is None or share is None or share.request_id != request_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment share not found",
        )

    return quote_service.create_btc_quote(
        amount_eur=share.amount_eur,
        request_id=payment_request.id,
        share_id=share.id,
    )
