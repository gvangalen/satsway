from uuid import UUID

from backend.core.database import SessionLocal, db
from backend.db.tables import PaymentRequestTable
from backend.models.payment_request import (
    PaymentRequest,
    PaymentRequestCreate,
    PaymentRequestRead,
    PaymentRequestStatus,
)
from backend.services.payment_share_service import payment_share_service


class RequestService:
    def create(self, payload: PaymentRequestCreate) -> PaymentRequestRead:
        payment_request = PaymentRequest(**payload.dict(exclude={"share_amounts_eur"}))
        stored_request = PaymentRequestRead(**payment_request.dict())
        with SessionLocal() as session:
            session.merge(
                PaymentRequestTable(
                    id=str(stored_request.id),
                    user_id=str(stored_request.user_id),
                    amount_eur=stored_request.amount_eur,
                    amount_sats=stored_request.amount_sats,
                    settlement_currency=stored_request.settlement_currency.value,
                    lightning_address=stored_request.lightning_address,
                    participant_count=stored_request.participant_count,
                    description=stored_request.description,
                    status=stored_request.status.value,
                    created_at=stored_request.created_at,
                ),
            )
            session.commit()

        payment_share_service.create_for_request(
            request_id=stored_request.id,
            total_amount_eur=stored_request.amount_eur,
            participant_count=stored_request.participant_count,
            share_amounts_eur=payload.share_amounts_eur,
        )

        created_request = self.get(stored_request.id) or stored_request
        db.payment_requests[stored_request.id] = created_request
        return created_request

    def create_for_user(self, payload: PaymentRequestCreate, user_id: UUID) -> PaymentRequestRead:
        return self.create(payload.copy(update={"user_id": user_id}))

    def get(self, request_id: UUID) -> PaymentRequestRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentRequestTable, str(request_id))
            if row is not None:
                shares = payment_share_service.list_for_request(UUID(row.id))
                paid_count = sum(1 for share in shares if share.status == PaymentRequestStatus.paid)
                return PaymentRequestRead(
                    id=UUID(row.id),
                    user_id=UUID(row.user_id),
                    amount_eur=row.amount_eur,
                    amount_sats=row.amount_sats,
                    settlement_currency=row.settlement_currency,
                    lightning_address=row.lightning_address,
                    participant_count=row.participant_count,
                    description=row.description,
                    status=row.status,
                    created_at=row.created_at,
                    paid_count=paid_count,
                    shares=shares,
                )

        return db.payment_requests.get(request_id)

    def mark_paid(self, request_id: UUID) -> PaymentRequestRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentRequestTable, str(request_id))
            if row is not None:
                row.status = PaymentRequestStatus.paid.value
                session.commit()
                return self.get(request_id)

        payment_request = db.payment_requests.get(request_id)
        if payment_request is None:
            return None

        updated_request = payment_request.copy(
            update={"status": PaymentRequestStatus.paid},
        )
        db.payment_requests[request_id] = updated_request

        return updated_request

    def mark_share_paid(self, share_id: UUID) -> PaymentRequestRead | None:
        share = payment_share_service.mark_paid(share_id)
        if share is None:
            return None

        return self.get(share.request_id)


request_service = RequestService()
