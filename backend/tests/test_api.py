import os
import time
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID

os.environ["DATABASE_URL"] = "sqlite:///./satsway_test.db"
os.environ["AUTH_TOKEN_SECRET"] = "test-auth-secret"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_placeholder"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"
os.environ["RIVER_WEBHOOK_SECRET"] = ""
os.environ["COINGECKO_API_BASE_URL"] = "http://127.0.0.1:9"

TEST_DB_PATH = Path("satsway_test.db")
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

from fastapi.testclient import TestClient  # noqa: E402
import stripe  # noqa: E402

from backend.main import app  # noqa: E402
from backend.core.database import SessionLocal  # noqa: E402
from backend.core.time import utc_now  # noqa: E402
from backend.db.tables import PaymentQuoteTable, PaymentShareTable  # noqa: E402
from backend.repositories.auth_repository import auth_repository  # noqa: E402
from backend.services.request_service import request_service  # noqa: E402
from backend.api import grid_sandbox_api  # noqa: E402


def teardown_module() -> None:
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


def authenticate(client: TestClient) -> str:
    email = "owner@example.com"
    code, _ = auth_repository.create_login_code(email)

    response = client.post(
        "/api/auth/verify-code",
        json={"email": email, "code": code, "name": "Owner"},
    )

    assert response.status_code == 200
    return response.json()["access_token"]


def test_health_endpoints() -> None:
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

        db_response = client.get("/health/db")
        assert db_response.status_code == 200
        assert db_response.json()["database"] == "ok"

        config_response = client.get("/health/config")
        assert config_response.status_code == 200
        assert config_response.json()["stripe"] is False


def test_grid_sandbox_link_records_completion_without_funding_twice(monkeypatch) -> None:
    from datetime import datetime, timezone

    monkeypatch.setattr(grid_sandbox_api.settings, "grid_sandbox_links_enabled", True)
    funding_calls = []
    quote = {
        "id": "Quote:test-grid-link",
        "status": "PENDING",
        "totalSendingAmount": 1850,
        "totalReceivingAmount": 30100,
        "feesIncluded": 62,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "transactionId": "Transaction:test-grid-link",
    }

    monkeypatch.setattr(grid_sandbox_api, "create_usd_lightning_quote", lambda amount, address: quote)
    monkeypatch.setattr(grid_sandbox_api, "get_quote", lambda quote_id: quote)
    monkeypatch.setattr(grid_sandbox_api, "simulate_usd_funding", lambda grid_quote, cents: funding_calls.append(cents) or {})
    monkeypatch.setattr(grid_sandbox_api, "execute_quote", lambda quote_id: {"status": "PROCESSING", "transactionId": "Transaction:test-grid-link"})
    monkeypatch.setattr(grid_sandbox_api, "get_transaction", lambda transaction_id: {"status": "COMPLETED"})

    with TestClient(app) as client:
        noor = client.post("/api/sandbox/grid-links/test-login/noor").json()
        sam = client.post("/api/sandbox/grid-links/test-login/sam").json()
        noor_headers = {"Authorization": f"Bearer {noor['access_token']}"}
        sam_headers = {"Authorization": f"Bearer {sam['access_token']}"}
        created = client.post(
            "/api/sandbox/grid-links",
            json={"amount_usd": "18.50", "lightning_address": "recipient@example.com"},
            headers=noor_headers,
        )
        assert created.status_code == 201
        assert created.json()["owner_name"] == "Noor"
        link_id = created.json()["id"]
        assert any(link["id"] == link_id for link in client.get("/api/sandbox/grid-links/mine", headers=noor_headers).json())
        assert client.post(f"/api/sandbox/grid-links/{link_id}/quote").status_code == 200
        self_payment = client.post(f"/api/sandbox/grid-links/{link_id}/simulate", headers=noor_headers)
        first = client.post(f"/api/sandbox/grid-links/{link_id}/simulate", headers=sam_headers)
        repeated = client.post(f"/api/sandbox/grid-links/{link_id}/simulate", headers=sam_headers)
        completed = client.get(f"/api/sandbox/grid-links/{link_id}/status")
        sam_links = client.get("/api/sandbox/grid-links/mine", headers=sam_headers).json()

    assert self_payment.status_code == 403
    assert first.status_code == 200
    assert first.json()["fiat_status"] == "simulated_received"
    assert repeated.status_code == 200
    assert funding_calls == [1850]
    assert completed.json()["sats_status"] == "completed"
    assert completed.json()["payer_name"] == "Sam"
    assert any(link["id"] == link_id for link in sam_links)


