import bcrypt
from sqlalchemy.orm import Session
from models import User
from schemas import UserCreate
import os
import base64
import uuid

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies the password against the given hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    """Hashes the password"""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    admin_id = str(uuid.uuid4())
    db_user = User(username=user.username, hashed_password=hashed_password, uuid=admin_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
