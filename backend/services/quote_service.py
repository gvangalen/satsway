from datetime import timezone, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from backend.core.database import SessionLocal, db
from backend.core.time import utc_now
from backend.db.tables import PaymentQuoteTable
from backend.models.payment_request import PaymentRequestRead
from backend.models.rate import BtcQuoteRead
from backend.models.transaction import Currency, PaymentQuote, PaymentQuoteRead, QuoteProvider
from backend.services.fx_service import fx_service


class QuoteService:
    def create_quote(
        self,
        payment_request: PaymentRequestRead,
        payment_currency: Currency,
    ) -> PaymentQuoteRead:
        settlement_currency = payment_request.settlement_currency
        amount_eur = (payment_request.amount_eur / payment_request.participant_count).quantize(
            Decimal("0.01"),
        )
        settlement_amount = fx_service.convert(
            amount=amount_eur,
            from_currency=Currency.eur,
            to_currency=settlement_currency,
        )
        payment_amount = fx_service.convert(
            amount=settlement_amount,
            from_currency=settlement_currency,
            to_currency=payment_currency,
        )
        exchange_rate = fx_service.exchange_rate(
            from_currency=settlement_currency,
            to_currency=payment_currency,
        )
        quote = PaymentQuote(
            request_id=payment_request.id,
            payment_currency=payment_currency,
            settlement_currency=settlement_currency,
            payment_amount=payment_amount,
            settlement_amount=settlement_amount,
            exchange_rate=exchange_rate,
            provider=self._provider_for(payment_currency),
            expires_at=utc_now() + timedelta(minutes=10),
        )
        stored_quote = self._store_quote(quote)
        print(
            "quote_created",
            {
                "quote_id": str(stored_quote.id),
                "request_id": str(stored_quote.request_id),
                "payment_currency": stored_quote.payment_currency.value,
                "payment_amount": str(stored_quote.payment_amount),
                "expires_at": stored_quote.expires_at.isoformat(),
            },
        )

        return stored_quote

    def create_btc_quote(
        self,
        amount_eur: Decimal,
        request_id: UUID | None = None,
        share_id: UUID | None = None,
    ) -> BtcQuoteRead:
        amount_eur = amount_eur.quantize(Decimal("0.01"))
        rates = fx_service.get_rates()
        btc_amount = fx_service.convert(
            amount=amount_eur,
            from_currency=Currency.eur,
            to_currency=Currency.btc,
        )
        quote = PaymentQuote(
            request_id=request_id or uuid4(),
            payment_currency=Currency.btc,
            settlement_currency=Currency.eur,
            payment_amount=btc_amount,
            settlement_amount=amount_eur,
            exchange_rate=fx_service.exchange_rate(Currency.eur, Currency.btc),
            provider=QuoteProvider.river,
            expires_at=utc_now() + timedelta(minutes=10),
        )
        stored_quote = self._store_quote(quote) if request_id is not None else PaymentQuoteRead(**quote.dict())
        sats = fx_service.btc_to_sats(btc_amount)
        if sats <= 0:
            raise ValueError("INVALID_SATS")
        print(
            "quote_created",
            {
                "quote_id": str(stored_quote.id),
                "request_id": str(request_id) if request_id else None,
                "share_id": str(share_id) if share_id else None,
                "amount_eur": str(amount_eur),
                "sats": sats,
                "expires_at": stored_quote.expires_at.isoformat(),
            },
        )

        return BtcQuoteRead(
            quote_id=stored_quote.id,
            amount_eur=amount_eur,
            btc_amount=btc_amount,
            sats=sats,
            rate=rates.btc_eur,
            source=rates.source,
            updated_at=rates.updated_at,
            expires_at=stored_quote.expires_at,
            request_id=request_id,
            share_id=share_id,
        )

    def get(self, quote_id: UUID) -> PaymentQuoteRead | None:
        with SessionLocal() as session:
            row = session.get(PaymentQuoteTable, str(quote_id))
            if row is not None:
                return PaymentQuoteRead(
                    id=UUID(row.id),
                    request_id=UUID(row.request_id),
                    payment_currency=row.payment_currency,
                    settlement_currency=row.settlement_currency,
                    payment_amount=row.payment_amount,
                    settlement_amount=row.settlement_amount,
                    exchange_rate=row.exchange_rate,
                    provider=row.provider,
                    expires_at=row.expires_at,
                    created_at=row.created_at,
                )

        return db.payment_quotes.get(quote_id)

    def validate_active(self, quote: PaymentQuoteRead) -> None:
        expires_at = quote.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < utc_now():
            print(
                "quote_expired",
                {
                    "quote_id": str(quote.id),
                    "expires_at": expires_at.isoformat(),
                },
            )
            raise ValueError("QUOTE_EXPIRED")

    def _store_quote(self, quote: PaymentQuote) -> PaymentQuoteRead:
        stored_quote = PaymentQuoteRead(**quote.dict())
        with SessionLocal() as session:
            session.merge(
                PaymentQuoteTable(
                    id=str(stored_quote.id),
                    request_id=str(stored_quote.request_id),
                    payment_currency=stored_quote.payment_currency.value,
                    settlement_currency=stored_quote.settlement_currency.value,
                    payment_amount=stored_quote.payment_amount,
                    settlement_amount=stored_quote.settlement_amount,
                    exchange_rate=stored_quote.exchange_rate,
                    provider=stored_quote.provider.value,
                    expires_at=stored_quote.expires_at,
                    created_at=stored_quote.created_at,
                ),
            )
            session.commit()

        db.payment_quotes[stored_quote.id] = stored_quote
        return stored_quote

    def _provider_for(self, payment_currency: Currency) -> QuoteProvider:
        if payment_currency == Currency.btc:
            return QuoteProvider.river

        return QuoteProvider.stripe


quote_service = QuoteService()
