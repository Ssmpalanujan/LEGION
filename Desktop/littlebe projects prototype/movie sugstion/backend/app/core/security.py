"""JWT auth + bcrypt password hashing (bcrypt used directly; passlib is
incompatible with bcrypt>=4 and mis-handles the 72-byte limit)."""
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.db import get_db
from app.models.entities import User

bearer = HTTPBearer(auto_error=False)


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw[:72].encode(), bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw[:72].encode(), hashed.encode())
    except Exception:
        return False


def _token(user_id: int, kind: str, ttl: timedelta) -> str:
    s = get_settings()
    now = datetime.utcnow()
    return jwt.encode(
        {"sub": str(user_id), "kind": kind, "iat": now, "exp": now + ttl},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )


def access_token(user_id: int) -> str:
    return _token(user_id, "access", timedelta(minutes=get_settings().access_token_minutes))


def refresh_token(user_id: int) -> str:
    return _token(user_id, "refresh", timedelta(days=get_settings().refresh_token_days))


def decode(user_id_token: str, want: str) -> int:
    s = get_settings()
    try:
        payload = jwt.decode(user_id_token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from e
    if payload.get("kind") != want:
        raise HTTPException(status_code=401, detail="Wrong token type.")
    return int(payload["sub"])


def current_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return decode(creds.credentials, "access")


def optional_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> int | None:
    if creds is None:
        return None
    try:
        return decode(creds.credentials, "access")
    except HTTPException:
        return None


def get_current_user(uid: int = Depends(current_user_id), db: Session = Depends(get_db)) -> User:
    u = db.query(User).filter(User.id == uid).first()
    if u is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return u


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    return user
