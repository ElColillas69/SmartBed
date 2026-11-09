import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, status, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, BedAccess

SECRET_KEY = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(pw: str) -> str:
    return password_hash.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return password_hash.verify(pw, hashed)

def create_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": user.id, "role": user.role, "exp": expires},
    SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    unauthorised = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in",
    headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        raise unauthorised
    user = db.get(User, payload.get("sub"))
    if user is None:
        raise unauthorised
    return user

def allowed_bed(bed_id: str, user: User = Depends(get_current_user),
    db: Session = Depends(get_db)) -> str:
    if db.get(BedAccess, (user.id, bed_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bed not found")
    return bed_id