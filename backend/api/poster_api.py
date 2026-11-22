from fastapi import APIRouter, HTTPException, status

from backend.models.poster import PosterRead
from backend.services.poster_service import poster_service

router = APIRouter(prefix="/api/posters", tags=["posters"])


@router.get("/random", response_model=PosterRead)
def get_random_poster() -> PosterRead:
    poster = poster_service.get_random_active()
    if poster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active posters found",
        )

    return poster
