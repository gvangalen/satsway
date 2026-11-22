from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.core.auth import get_current_user
from backend.models.payment_request import PaymentRequestCreate, PaymentRequestRead, PaymentRequestWithPoster
from backend.repositories.request_repository import request_repository
from backend.models.user import UserRead
from backend.services.request_detail_service import request_detail_service
from backend.services.request_service import request_service

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("", response_model=list[PaymentRequestRead])
def list_api_requests(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: UserRead = Depends(get_current_user),
) -> list[PaymentRequestRead]:
    return request_repository.list_for_user(user_id=current_user.id, limit=limit)


@router.post("", response_model=PaymentRequestRead, status_code=status.HTTP_201_CREATED)
def create_api_request(
    payload: PaymentRequestCreate,
    current_user: UserRead = Depends(get_current_user),
) -> PaymentRequestRead:
    return request_service.create_for_user(payload=payload, user_id=current_user.id)


@router.get("/{request_id}", response_model=PaymentRequestWithPoster)
def get_request_with_poster(request_id: UUID) -> PaymentRequestWithPoster:
    payment_request = request_detail_service.get_with_poster(request_id)
    if payment_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment request not found",
        )

    return payment_request
