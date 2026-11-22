from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from backend.core.enums import StringEnum
from backend.core.time import utc_now


class PaymentMethod(StringEnum):
    stripe = "stripe"
    bitcoin = "bitcoin"


class Currency(StringEnum):
    eur = "EUR"
    usd = "USD"
    btc = "BTC"


class TransactionStatus(StringEnum):
    pending = "pending"
    paid = "paid"
    failed = "failed"


class QuoteProvider(StringEnum):
    stripe = "stripe"
    river = "river"


class PaymentQuote(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    request_id: UUID
    payment_currency: Currency
    settlement_currency: Currency
    payment_amount: Decimal = Field(gt=0)
    settlement_amount: Decimal = Field(gt=0)
    exchange_rate: Decimal = Field(gt=0)
    provider: QuoteProvider
    expires_at: datetime
    created_at: datetime = Field(default_factory=utc_now)


class PaymentQuoteRead(PaymentQuote):
    pass


class Transaction(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    request_id: UUID
    quote_id: UUID | None = None
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0)
    currency: Currency
    settlement_amount: Decimal | None = None
    settlement_currency: Currency | None = None
    external_id: str
    status: TransactionStatus = TransactionStatus.pending
    created_at: datetime = Field(default_factory=utc_now)
