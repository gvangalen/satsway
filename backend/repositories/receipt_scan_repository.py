from uuid import UUID

from backend.core.database import SessionLocal
from backend.db.tables import ReceiptScanTable
from backend.models.receipt_scan import ReceiptScanRead, ReceiptScanStatus


class ReceiptScanRepository:
    def create(
        self,
        user_id: UUID,
        filename: str,
        content_type: str,
        file_path: str,
    ) -> ReceiptScanRead:
        receipt_scan = ReceiptScanRead(
            user_id=user_id,
            filename=filename,
            content_type=content_type,
            status=ReceiptScanStatus.uploaded,
        )
        with SessionLocal() as session:
            session.merge(
                ReceiptScanTable(
                    id=str(receipt_scan.id),
                    user_id=str(receipt_scan.user_id),
                    filename=receipt_scan.filename,
                    content_type=receipt_scan.content_type,
                    file_path=file_path,
                    status=receipt_scan.status.value,
                    total_amount=receipt_scan.total_amount,
                    created_at=receipt_scan.created_at,
                ),
            )
            session.commit()

        return receipt_scan

    def get(self, receipt_scan_id: UUID) -> ReceiptScanRead | None:
        with SessionLocal() as session:
            row = session.get(ReceiptScanTable, str(receipt_scan_id))
            if row is None:
                return None

            return ReceiptScanRead(
                id=UUID(row.id),
                user_id=UUID(row.user_id),
                filename=row.filename,
                content_type=row.content_type,
                status=row.status,
                total_amount=row.total_amount,
                created_at=row.created_at,
            )


receipt_scan_repository = ReceiptScanRepository()
