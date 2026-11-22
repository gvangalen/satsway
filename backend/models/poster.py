from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class Poster(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str
    image_url: HttpUrl
    text: str
    sponsor_name: str | None = None
    sponsor_url: HttpUrl | None = None
    active: bool = True
    start_date: datetime | None = None
    end_date: datetime | None = None


class PosterRead(Poster):
    pass
