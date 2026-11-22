from datetime import datetime, timedelta
from random import choice
from uuid import UUID

from sqlalchemy import or_

from backend.core.database import SessionLocal, db, init_database
from backend.core.time import utc_now
from backend.db.tables import PosterTable
from backend.models.poster import Poster, PosterRead


class PosterService:
    def __init__(self) -> None:
        self._seed_default_posters()

    def get_random_active(self) -> PosterRead | None:
        init_database()
        now = utc_now()
        with SessionLocal() as session:
            rows = (
                session.query(PosterTable)
                .filter(PosterTable.active.is_(True))
                .filter(or_(PosterTable.start_date.is_(None), PosterTable.start_date <= now))
                .filter(or_(PosterTable.end_date.is_(None), PosterTable.end_date >= now))
                .all()
            )
            active_posters = [self._from_row(row) for row in rows]

        if active_posters:
            return choice(active_posters)

        active_posters = [
            poster
            for poster in db.posters.values()
            if self._is_active_now(poster=poster, now=now)
        ]

        if not active_posters:
            return None

        return choice(active_posters)

    def get(self, poster_id: UUID) -> PosterRead | None:
        with SessionLocal() as session:
            row = session.get(PosterTable, str(poster_id))
            if row is not None:
                return self._from_row(row)

        return db.posters.get(poster_id)

    def _is_active_now(self, poster: PosterRead, now: datetime) -> bool:
        if not poster.active:
            return False

        if poster.start_date is not None and poster.start_date > now:
            return False

        if poster.end_date is not None and poster.end_date < now:
            return False

        return True

    def _seed_default_posters(self) -> None:
        init_database()
        with SessionLocal() as session:
            if session.query(PosterTable).count() > 0:
                return

        if db.posters:
            return

        now = utc_now()
        posters = [
            Poster(
                title="Waarom Bitcoin?",
                image_url="https://images.unsplash.com/photo-1621761191319-c6fb62004040",
                text="Bitcoin is digitaal geld dat wereldwijd werkt, zonder bank als tussenlaag.",
                sponsor_name="Satsway Academy",
                sponsor_url="https://bitcoin.org",
                active=True,
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=90),
            ),
            Poster(
                title="Betaal zoals jij wilt",
                image_url="https://images.unsplash.com/photo-1518546305927-5a555bb7020d",
                text="Met Satsway kiest de ontvanger straks zelf: euro via Stripe of bitcoin via Lightning.",
                sponsor_name="Satsway",
                sponsor_url="https://stripe.com",
                active=True,
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=90),
            ),
            Poster(
                title="Lightning in 10 seconden",
                image_url="https://images.unsplash.com/photo-1640340434855-6084b1f4901c",
                text="Lightning maakt kleine bitcoinbetalingen snel en goedkoop. Ideaal voor splits.",
                sponsor_name="Bitcoin Educatie",
                sponsor_url="https://river.com",
                active=True,
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=90),
            ),
        ]

        for poster in posters:
            stored_poster = PosterRead(**poster.dict())
            db.posters[stored_poster.id] = stored_poster
            with SessionLocal() as session:
                session.merge(
                    PosterTable(
                        id=str(stored_poster.id),
                        title=stored_poster.title,
                        image_url=str(stored_poster.image_url),
                        text=stored_poster.text,
                        sponsor_name=stored_poster.sponsor_name,
                        sponsor_url=str(stored_poster.sponsor_url)
                        if stored_poster.sponsor_url
                        else None,
                        active=stored_poster.active,
                        start_date=stored_poster.start_date,
                        end_date=stored_poster.end_date,
                    ),
                )
                session.commit()

    def _from_row(self, row: PosterTable) -> PosterRead:
        return PosterRead(
            id=UUID(row.id),
            title=row.title,
            image_url=row.image_url,
            text=row.text,
            sponsor_name=row.sponsor_name,
            sponsor_url=row.sponsor_url,
            active=row.active,
            start_date=row.start_date,
            end_date=row.end_date,
        )


poster_service = PosterService()
