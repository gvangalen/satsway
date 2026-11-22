"""Create a non-executing USD -> Lightning quote in the Grid sandbox.

This script creates a sandbox destination account and a quote. It never funds
an account or executes a transaction. Use a fresh test destination, not a
production payment request.
"""

import argparse
import hashlib
import os
import sys
from decimal import Decimal, InvalidOperation

import requests


BASE_URL = "https://api.lightspark.com/grid/2025-10-13"


def grid_request(method, path, auth, **kwargs):
    try:
        response = requests.request(
            method,
            f"{BASE_URL}{path}",
            auth=auth,
            timeout=20,
            **kwargs,
        )
    except requests.RequestException as error:
        raise RuntimeError(f"Grid connection failed: {type(error).__name__}") from error
    try:
        payload = response.json()
    except ValueError as error:
        raise RuntimeError(f"Grid returned HTTP {response.status_code} without JSON") from error
    if not response.ok:
        code = payload.get("code", "UNKNOWN")
        reason = payload.get("reason", "No reason supplied")
        raise RuntimeError(f"Grid returned HTTP {response.status_code}: {code}: {reason}")
    return payload


def usd_cents(value):
    try:
        amount = Decimal(value)
    except InvalidOperation as error:
        raise argparse.ArgumentTypeError("USD amount must be a number") from error
    if amount <= 0 or amount.as_tuple().exponent < -2:
        raise argparse.ArgumentTypeError("USD amount must be positive with at most 2 decimals")
    return int(amount * 100)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    destination = parser.add_mutually_exclusive_group(required=True)
    destination.add_argument("--lightning-address", help="Recipient's test Lightning address")
    destination.add_argument("--invoice", help="Fresh BOLT11 test invoice")
    parser.add_argument("--amount-usd", type=usd_cents, default=1850, metavar="USD")
    parser.add_argument("--sats", type=int, help="Invoice amount in whole satoshis")
    args = parser.parse_args()

    if args.invoice and (not args.sats or args.sats <= 0):
        parser.error("--sats is required with --invoice")
    if args.lightning_address and ("@" not in args.lightning_address or " " in args.lightning_address):
        parser.error("--lightning-address must look like name@domain")

    token_id = os.getenv("GRID_API_TOKEN_ID")
    secret = os.getenv("GRID_API_CLIENT_SECRET")
    if not token_id or not secret:
        parser.error("Set GRID_API_TOKEN_ID and GRID_API_CLIENT_SECRET in the environment")
    auth = (token_id, secret)

    accounts = grid_request("GET", "/platform/internal-accounts", auth)["data"]
    usd_accounts = [
        account for account in accounts
        if (account.get("balance", {}).get("currency") or {}).get("code") == "USD"
        and account.get("status") == "ACTIVE"
    ]
    if not usd_accounts:
        raise RuntimeError("No active platform USD account is available")
    source_id = usd_accounts[0]["id"]

    recipient = args.lightning_address or args.invoice
    test_id = "satsway-sandbox-" + hashlib.sha256(recipient.encode()).hexdigest()[:24]
    saved_accounts = grid_request("GET", "/platform/external-accounts", auth)["data"]
    external = next(
        (account for account in saved_accounts if account.get("platformAccountId") == test_id),
        None,
    )
    if external is None:
        account_info = {"accountType": "LIGHTNING"}
        if args.lightning_address:
            account_info["lightningAddress"] = args.lightning_address
        else:
            account_info["invoice"] = args.invoice
        external = grid_request(
            "POST",
            "/platform/external-accounts",
            auth,
            json={
                "currency": "BTC",
                "platformAccountId": test_id,
                "ownershipType": "THIRD_PARTY",
                "accountInfo": account_info,
            },
        )
        print("Created sandbox Lightning destination account.")
    else:
        print("Reusing sandbox Lightning destination account.")

    locked_side = "RECEIVING" if args.invoice else "SENDING"
    locked_amount = args.sats if args.invoice else args.amount_usd
    quote = grid_request(
        "POST",
        "/quotes",
        auth,
        json={
            "source": {"sourceType": "ACCOUNT", "accountId": source_id},
            "destination": {"destinationType": "ACCOUNT", "accountId": external["id"]},
            "lockedCurrencySide": locked_side,
            "lockedCurrencyAmount": locked_amount,
            "immediatelyExecute": False,
            "description": "Satsway USD to sats sandbox quote test",
        },
    )
    print(f"Quote: {quote['id']}; status: {quote['status']}")
    print(f"Sender: {quote['totalSendingAmount']} USD cents; recipient: {quote['totalReceivingAmount']} sats")
    print(f"Fees: {quote['feesIncluded']} USD cents; expires: {quote['expiresAt']}")
    print("No funds were moved. This quote has not been executed.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
