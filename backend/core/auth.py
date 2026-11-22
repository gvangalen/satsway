from uuid import UUID

from fastapi import Header, HTTPException, status

from backend.models.user import UserRead
from backend.repositories.auth_repository import auth_repository
from backend.repositories.user_repository import user_repository


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> UserRead:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        user = auth_repository.get_user_by_token(token)
        if user is not None:
            return user

    if x_user_id is not None:
        try:
            user_id = UUID(x_user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-User-Id header",
            )

        user = user_repository.get(user_id)
        if user is not None:
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
