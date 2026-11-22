from fastapi import APIRouter, Depends, Header, HTTPException, status

from backend.core.auth import get_current_user
from backend.models.auth import AuthCodeRequest, AuthCodeResponse, AuthTokenResponse, AuthVerifyRequest
from backend.models.user import UserCreate, UserRead
from backend.repositories.auth_repository import auth_repository
from backend.repositories.user_repository import user_repository

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate) -> UserRead:
    return user_repository.create(payload)


@router.post("/request-code", response_model=AuthCodeResponse)
def request_login_code(payload: AuthCodeRequest) -> AuthCodeResponse:
    code, expires_at = auth_repository.create_login_code(payload.email)
    print(f"Satsway login code for {payload.email}: {code}")

    return AuthCodeResponse(
        email=payload.email,
        expires_at=expires_at,
        message="Login code sent",
    )


@router.post("/verify-code", response_model=AuthTokenResponse)
def verify_login_code(payload: AuthVerifyRequest) -> AuthTokenResponse:
    token = auth_repository.verify_code(
        email=payload.email,
        code=payload.code,
        name=payload.name,
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login code",
        )

    return token


@router.get("/me", response_model=UserRead)
def get_me(current_user: UserRead = Depends(get_current_user)) -> UserRead:
    return current_user


@router.post("/logout")
def logout(authorization: str | None = Header(default=None, alias="Authorization")) -> dict[str, str]:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    auth_repository.revoke_token(authorization.split(" ", 1)[1])

    return {"status": "logged_out"}
