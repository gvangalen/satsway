from sqlalchemy.exc import IntegrityError

from backend.core.database import SessionLocal
from backend.db.tables import WebhookEventTable


class WebhookEventRepository:
    def reserve(self, event_id: str, provider: str, event_type: str) -> bool:
        with SessionLocal() as session:
            session.add(
                WebhookEventTable(
                    id=event_id,
                    provider=provider,
                    event_type=event_type,
                    processed=False,
                ),
            )
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                return False

        return True

    def mark_processed(self, event_id: str) -> None:
        with SessionLocal() as session:
            row = session.get(WebhookEventTable, event_id)
            if row is None:
                return

            row.processed = True
            session.commit()


webhook_event_repository = WebhookEventRepository()
