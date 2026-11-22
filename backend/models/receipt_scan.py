from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from backend.core.enums import StringEnum
from backend.core.time import utc_now


class ReceiptScanStatus(StringEnum):
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ReceiptScanRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    filename: str
    content_type: str
    status: ReceiptScanStatus = ReceiptScanStatus.uploaded
    total_amount: float | None = None
    created_at: datetime = Field(default_factory=utc_now)
