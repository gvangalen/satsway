from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from backend.core.database import SessionLocal
from backend.core.time import utc_now
from backend.db.tables import PaymentRequestTable, PaymentShareTable
from backend.models.payment_request import PaymentRequestStatus, PaymentShareRead


class PaymentShareService:
    def create_for_request(
        self,
        request_id: UUID,
        total_amount_eur: Decimal,
        participant_count: int,
        share_amounts_eur: list[Decimal] | None = None,
    ) -> list[PaymentShareRead]:
        share_amounts = share_amounts_eur or [
            (total_amount_eur / participant_count).quantize(Decimal("0.01"))
            for _ in range(participant_count)
        ]
        shares = [
            PaymentShareRead(
                id=uuid4(),
                request_id=request_id,
                position=position + 1,
                amount_eur=share_amount.quantize(Decimal("0.01")),
                status=PaymentRequestStatus.pending,
                created_at=utc_now(),
            )
            for position, share_amount in enumerate(share_amounts)
        ]

        with SessionLocal() as session:
            for share in shares:
                session.add(
                    PaymentShareTable(
                        id=str(share.id),
                        request_id=str(share.request_id),
                        position=share.position,
                        amount_eur=share.amount_eur,
                        status=share.status.value,
                        paid_at=share.paid_at,
                        created_at=share.created_at,
                    ),
                )
            session.commit()

        return shares

    def list_for_request(self, request_id: UUID) -> list[PaymentShareRead]:
        with SessionLocal() as session:
            rows = (
                session.query(PaymentShareTable)
                .filter(PaymentShareTable.request_id == str(request_id))
                .order_by(PaymentShareTable.position.asc())
                .all()
            )

        return [self._to_read(row) for row in rows]

    def get(self, share_id: UUID) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            return self._to_read(row)

    def first_pending_for_request(self, request_id: UUID) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = (
                session.query(PaymentShareTable)
                .filter(
                    PaymentShareTable.request_id == str(request_id),
                    PaymentShareTable.status == PaymentRequestStatus.pending.value,
                )
                .order_by(PaymentShareTable.position.asc())
                .first()
            )
            if row is None:
                return None

            return self._to_read(row)

    def mark_paid(self, share_id: UUID) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            if row.status == PaymentRequestStatus.paid.value:
                print(
                    "polling_state_change",
                    {
                        "share_id": str(share_id),
                        "state": "paid",
                        "ignored": "already_paid",
                    },
                )
                return self._to_read(row)

            row.status = PaymentRequestStatus.paid.value
            row.paid_at = utc_now()
            session.commit()
            session.refresh(row)
            share = self._to_read(row)

            pending_count = (
                session.query(PaymentShareTable)
                .filter(
                    PaymentShareTable.request_id == row.request_id,
                    PaymentShareTable.status != PaymentRequestStatus.paid.value,
                )
                .count()
            )
            request = session.get(PaymentRequestTable, row.request_id)
            if request is not None:
                request.status = (
                    PaymentRequestStatus.paid.value
                    if pending_count == 0
                    else PaymentRequestStatus.pending.value
                )
                session.commit()

            return share

    def get_active_invoice(self, share_id: UUID) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            if row.status == PaymentRequestStatus.paid.value:
                return self._to_read(row)

            if row.invoice_id is None or row.invoice_expires_at is None:
                return None

            if self._is_expired(row.invoice_expires_at):
                print(
                    "invoice_expired",
                    {
                        "share_id": str(share_id),
                        "invoice_id": row.invoice_id,
                        "invoice_expires_at": row.invoice_expires_at.isoformat(),
                    },
                )
                self._clear_invoice_lock(row)
                session.commit()
                print("invoice_reset", {"share_id": str(share_id)})
                return None

            return self._to_read(row)

    def lock_btc_price(
        self,
        share_id: UUID,
        locked_sats: int,
        locked_rate: Decimal,
    ) -> PaymentShareRead | None:
        if locked_sats <= 0 or not isinstance(locked_sats, int):
            raise ValueError("INVALID_SATS")

        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            if row.locked_sats is None:
                row.locked_sats = locked_sats
                row.locked_rate = locked_rate
                row.locked_at = utc_now()
                session.commit()
                print(
                    "invoice_locked",
                    {
                        "share_id": str(share_id),
                        "locked_sats": locked_sats,
                        "locked_rate": str(locked_rate),
                    },
                )
            elif row.locked_sats != locked_sats:
                print(
                    "lock_mismatch",
                    {
                        "share_id": str(share_id),
                        "existing_sats": row.locked_sats,
                        "new_sats": locked_sats,
                    },
                )

            session.refresh(row)
            return self._to_read(row)

    def attach_invoice(
        self,
        share_id: UUID,
        invoice_id: str,
        invoice_expires_at: datetime,
        lightning_invoice: str,
    ) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            if row.status == PaymentRequestStatus.paid.value:
                return self._to_read(row)

            row.invoice_id = invoice_id
            row.invoice_expires_at = invoice_expires_at
            row.lightning_invoice = lightning_invoice
            session.commit()
            session.refresh(row)
            return self._to_read(row)

    def reset_invoice_lock(self, share_id: UUID) -> PaymentShareRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentShareTable, str(share_id))
            if row is None:
                return None

            if row.status == PaymentRequestStatus.paid.value:
                return self._to_read(row)

            self._clear_invoice_lock(row)
            session.commit()
            session.refresh(row)
            print("invoice_reset", {"share_id": str(share_id)})
            return self._to_read(row)

    def _to_read(self, row: PaymentShareTable) -> PaymentShareRead:
        return PaymentShareRead(
            id=UUID(row.id),
            request_id=UUID(row.request_id),
            position=row.position,
            amount_eur=row.amount_eur,
            status=row.status,
            paid_at=row.paid_at,
            locked_sats=row.locked_sats,
            locked_rate=row.locked_rate,
            locked_at=row.locked_at,
            invoice_id=row.invoice_id,
            invoice_expires_at=row.invoice_expires_at,
            lightning_invoice=row.lightning_invoice,
            created_at=row.created_at,
        )

    def _clear_invoice_lock(self, row: PaymentShareTable) -> None:
        row.locked_sats = None
        row.locked_rate = None
        row.locked_at = None
        row.invoice_id = None
        row.invoice_expires_at = None
        row.lightning_invoice = None

    def _is_expired(self, value: datetime) -> bool:
        expires_at = value
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        return expires_at <= utc_now()


payment_share_service = PaymentShareService()
