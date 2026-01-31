"""
FastAPI application - REST API endpoints for scheduled message system.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
import shutil
from pathlib import Path

from database import get_db, init_db, get_user_by_username
from schemas import (
    User,
    UserCreate,
    UserSignIn
)

from auth import create_user, verify_password

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="Scheduled Message API",
    description="API for scheduling messages with file attachments and Telegram delivery",
    version="1.0.0"
)


# Base URL for file access
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks on startup"""
    init_db()


@app.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return create_user(db=db, user=user)

@app.post("/sign-in", response_model=User)
def sign_in(user: UserSignIn, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return db_user

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Scheduled Message API",
        "version": "1.0.0",
        "endpoints": {
            "POST /schedule-message": "Schedule a new message",
            "POST /subscribe-user": "Subscribe a new user",
            "GET /pending-messages": "Get all pending messages",
            "GET /subscribed-users": "Get all subscribed users"
        },
        "docs": "/docs",
        "redoc": "/redoc"
    }


def create_app():
    """Factory function to create and configure the FastAPI application"""
    return app
