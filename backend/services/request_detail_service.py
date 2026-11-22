from uuid import UUID

from backend.models.payment_request import PaymentRequestWithPoster
from backend.services.poster_service import poster_service
from backend.services.request_service import request_service


class RequestDetailService:
    def get_with_poster(self, request_id: UUID) -> PaymentRequestWithPoster | None:
        payment_request = request_service.get(request_id)
        if payment_request is None:
            return None

        return PaymentRequestWithPoster(
            **payment_request.dict(),
            poster=poster_service.get_random_active(),
        )


request_detail_service = RequestDetailService()
