"""Auth routes: register / login / refresh / me (JWT access+refresh, bcrypt)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core import security as sec
from app.models.db import get_db
from app.models.entities import User
from app.schemas.user import LoginIn, RefreshIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered.")
    u = User(email=body.email.lower(), password_hash=sec.hash_password(body.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"access_token": sec.access_token(u.id), "refresh_token": sec.refresh_token(u.id)}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == body.email.lower()).first()
    if u is None or not sec.verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"access_token": sec.access_token(u.id), "refresh_token": sec.refresh_token(u.id)}


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    uid = sec.decode(body.refresh_token, "refresh")
    u = db.query(User).filter(User.id == uid).first()
    if u is None:
        raise HTTPException(status_code=401, detail="User not found.")
    return {"access_token": sec.access_token(u.id), "refresh_token": sec.refresh_token(u.id)}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(sec.get_current_user)):
    return user
