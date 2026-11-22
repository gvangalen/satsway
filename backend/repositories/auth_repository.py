import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from backend.core.config import settings
from backend.core.database import SessionLocal
from backend.core.time import utc_now
from backend.db.tables import AuthCodeTable, AuthTokenTable, UserTable
from backend.models.auth import AuthTokenResponse
from backend.models.user import UserRead


class AuthRepository:
    def create_login_code(self, email: str) -> tuple[str, datetime]:
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = utc_now() + timedelta(minutes=10)
        with SessionLocal() as session:
            session.add(
                AuthCodeTable(
                    id=str(uuid4()),
                    email=email.lower(),
                    code_hash=self._hash_secret(code),
                    expires_at=expires_at,
                    consumed=False,
                ),
            )
            session.commit()

        return code, expires_at

    def verify_code(self, email: str, code: str, name: str | None = None) -> AuthTokenResponse | None:
        now = utc_now()
        normalized_email = email.lower()
        with SessionLocal() as session:
            code_row = (
                session.query(AuthCodeTable)
                .filter(AuthCodeTable.email == normalized_email)
                .filter(AuthCodeTable.consumed.is_(False))
                .filter(AuthCodeTable.expires_at >= now)
                .order_by(AuthCodeTable.created_at.desc())
                .first()
            )
            if code_row is None:
                return None

            if not hmac.compare_digest(code_row.code_hash, self._hash_secret(code)):
                return None

            code_row.consumed = True
            user_row = (
                session.query(UserTable)
                .filter(UserTable.email == normalized_email)
                .first()
            )
            if user_row is None:
                user_row = UserTable(
                    id=str(uuid4()),
                    email=normalized_email,
                    name=name,
                    created_at=now,
                )
                session.add(user_row)
            elif name and not user_row.name:
                user_row.name = name

            token = secrets.token_urlsafe(32)
            expires_at = now + timedelta(days=30)
            session.add(
                AuthTokenTable(
                    id=str(uuid4()),
                    user_id=user_row.id,
                    token_hash=self._hash_secret(token),
                    expires_at=expires_at,
                    revoked=False,
                    created_at=now,
                ),
            )
            session.commit()

            user = UserRead(
                id=UUID(user_row.id),
                email=user_row.email,
                name=user_row.name,
                created_at=user_row.created_at,
            )

        return AuthTokenResponse(
            access_token=token,
            expires_at=expires_at,
            user=user,
        )

    def get_user_by_token(self, token: str) -> UserRead | None:
        now = utc_now()
        token_hash = self._hash_secret(token)
        with SessionLocal() as session:
            token_row = (
                session.query(AuthTokenTable)
                .filter(AuthTokenTable.token_hash == token_hash)
                .filter(AuthTokenTable.revoked.is_(False))
                .filter(AuthTokenTable.expires_at >= now)
                .first()
            )
            if token_row is None:
                return None

            user_row = session.get(UserTable, token_row.user_id)
            if user_row is None:
                return None

            return UserRead(
                id=UUID(user_row.id),
                email=user_row.email,
                name=user_row.name,
                created_at=user_row.created_at,
            )

    def revoke_token(self, token: str) -> bool:
        token_hash = self._hash_secret(token)
        with SessionLocal() as session:
            token_row = (
                session.query(AuthTokenTable)
                .filter(AuthTokenTable.token_hash == token_hash)
                .first()
            )
            if token_row is None:
                return False

            token_row.revoked = True
            session.commit()

        return True

    def _hash_secret(self, secret: str) -> str:
        return hmac.new(
            settings.auth_token_secret.encode(),
            secret.encode(),
            hashlib.sha256,
        ).hexdigest()


auth_repository = AuthRepository()
