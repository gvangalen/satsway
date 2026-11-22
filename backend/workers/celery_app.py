from celery import Celery

from backend.core.config import settings

celery_app = Celery(
    "satsway",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["backend.workers.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_time_limit=300,
    timezone="UTC",
    broker_connection_retry_on_startup=False,
    broker_connection_max_retries=1,
    result_backend_transport_options={"retry_policy": {"max_retries": 1}},
)
