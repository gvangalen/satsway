from backend.workers.celery_app import celery_app


@celery_app.task(name="satsway.process_receipt_scan")
def process_receipt_scan(receipt_id: str) -> dict[str, str]:
    print(f"Processing receipt scan: {receipt_id}")
    return {"receipt_id": receipt_id, "status": "queued"}


@celery_app.task(name="satsway.reconcile_payment")
def reconcile_payment(transaction_id: str) -> dict[str, str]:
    print(f"Reconciling payment: {transaction_id}")
    return {"transaction_id": transaction_id, "status": "queued"}


@celery_app.task(name="satsway.expire_quotes")
def expire_quotes() -> dict[str, str]:
    print("Expiring stale payment quotes")
    return {"status": "queued"}


@celery_app.task(name="satsway.refresh_fx_rates")
def refresh_fx_rates() -> dict[str, str]:
    print("Refreshing FX rates")
    return {"status": "queued"}
