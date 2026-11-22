from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.core.auth import get_current_user
from backend.models.payment_request import (
    PaymentRequestCheckout,
    PaymentRequestCreate,
    PaymentRequestRead,
    PaymentSessionCreate,
    PaymentSessionRead,
)
from backend.models.transaction import Currency
from backend.models.user import UserRead
from backend.services.payment_orchestrator import payment_orchestrator
from backend.repositories.request_repository import request_repository
from backend.services.request_service import request_service

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("", response_model=list[PaymentRequestRead])
def list_requests(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: UserRead = Depends(get_current_user),
) -> list[PaymentRequestRead]:
    return request_repository.list_for_user(user_id=current_user.id, limit=limit)


@router.post(
    "",
    response_model=PaymentRequestCheckout,
    status_code=status.HTTP_201_CREATED,
)
def create_request(payload: PaymentRequestCreate) -> PaymentRequestCheckout:
    payment_request = request_service.create(payload)
    payment_session = (
        payment_orchestrator.create_payment_session(
            request_id=payment_request.id,
            payment_currency=Currency.eur,
        )
        if payment_request.settlement_currency == Currency.eur
        else None
    )
    checkout_url = payment_session.checkout_url if payment_session else ""

    return PaymentRequestCheckout(
        request_id=payment_request.id,
        status=payment_request.status,
        checkout_url=checkout_url,
    )


@router.get("/{request_id}", response_model=PaymentRequestRead)
def get_request(request_id: UUID) -> PaymentRequestRead:
    payment_request = request_service.get(request_id)
    if payment_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment request not found",
        )

    return payment_request


@router.post("/{request_id}/payment-session", response_model=PaymentSessionRead)
def create_payment_session(
    request_id: UUID,
    payload: PaymentSessionCreate,
) -> PaymentSessionRead:
    try:
        payment_session = payment_orchestrator.create_payment_session(
            request_id=request_id,
            payment_currency=payload.payment_currency,
            share_id=payload.share_id,
            quote_id=payload.quote_id,
        )
    except ValueError as error:
        code = str(error)
        status_code = status.HTTP_409_CONFLICT if code == "QUOTE_EXPIRED" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=code) from error

    if payment_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment request not found",
        )

    return payment_session
