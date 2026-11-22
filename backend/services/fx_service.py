from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

import requests

from backend.core.config import settings
from backend.core.time import utc_now
from backend.models.rate import RatesRead
from backend.models.transaction import Currency

BTC_EUR_RATE = Decimal("95000")
USD_EUR_RATE = Decimal("0.92")
SATOSHIS_PER_BTC = Decimal("100000000")


class FxService:
    _cached_rates: RatesRead | None = None

    def get_rates(self) -> RatesRead:
        if self._cached_rates is not None:
            age_seconds = (utc_now() - self._cached_rates.updated_at).total_seconds()
            if age_seconds < 60:
                return self._cached_rates

        try:
            response = requests.get(
                f"{settings.coingecko_api_base_url.rstrip('/')}/simple/price",
                params={
                    "ids": "bitcoin",
                    "vs_currencies": "eur,usd",
                    "include_last_updated_at": "true",
                },
                headers=self._coingecko_headers(),
                timeout=8,
            )
            response.raise_for_status()
            data = response.json()["bitcoin"]
            btc_eur = Decimal(str(data["eur"]))
            btc_usd = Decimal(str(data["usd"]))
            updated_at = datetime.fromtimestamp(
                int(data.get("last_updated_at", utc_now().timestamp())),
                tz=timezone.utc,
            )
            self._cached_rates = RatesRead(
                btc_eur=btc_eur,
                usd_eur=(btc_eur / btc_usd).quantize(Decimal("0.0001")),
                source="CoinGecko",
                updated_at=updated_at,
            )
            return self._cached_rates
        except (requests.RequestException, KeyError, ValueError, TypeError) as error:
            print(f"CoinGecko rate fetch failed, using fallback rates: {error}")
            self._cached_rates = RatesRead(
                btc_eur=BTC_EUR_RATE,
                usd_eur=USD_EUR_RATE,
                source="Fallback",
                updated_at=utc_now(),
            )
            return self._cached_rates

    def convert(
        self,
        amount: Decimal,
        from_currency: Currency,
        to_currency: Currency,
    ) -> Decimal:
        if from_currency == to_currency:
            return self.quantize(amount, to_currency)

        amount_in_eur = self.to_eur(amount, from_currency)
        if to_currency == Currency.eur:
            return self.quantize(amount_in_eur, to_currency)

        if to_currency == Currency.usd:
            return self.quantize(amount_in_eur / self.get_rates().usd_eur, to_currency)

        if to_currency == Currency.btc:
            return self.quantize(amount_in_eur / self.get_rates().btc_eur, to_currency)

        return self.quantize(amount, to_currency)

    def exchange_rate(self, from_currency: Currency, to_currency: Currency) -> Decimal:
        if from_currency == to_currency:
            return Decimal("1")

        return self.convert(Decimal("1"), from_currency, to_currency)

    def to_eur(self, amount: Decimal, currency: Currency) -> Decimal:
        if currency == Currency.eur:
            return amount

        if currency == Currency.usd:
            return amount * self.get_rates().usd_eur

        if currency == Currency.btc:
            return amount * self.get_rates().btc_eur

        return amount

    def quantize(self, amount: Decimal, currency: Currency) -> Decimal:
        if currency == Currency.btc:
            return amount.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def btc_to_sats(self, amount_btc: Decimal) -> int:
        return int((amount_btc * SATOSHIS_PER_BTC).to_integral_value())

    def _coingecko_headers(self) -> dict[str, str]:
        if not settings.coingecko_api_key:
            return {}

        return {"x-cg-demo-api-key": settings.coingecko_api_key}


fx_service = FxService()
