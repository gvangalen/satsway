from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class RatesRead(BaseModel):
    base: str = "EUR"
    btc_eur: Decimal
    usd_eur: Decimal
    source: str
    updated_at: datetime


class BtcQuoteRead(BaseModel):
    quote_id: UUID
    amount_eur: Decimal
    btc_amount: Decimal
    sats: int
    rate: Decimal
    source: str
    updated_at: datetime
    expires_at: datetime
    request_id: UUID | None = None
    share_id: UUID | None = None
