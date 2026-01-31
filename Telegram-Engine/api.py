"""
FastAPI application - REST API endpoints for scheduled message system.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
import shutil
from pathlib import Path

from database import get_db, init_db
from models import ScheduledMessage, SubscribedUser
from schemas import (
    ScheduleMessageRequest,
    ScheduleMessageResponse,
    SubscribeUserRequest,
    SubscribeUserResponse
)
from scheduler import start_message_scheduler

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="Scheduled Message API",
    description="API for scheduling messages with file attachments and Telegram delivery",
    version="1.0.0"
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount static files to serve uploaded files
app.mount("/files", StaticFiles(directory="uploads"), name="files")

# Base URL for file access
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks on startup"""
    init_db()
    start_message_scheduler(app)


@app.post("/schedule-message", response_model=ScheduleMessageResponse)
async def schedule_message(
        from_sender: str = Form(...),
        target_user_id: str = Form(...),
        message: str = Form(...),
        scheduled_timestamp: str = Form(...),
        files: Optional[List[UploadFile]] = File(None),
        db: Session = Depends(get_db)
):
    """
    Schedule a message to be sent at a specific time.
    - **from_sender**: sender IDs that sent message
    - **target_user_id**: Comma-separated list of user IDs
    - **message**: The message content
    - **scheduled_timestamp**: UTC timestamp (ISO 8601 format)
    - **files**: Optional list of files to attach
    """
    try:
        # Parse target_user_id (comma-separated string to list)
        target_users = [uid.strip() for uid in target_user_id.split(",")]

        # Parse scheduled timestamp
        scheduled_dt = datetime.fromisoformat(scheduled_timestamp.replace('Z', '+00:00'))

        # Generate unique ID for this scheduled message
        message_id = str(uuid.uuid4())

        # Handle file uploads
        file_paths = []
        if files:
            for file in files:
                if file.filename:
                    # Generate unique filename
                    file_extension = Path(file.filename).suffix
                    unique_filename = f"{message_id}_{uuid.uuid4()}{file_extension}"
                    file_path = UPLOAD_DIR / unique_filename

                    # Save file
                    with open(file_path, "wb") as buffer:
                        shutil.copyfileobj(file.file, buffer)

                    file_paths.append(str(file_path))

        # Create scheduled message record
        scheduled_msg = ScheduledMessage(
            id=message_id,
            from_sender=from_sender,
            target_user_id=target_users,
            message=message,
            scheduled_timestamp=scheduled_dt,
            file_paths=file_paths if file_paths else None,
            is_sent=False
        )

        db.add(scheduled_msg)
        db.commit()
        db.refresh(scheduled_msg)

        return scheduled_msg

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid timestamp format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/subscribe-user", response_model=SubscribeUserResponse)
async def subscribe_user(
        user_data: SubscribeUserRequest,
        db: Session = Depends(get_db)
):
    """
    Subscribe a new user and generate a unique user_id.

    - **chat_id**: Unique chat identifier
    - **chat_name**: Name of the chat/user
    """
    try:
        # Check if chat_id already exists
        existing_user = db.query(SubscribedUser).filter(
            SubscribedUser.chat_id == user_data.chat_id
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"User with chat_id {user_data.chat_id} already exists"
            )

        # Generate random user_id
        user_id = str(uuid.uuid4())

        # Create new subscribed user
        new_user = SubscribedUser(
            user_id=user_id,
            chat_id=user_data.chat_id,
            chat_name=user_data.chat_name
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pending-messages", response_model=List[ScheduleMessageResponse])
async def get_pending_messages(from_sender: str = Query(..., alias="from_sender"), db: Session = Depends(get_db)):
    """
    Get all messages that are pending and match the 'from' sender property.
    """
    try:
        # We query the database for unsent messages matching the 'from' criteria
        pending_messages = db.query(ScheduledMessage).filter(
            ScheduledMessage.from_sender == from_sender  # Ensure this matches your model field name
        ).all()

        return pending_messages

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete-message", response_model=bool)
async def delete_scheduled_message(message_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        msg = (
            db.query(ScheduledMessage)
            .filter(ScheduledMessage.id == message_id)
            .first()
        )
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")

        db.delete(msg)
        db.commit()
        return True

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/subscribed-users", response_model=List[SubscribeUserResponse])
async def get_subscribed_users(db: Session = Depends(get_db)):
    """
    Get all subscribed users.
    """
    try:
        users = db.query(SubscribedUser).all()
        return users

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
"""
FastAPI application - REST API endpoints for scheduled message system.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
import shutil
from pathlib import Path

from database import get_db, init_db
from models import ScheduledMessage, SubscribedUser
from schemas import (
    ScheduleMessageRequest,
    ScheduleMessageResponse,
    SubscribeUserRequest,
    SubscribeUserResponse
)
from scheduler import start_message_scheduler

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="Scheduled Message API",
    description="API for scheduling messages with file attachments and Telegram delivery",
    version="1.0.0"
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount static files to serve uploaded files
app.mount("/files", StaticFiles(directory="uploads"), name="files")

# Base URL for file access
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks on startup"""
    init_db()
    start_message_scheduler(app)


@app.post("/schedule-message", response_model=ScheduleMessageResponse)
async def schedule_message(
        from_sender: str = Form(...),
        target_user_id: str = Form(...),
        message: str = Form(...),
        scheduled_timestamp: str = Form(...),
        files: Optional[List[UploadFile]] = File(None),
        db: Session = Depends(get_db)
):
    """
    Schedule a message to be sent at a specific time.
    - **from_sender**: sender IDs that sent message
    - **target_user_id**: Comma-separated list of user IDs
    - **message**: The message content
    - **scheduled_timestamp**: UTC timestamp (ISO 8601 format)
    - **files**: Optional list of files to attach
    """
    try:
        # Parse target_user_id (comma-separated string to list)
        target_users = [uid.strip() for uid in target_user_id.split(",")]

        # Parse scheduled timestamp
        scheduled_dt = datetime.fromisoformat(scheduled_timestamp.replace('Z', '+00:00'))

        # Generate unique ID for this scheduled message
        message_id = str(uuid.uuid4())

        # Handle file uploads
        file_paths = []
        if files:
            for file in files:
                if file.filename:
                    # Generate unique filename
                    file_extension = Path(file.filename).suffix
                    unique_filename = f"{message_id}_{uuid.uuid4()}{file_extension}"
                    file_path = UPLOAD_DIR / unique_filename

                    # Save file
                    with open(file_path, "wb") as buffer:
                        shutil.copyfileobj(file.file, buffer)

                    file_paths.append(str(file_path))

        # Create scheduled message record
        scheduled_msg = ScheduledMessage(
            id=message_id,
            from_sender=from_sender,
            target_user_id=target_users,
            message=message,
            scheduled_timestamp=scheduled_dt,
            file_paths=file_paths if file_paths else None,
            is_sent=False
        )

        db.add(scheduled_msg)
        db.commit()
        db.refresh(scheduled_msg)

        return scheduled_msg

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid timestamp format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/subscribe-user", response_model=SubscribeUserResponse)
async def subscribe_user(
        user_data: SubscribeUserRequest,
        db: Session = Depends(get_db)
):
    """
    Subscribe a new user and generate a unique user_id.

    - **chat_id**: Unique chat identifier
    - **chat_name**: Name of the chat/user
    """
    try:
        # Check if chat_id already exists
        existing_user = db.query(SubscribedUser).filter(
            SubscribedUser.chat_id == user_data.chat_id
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"User with chat_id {user_data.chat_id} already exists"
            )

        # Generate random user_id
        user_id = str(uuid.uuid4())

        # Create new subscribed user
        new_user = SubscribedUser(
            user_id=user_id,
            chat_id=user_data.chat_id,
            chat_name=user_data.chat_name
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pending-messages", response_model=List[ScheduleMessageResponse])
async def get_pending_messages(from_sender: str = Query(..., alias="from_sender"), db: Session = Depends(get_db)):
    """
    Get all messages that are pending and match the 'from' sender property.
    """
    try:
        # We query the database for unsent messages matching the 'from' criteria
        pending_messages = db.query(ScheduledMessage).filter(
            ScheduledMessage.from_sender == from_sender  # Ensure this matches your model field name
        ).all()

        return pending_messages

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete-message", response_model=bool)
async def delete_scheduled_message(message_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        msg = (
            db.query(ScheduledMessage)
            .filter(ScheduledMessage.id == message_id)
            .first()
        )
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")

        db.delete(msg)
        db.commit()
        return True

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/subscribed-users", response_model=List[SubscribeUserResponse])
async def get_subscribed_users(db: Session = Depends(get_db)):
    """
    Get all subscribed users.
    """
    try:
        users = db.query(SubscribedUser).all()
        return users

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
