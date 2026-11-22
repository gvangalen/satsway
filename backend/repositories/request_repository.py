from uuid import UUID

from backend.core.database import SessionLocal
from backend.db.tables import PaymentRequestTable
from backend.models.payment_request import PaymentRequestStatus
from backend.models.payment_request import PaymentRequestRead
from backend.services.payment_share_service import payment_share_service


class RequestRepository:
    def list_for_user(self, user_id: UUID, limit: int = 50) -> list[PaymentRequestRead]:
        with SessionLocal() as session:
            rows = (
                session.query(PaymentRequestTable)
                .filter(PaymentRequestTable.user_id == str(user_id))
                .order_by(PaymentRequestTable.created_at.desc())
                .limit(limit)
                .all()
            )

        return [
            PaymentRequestRead(
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
                paid_count=sum(
                    1
                    for share in payment_share_service.list_for_request(UUID(row.id))
                    if share.status == PaymentRequestStatus.paid
                ),
                shares=payment_share_service.list_for_request(UUID(row.id)),
            )
            for row in rows
        ]


request_repository = RequestRepository()
