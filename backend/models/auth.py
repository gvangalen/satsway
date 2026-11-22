from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from backend.models.user import UserRead


class AuthCodeRequest(BaseModel):
    email: EmailStr


class AuthCodeResponse(BaseModel):
    email: EmailStr
    expires_at: datetime
    message: str


class AuthVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    name: str | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserRead
