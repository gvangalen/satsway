"""Read-only Grid API connectivity check. Never creates a transaction."""

import os
import sys

import requests


def main() -> int:
    token_id = os.getenv("GRID_API_TOKEN_ID")
    client_secret = os.getenv("GRID_API_CLIENT_SECRET")
    if not token_id or not client_secret:
        print("Missing GRID_API_TOKEN_ID or GRID_API_CLIENT_SECRET.")
        print("Create sandbox credentials in the Lightspark Grid dashboard, then set both environment variables.")
        return 2

    base_url = os.getenv(
        "GRID_BASE_URL",
        "https://api.lightspark.com/grid/2025-10-13",
    ).rstrip("/")
    if not base_url.startswith("https://"):
        print("GRID_BASE_URL must use HTTPS.")
        return 2

    try:
        response = requests.get(
            f"{base_url}/config",
            auth=(token_id, client_secret),
            timeout=15,
        )
    except requests.RequestException as error:
        print(f"Grid connection failed: {type(error).__name__}")
        return 1

    print(f"Grid GET /config returned HTTP {response.status_code}.")
    if response.ok:
        print("Credentials and read-only API access work.")
        return 0
    if response.status_code in (401, 403):
        print("Credentials were rejected or lack access to this Grid endpoint.")
    else:
        print("Check the Grid environment and API version configured for this account.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
