from uuid import UUID

from backend.core.database import SessionLocal
from backend.db.tables import UserTable
from backend.models.user import User, UserCreate, UserRead


class UserRepository:
    def create(self, payload: UserCreate) -> UserRead:
        user = User(email=payload.email, name=payload.name)
        with SessionLocal() as session:
            session.merge(
                UserTable(
                    id=str(user.id),
                    email=user.email,
                    name=user.name,
                    created_at=user.created_at,
                ),
            )
            session.commit()

        return UserRead(**user.dict())

    def get(self, user_id: UUID) -> UserRead | None:
        with SessionLocal() as session:
            row = session.get(UserTable, str(user_id))
            if row is None:
                return None

            return UserRead(
                id=UUID(row.id),
                email=row.email,
                name=row.name,
                created_at=row.created_at,
            )


user_repository = UserRepository()
