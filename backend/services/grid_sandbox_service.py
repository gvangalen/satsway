"""Grid sandbox quote operations. This module never executes a payment."""

import hashlib
from decimal import Decimal

import requests

from backend.core.config import settings


GRID_URL = "https://api.lightspark.com/grid/2025-10-13"


class GridSandboxError(Exception):
    pass


def _call(method: str, path: str, **kwargs) -> dict:
    if not settings.grid_api_token_id or not settings.grid_api_client_secret:
        raise GridSandboxError("Grid sandbox credentials are missing")
    try:
        response = requests.request(
            method,
            f"{GRID_URL}{path}",
            auth=(settings.grid_api_token_id, settings.grid_api_client_secret),
            timeout=20,
            **kwargs,
        )
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise GridSandboxError("Grid sandbox is unavailable") from error
    if not response.ok:
        code = payload.get("code", "UNKNOWN") if isinstance(payload, dict) else "UNKNOWN"
        reason = payload.get("reason", "") if isinstance(payload, dict) else ""
        raise GridSandboxError(f"Grid {response.status_code}: {code}: {reason}")
    return payload


def create_usd_lightning_quote(amount_usd: Decimal, lightning_address: str) -> dict:
    """Get a live quote; do not fund, execute, or mark a payment as complete."""
    accounts = _call("GET", "/platform/internal-accounts").get("data", [])
    source = next(
        (
            account for account in accounts
            if account.get("status") == "ACTIVE"
            and (account.get("balance", {}).get("currency") or {}).get("code") == "USD"
        ),
        None,
    )
    if source is None:
        raise GridSandboxError("No active Grid sandbox USD account")

    external_id = "satsway-sandbox-" + hashlib.sha256(lightning_address.encode()).hexdigest()[:24]
    saved = _call("GET", "/platform/external-accounts").get("data", [])
    destination = next(
        (account for account in saved if account.get("platformAccountId") == external_id),
        None,
    )
    if destination is None:
        destination = _call(
            "POST",
            "/platform/external-accounts",
            json={
                "currency": "BTC",
                "platformAccountId": external_id,
                "ownershipType": "THIRD_PARTY",
                "accountInfo": {
                    "accountType": "LIGHTNING",
                    "lightningAddress": lightning_address,
                },
            },
        )

    return _call(
        "POST",
        "/quotes",
        json={
            "source": {"sourceType": "ACCOUNT", "accountId": source["id"]},
            "destination": {"destinationType": "ACCOUNT", "accountId": destination["id"]},
            "lockedCurrencySide": "SENDING",
            "lockedCurrencyAmount": int(amount_usd * 100),
            "immediatelyExecute": False,
            "description": "Satsway USD to sats sandbox quote",
        },
    )


def get_quote(quote_id: str) -> dict:
    return _call("GET", f"/quotes/{quote_id}")


def get_transaction(transaction_id: str) -> dict:
    return _call("GET", f"/transactions/{transaction_id}")


def simulate_usd_funding(quote: dict, expected_cents: int) -> dict:
    """Credit the quote's platform USD source with disposable sandbox funds."""
    if quote.get("status") != "PENDING":
        raise GridSandboxError("Quote is not pending")
    if quote.get("totalSendingAmount") != expected_cents:
        raise GridSandboxError("Quote amount no longer matches the test link")
    if (quote.get("sendingCurrency") or {}).get("code") != "USD":
        raise GridSandboxError("Quote source is not USD")
    source = quote.get("source") or {}
    if source.get("sourceType") != "ACCOUNT" or not source.get("accountId"):
        raise GridSandboxError("Quote has no account source")
    account_id = source["accountId"]
    platform_accounts = _call("GET", "/platform/internal-accounts").get("data", [])
    if not any(account.get("id") == account_id for account in platform_accounts):
        raise GridSandboxError("Quote source is not a platform account")
    return _call(
        "POST",
        f"/sandbox/internal-accounts/{account_id}/fund",
        json={
            "amount": expected_cents,
            "description": "Satsway disposable USD sandbox link payment",
        },
    )


def execute_quote(quote_id: str) -> dict:
    return _call("POST", f"/quotes/{quote_id}/execute")
