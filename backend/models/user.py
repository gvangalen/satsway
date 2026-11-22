from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr, Field

from backend.core.time import utc_now


class UserCreate(BaseModel):
    email: EmailStr
    name: str | None = None


class User(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    email: EmailStr
    name: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class UserRead(User):
    pass