def test_grid_demo_login_requires_access_code_when_configured(monkeypatch) -> None:
    monkeypatch.setattr(grid_sandbox_api.settings, "grid_sandbox_links_enabled", True)
    monkeypatch.setattr(grid_sandbox_api.settings, "grid_sandbox_demo_access_code", "private-demo-code")
    with TestClient(app) as client:
        path = "/api/sandbox/grid-links/test-login/noor"
        assert client.post(path).status_code == 403
        assert client.post(path, headers={"X-Satsway-Demo-Code": "wrong"}).status_code == 403
        assert client.post(path, headers={"X-Satsway-Demo-Code": "private-demo-code"}).status_code == 200


def test_passwordless_auth_and_current_user() -> None:
    with TestClient(app) as client:
        token = authenticate(client)
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["email"] == "owner@example.com"


def test_authenticated_request_create_list_and_detail_with_poster() -> None:
    with TestClient(app) as client:
        token = authenticate(client)
        headers = {"Authorization": f"Bearer {token}"}

        create_response = client.post(
            "/api/requests",
            headers=headers,
            json={
                "amount_eur": "21.50",
                "settlement_currency": "EUR",
                "description": "Backend test split",
            },
        )

        assert create_response.status_code == 201
        created = create_response.json()
        assert created["status"] == "pending"
        assert created["description"] == "Backend test split"

        list_response = client.get("/api/requests", headers=headers)
        assert list_response.status_code == 200
        assert any(item["id"] == created["id"] for item in list_response.json())

        detail_response = client.get(f"/api/requests/{created['id']}")
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["id"] == created["id"]
        assert detail["poster"] is not None


def test_btc_payment_session_uses_river_provider_mock() -> None:
    with TestClient(app) as client:
        token = authenticate(client)

        create_response = client.post(
            "/api/requests",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "amount_eur": "10.00",
                "settlement_currency": "EUR",
                "description": "BTC payment test",
            },
        )
        request_id = create_response.json()["id"]

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC"},
        )

        assert payment_response.status_code == 200
        payment_session = payment_response.json()
        assert payment_session["provider"] == "river"
        assert payment_session["payment_currency"] == "BTC"
        assert payment_session["lightning_invoice"].startswith("lnbc")
        assert payment_session["lightning_payment_hash"].startswith("mock_hash_")


def test_btc_payment_session_uses_receiver_share_amount() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "50.00",
                "settlement_currency": "EUR",
                "participant_count": 4,
                "description": "Shared BTC payment test",
            },
        )
        request_id = create_response.json()["request_id"]

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC"},
        )

        assert payment_response.status_code == 200
        payment_session = payment_response.json()
        assert Decimal(str(payment_session["settlement_amount"])) == Decimal("12.50")
        assert payment_session["payment_currency"] == "BTC"
        assert Decimal(str(payment_session["payment_amount"])) == Decimal("0.00013158")
        assert payment_session["lightning_invoice"].startswith("lnbc13158")


def test_btc_quote_endpoint_returns_sats_for_eur_amount() -> None:
    with TestClient(app) as client:
        quote_response = client.get("/api/quotes/btc", params={"amount_eur": "12.50"})

        assert quote_response.status_code == 200
        quote = quote_response.json()
        assert Decimal(str(quote["amount_eur"])) == Decimal("12.50")
        assert Decimal(str(quote["btc_amount"])) == Decimal("0.00013158")
        assert quote["sats"] == 13158
        assert quote["source"] == "Fallback"


def test_share_btc_quote_uses_receiver_share_amount() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "50.00",
                "settlement_currency": "EUR",
                "participant_count": 4,
                "description": "Share quote test",
            },
        )
        request_id = create_response.json()["request_id"]
        shares = client.get(f"/requests/{request_id}").json()["shares"]

        quote_response = client.get(f"/api/quotes/requests/{request_id}/shares/{shares[0]['id']}/btc")

        assert quote_response.status_code == 200
        quote = quote_response.json()
        assert quote["request_id"] == request_id
        assert quote["share_id"] == shares[0]["id"]
        assert Decimal(str(quote["amount_eur"])) == Decimal("12.50")
        assert quote["sats"] == 13158


def test_sats_request_requires_wallet_and_does_not_start_stripe() -> None:
    with TestClient(app) as client:
        missing_address = client.post(
            "/requests",
            json={"amount_eur": "20.00", "settlement_currency": "BTC"},
        )
        assert missing_address.status_code == 422

        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "20.00",
                "settlement_currency": "BTC",
                "lightning_address": "recipient@example.com",
                "participant_count": 1,
                "description": "Receive BTC test",
            },
        )
        request_id = create_response.json()["request_id"]
        assert create_response.status_code == 201
        assert create_response.json()["checkout_url"] == ""
        stored_request = client.get(f"/requests/{request_id}").json()
        assert stored_request["lightning_address"] == "recipient@example.com"

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "EUR"},
        )

        assert payment_response.status_code == 400
        assert payment_response.json()["detail"] == "GRID_NOT_CONFIGURED"


def test_expired_btc_quote_blocks_invoice_creation() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "12.50",
                "settlement_currency": "EUR",
                "participant_count": 1,
                "description": "Expired quote test",
            },
        )
        request_id = create_response.json()["request_id"]
        share_id = client.get(f"/requests/{request_id}").json()["shares"][0]["id"]
        quote = client.get(f"/api/quotes/requests/{request_id}/shares/{share_id}/btc").json()

        with SessionLocal() as session:
            row = session.get(PaymentQuoteTable, quote["quote_id"])
            assert row is not None
            row.expires_at = utc_now() - timedelta(seconds=1)
            session.commit()

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={
                "payment_currency": "BTC",
                "share_id": share_id,
                "quote_id": quote["quote_id"],
            },
        )

        assert payment_response.status_code == 409
        assert payment_response.json()["detail"] == "QUOTE_EXPIRED"


def test_btc_invoice_locks_sats_and_reuses_locked_amount() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "12.50",
                "settlement_currency": "EUR",
                "participant_count": 1,
                "description": "Locked sats test",
            },
        )
        request_id = create_response.json()["request_id"]
        share_id = client.get(f"/requests/{request_id}").json()["shares"][0]["id"]
        quote = client.get(f"/api/quotes/requests/{request_id}/shares/{share_id}/btc").json()

        first_payment = client.post(
            f"/requests/{request_id}/payment-session",
            json={
                "payment_currency": "BTC",
                "share_id": share_id,
                "quote_id": quote["quote_id"],
            },
        ).json()
        second_payment = client.post(
            f"/requests/{request_id}/payment-session",
            json={
                "payment_currency": "BTC",
                "share_id": share_id,
            },
        ).json()

        assert first_payment["payment_amount_sats"] == 13158
        assert first_payment["locked_sats"] == 13158
        assert first_payment["invoice_id"] == first_payment["lightning_payment_hash"]
        assert second_payment["invoice_id"] == first_payment["invoice_id"]
        assert second_payment["lightning_invoice"] == first_payment["lightning_invoice"]
        assert second_payment["payment_amount_sats"] == first_payment["payment_amount_sats"]
        assert Decimal(str(second_payment["payment_amount"])) == Decimal(str(first_payment["payment_amount"]))


def test_expired_locked_btc_invoice_resets_and_creates_new_invoice() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "12.50",
                "settlement_currency": "EUR",
                "participant_count": 1,
                "description": "Expired invoice test",
            },
        )
        request_id = create_response.json()["request_id"]
        share_id = client.get(f"/requests/{request_id}").json()["shares"][0]["id"]

        first_payment = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC", "share_id": share_id},
        ).json()

        with SessionLocal() as session:
            row = session.get(PaymentShareTable, share_id)
            assert row is not None
            row.invoice_expires_at = utc_now() - timedelta(seconds=1)
            session.commit()

        second_payment = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC", "share_id": share_id},
        ).json()

        assert second_payment["invoice_id"] != first_payment["invoice_id"]
        assert second_payment["lightning_invoice"] != first_payment["lightning_invoice"]
        assert second_payment["payment_amount_sats"] == 13158


