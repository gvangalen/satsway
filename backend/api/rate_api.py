from fastapi import APIRouter

from backend.models.rate import RatesRead
from backend.services.fx_service import fx_service

router = APIRouter(prefix="/api/rates", tags=["rates"])


@router.get("", response_model=RatesRead)
def get_rates() -> RatesRead:
    return fx_service.get_rates()
