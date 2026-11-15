from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import User, Warehouse
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    uid = decode_token(creds.credentials) if creds else None
    user = db.get(User, uid) if uid else None
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role.name != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def default_warehouse(db: Session, business_id: int) -> Warehouse:
    wh = db.scalar(select(Warehouse).where(Warehouse.business_id == business_id,
                                           Warehouse.is_default.is_(True)))
    if not wh:
        raise HTTPException(500, "No default warehouse configured")
    return wh