def test_paid_share_does_not_reopen_btc_invoice() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "12.50",
                "settlement_currency": "EUR",
                "participant_count": 1,
                "description": "Paid transition test",
            },
        )
        request_id = create_response.json()["request_id"]
        share_id = client.get(f"/requests/{request_id}").json()["shares"][0]["id"]

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC", "share_id": share_id},
        )
        assert payment_response.status_code == 200

        first_paid = request_service.mark_share_paid(UUID(share_id))
        second_paid = request_service.mark_share_paid(UUID(share_id))
        assert first_paid is not None
        assert second_paid is not None
        assert first_paid.status == "paid"
        assert second_paid.status == "paid"

        reopen_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "BTC", "share_id": share_id},
        )
        assert reopen_response.status_code == 404


def test_custom_share_amounts_create_exact_payment_shares() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "30.00",
                "settlement_currency": "EUR",
                "participant_count": 3,
                "share_amounts_eur": ["5.00", "10.00", "15.00"],
                "description": "Custom split",
            },
        )
        assert create_response.status_code == 201
        request_id = create_response.json()["request_id"]

        detail = client.get(f"/requests/{request_id}").json()
        shares = detail["shares"]
        assert [Decimal(str(share["amount_eur"])) for share in shares] == [
            Decimal("5.00"),
            Decimal("10.00"),
            Decimal("15.00"),
        ]

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "EUR", "share_id": shares[1]["id"]},
        )

        assert payment_response.status_code == 200
        payment_session = payment_response.json()
        assert Decimal(str(payment_session["settlement_amount"])) == Decimal("10.00")


def test_custom_share_amounts_must_add_up_to_total() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "30.00",
                "settlement_currency": "EUR",
                "participant_count": 2,
                "share_amounts_eur": ["10.00", "10.00"],
                "description": "Invalid custom split",
            },
        )

        assert create_response.status_code == 422


def test_request_is_paid_only_after_all_shares_are_paid() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "20.00",
                "settlement_currency": "EUR",
                "participant_count": 2,
                "description": "Two receiver split",
            },
        )
        request_id = create_response.json()["request_id"]
        detail = client.get(f"/requests/{request_id}").json()
        shares = detail["shares"]

        assert detail["status"] == "pending"
        assert detail["paid_count"] == 0
        assert len(shares) == 2

        first_update = request_service.mark_share_paid(UUID(shares[0]["id"]))
        assert first_update is not None
        assert first_update.status == "pending"
        assert first_update.paid_count == 1

        second_update = request_service.mark_share_paid(UUID(shares[1]["id"]))
        assert second_update is not None
        assert second_update.status == "paid"
        assert second_update.paid_count == 2


def test_paid_share_cannot_create_new_payment_session() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "20.00",
                "settlement_currency": "EUR",
                "participant_count": 2,
                "description": "No double payment",
            },
        )
        request_id = create_response.json()["request_id"]
        shares = client.get(f"/requests/{request_id}").json()["shares"]
        request_service.mark_share_paid(UUID(shares[0]["id"]))

        payment_response = client.post(
            f"/requests/{request_id}/payment-session",
            json={"payment_currency": "EUR", "share_id": shares[0]["id"]},
        )

        assert payment_response.status_code == 404


def test_stripe_webhook_marks_request_paid() -> None:
    with TestClient(app) as client:
        create_response = client.post(
            "/requests",
            json={
                "amount_eur": "12.00",
                "settlement_currency": "EUR",
                "description": "Stripe webhook test",
            },
        )
        assert create_response.status_code == 201
        request_id = create_response.json()["request_id"]

        payload = (
            "{"
            '"id":"evt_test_checkout_completed",'
            '"object":"event",'
            '"type":"checkout.session.completed",'
            '"data":{"object":{'
            '"id":"cs_test_123",'
            f'"metadata":{{"request_id":"{request_id}","payment_request_id":"{request_id}"}}'
            "}}"
            "}"
        )
        timestamp = int(time.time())
        signed_payload = f"{timestamp}.{payload}"
        signature = stripe.WebhookSignature._compute_signature(
            signed_payload,
            os.environ["STRIPE_WEBHOOK_SECRET"],
        )

        webhook_response = client.post(
            "/webhooks/stripe",
            content=payload,
            headers={
                "Stripe-Signature": f"t={timestamp},v1={signature}",
                "Content-Type": "application/json",
            },
        )

        assert webhook_response.status_code == 200
        assert webhook_response.json()["status"] == "received"

        detail_response = client.get(f"/requests/{request_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["status"] == "paid"
