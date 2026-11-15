from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import LoginIn, TokenOut, UserOut
from ..security import create_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role.name, business_id=u.business_id)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return TokenOut(access_token=create_token(user.id), user=user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user_out(user)
