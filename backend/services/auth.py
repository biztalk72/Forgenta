"""Auth service: in-memory user store, JWT, password hashing."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel

from backend.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(BaseModel):
    id: str
    email: str
    name: str
    provider: str = "email"
    hashed_password: Optional[str] = None
    created_at: datetime = datetime.now(timezone.utc)


# email → User
_users: dict[str, User] = {}


def get_user_by_email(email: str) -> Optional[User]:
    return _users.get(email.lower())


def get_user_by_id(user_id: str) -> Optional[User]:
    for u in _users.values():
        if u.id == user_id:
            return u
    return None


def create_user(
    email: str,
    name: str,
    provider: str = "email",
    password: Optional[str] = None,
) -> User:
    user = User(
        id=str(uuid.uuid4()),
        email=email.lower(),
        name=name,
        provider=provider,
        hashed_password=pwd_context.hash(password) if password else None,
    )
    _users[user.email] = user
    return user


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None
