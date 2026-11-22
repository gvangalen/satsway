from decimal import Decimal

from backend.core.database import db
from backend.core.database import SessionLocal
from backend.core.time import utc_now
from backend.db.tables import TransactionTable
from backend.models.payment_request import PaymentRequestStatus, PaymentSessionRead
from backend.models.transaction import Currency, PaymentMethod, Transaction
from backend.services.payment_share_service import payment_share_service
from backend.services.quote_service import quote_service
from backend.services.request_service import request_service
from backend.services.fx_service import fx_service
from backend.services.river_service import create_lightning_invoice
from backend.services.stripe_service import create_checkout_session


class PaymentOrchestrator:
    def create_payment_session(
        self,
        request_id,
        payment_currency: Currency,
        share_id=None,
        quote_id=None,
    ) -> PaymentSessionRead | None:
        payment_request = request_service.get(request_id)
        if payment_request is None:
            return None
        if payment_request.settlement_currency == Currency.btc:
            raise ValueError("GRID_NOT_CONFIGURED")

        share = (
            payment_share_service.get(share_id)
            if share_id is not None
            else payment_share_service.first_pending_for_request(payment_request.id)
        )
        if (
            share is None
            or share.request_id != payment_request.id
            or share.status != PaymentRequestStatus.pending
        ):
            return None

        payment_request_for_quote = payment_request.copy(
            update={
                "amount_eur": share.amount_eur,
                "participant_count": 1,
            },
        )

        if payment_currency == Currency.btc:
            active_invoice = payment_share_service.get_active_invoice(share.id)
            if active_invoice is not None and active_invoice.status == PaymentRequestStatus.pending:
                print(
                    "invoice_reused",
                    {
                        "request_id": str(payment_request.id),
                        "share_id": str(share.id),
                        "invoice_id": active_invoice.invoice_id,
                    },
                )
                return self._btc_session_from_share(
                    payment_request=payment_request,
                    share=active_invoice,
                )

            share = payment_share_service.get(share.id)
            if share is None or share.status != PaymentRequestStatus.pending:
                return None

            quote = self._btc_quote_for_invoice(
                payment_request=payment_request_for_quote,
                share=share,
                quote_id=quote_id,
            )
            sats = share.locked_sats or fx_service.btc_to_sats(quote.payment_amount)
            if sats <= 0 or not isinstance(sats, int):
                raise ValueError("INVALID_SATS")

            locked_share = payment_share_service.lock_btc_price(
                share_id=share.id,
                locked_sats=sats,
                locked_rate=quote.exchange_rate,
            )
            if locked_share is None:
                return None

            locked_sats = locked_share.locked_sats or sats
            locked_payment_amount = (Decimal(locked_sats) / Decimal("100000000")).quantize(
                Decimal("0.00000001"),
            )
            quote = quote.copy(update={"payment_amount": locked_payment_amount})
            invoice = create_lightning_invoice(
                quote=quote,
                request_id=payment_request.id,
                share_id=share.id,
            )
            locked_share = payment_share_service.attach_invoice(
                share_id=share.id,
                invoice_id=invoice["payment_hash"],
                invoice_expires_at=quote.expires_at,
                lightning_invoice=invoice["invoice"],
            )
            if locked_share is None:
                return None

            transaction = Transaction(
                request_id=payment_request.id,
                quote_id=quote.id,
                payment_method=PaymentMethod.bitcoin,
                amount=quote.payment_amount,
                currency=Currency.btc,
                settlement_amount=quote.settlement_amount,
                settlement_currency=quote.settlement_currency,
                external_id=invoice["payment_hash"],
            )
            self._store_transaction(transaction)
            db.transactions[transaction.id] = transaction

            return PaymentSessionRead(
                request_id=payment_request.id,
                share_id=share.id,
                status=payment_request.status,
                provider="river",
                payment_currency=payment_currency,
                settlement_currency=quote.settlement_currency,
                settlement_amount=quote.settlement_amount,
                payment_amount=quote.payment_amount,
                payment_amount_sats=locked_sats,
                locked_sats=locked_sats,
                locked_rate=locked_share.locked_rate,
                locked_at=locked_share.locked_at,
                invoice_id=locked_share.invoice_id,
                invoice_expires_at=locked_share.invoice_expires_at,
                exchange_rate=quote.exchange_rate,
                lightning_invoice=locked_share.lightning_invoice,
                lightning_payment_hash=locked_share.invoice_id,
                expires_at=locked_share.invoice_expires_at or quote.expires_at,
            )

        quote = quote_service.create_quote(
            payment_request=payment_request_for_quote,
            payment_currency=payment_currency,
        )

        checkout_url = create_checkout_session(
            amount_eur=quote.payment_amount,
            request_id=payment_request.id,
            share_id=share.id,
        )
        transaction = Transaction(
            request_id=payment_request.id,
            quote_id=quote.id,
            payment_method=PaymentMethod.stripe,
            amount=quote.payment_amount,
            currency=payment_currency,
            settlement_amount=quote.settlement_amount,
            settlement_currency=quote.settlement_currency,
            external_id=checkout_url,
        )
        self._store_transaction(transaction)
        db.transactions[transaction.id] = transaction

        return PaymentSessionRead(
            request_id=payment_request.id,
            share_id=share.id,
            status=payment_request.status,
            provider="stripe",
            payment_currency=payment_currency,
            settlement_currency=quote.settlement_currency,
            settlement_amount=quote.settlement_amount,
            payment_amount=quote.payment_amount,
            exchange_rate=quote.exchange_rate,
            checkout_url=checkout_url,
            expires_at=quote.expires_at,
        )

    def _btc_session_from_share(self, payment_request, share) -> PaymentSessionRead:
        locked_sats = share.locked_sats
        if locked_sats is None or locked_sats <= 0:
            raise ValueError("INVALID_SATS")

        payment_amount = (Decimal(locked_sats) / Decimal("100000000")).quantize(
            Decimal("0.00000001"),
        )
        settlement_amount = fx_service.convert(
            amount=share.amount_eur,
            from_currency=Currency.eur,
            to_currency=payment_request.settlement_currency,
        )
        exchange_rate = share.locked_rate or fx_service.exchange_rate(
            payment_request.settlement_currency,
            Currency.btc,
        )

        return PaymentSessionRead(
            request_id=payment_request.id,
            share_id=share.id,
            status=payment_request.status,
            provider="river",
            payment_currency=Currency.btc,
            settlement_currency=payment_request.settlement_currency,
            settlement_amount=settlement_amount,
            payment_amount=payment_amount,
            payment_amount_sats=locked_sats,
            locked_sats=locked_sats,
            locked_rate=share.locked_rate,
            locked_at=share.locked_at,
            invoice_id=share.invoice_id,
            invoice_expires_at=share.invoice_expires_at,
            exchange_rate=exchange_rate,
            lightning_invoice=share.lightning_invoice,
            lightning_payment_hash=share.invoice_id,
            expires_at=share.invoice_expires_at or utc_now(),
        )

    def _btc_quote_for_invoice(self, payment_request, share, quote_id):
        if share.locked_sats is not None:
            payment_amount = (Decimal(share.locked_sats) / Decimal("100000000")).quantize(
                Decimal("0.00000001"),
            )
            settlement_amount = fx_service.convert(
                amount=share.amount_eur,
                from_currency=Currency.eur,
                to_currency=payment_request.settlement_currency,
            )
            return quote_service.create_quote(
                payment_request=payment_request.copy(
                    update={
                        "amount_eur": share.amount_eur,
                        "participant_count": 1,
                    },
                ),
                payment_currency=Currency.btc,
            ).copy(
                update={
                    "payment_amount": payment_amount,
                    "settlement_amount": settlement_amount,
                    "exchange_rate": share.locked_rate or Decimal("1"),
                },
            )

        if quote_id is not None:
            quote = quote_service.get(quote_id)
            if quote is None:
                raise ValueError("QUOTE_NOT_FOUND")

            quote_service.validate_active(quote)
            if (
                quote.request_id != payment_request.id
                or quote.payment_currency != Currency.btc
                or quote.settlement_amount != share.amount_eur.quantize(Decimal("0.01"))
            ):
                raise ValueError("LOCK_MISMATCH")

            return quote

        return quote_service.create_quote(
            payment_request=payment_request,
            payment_currency=Currency.btc,
        )

    def _store_transaction(self, transaction: Transaction) -> None:
        with SessionLocal() as session:
            session.merge(
                TransactionTable(
                    id=str(transaction.id),
                    request_id=str(transaction.request_id),
                    quote_id=str(transaction.quote_id) if transaction.quote_id else None,
                    payment_method=transaction.payment_method.value,
                    amount=transaction.amount,
                    currency=transaction.currency.value,
                    settlement_amount=transaction.settlement_amount,
                    settlement_currency=transaction.settlement_currency.value
                    if transaction.settlement_currency
                    else None,
                    external_id=transaction.external_id,
                    status=transaction.status.value,
                    created_at=transaction.created_at,
                ),
            )
            session.commit()


payment_orchestrator = PaymentOrchestrator()
