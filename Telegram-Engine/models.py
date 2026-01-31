from sqlalchemy import Column, String, DateTime, Boolean, JSON, Integer
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ScheduledMessage(Base):
    __tablename__ = "scheduled_messages"

    id = Column(String, primary_key=True)
    from_sender = Column(String, nullable=False)
    target_user_id = Column(JSON, nullable=False)  # Store list as JSON for SQLite compatibility
    message = Column(String, nullable=False)
    scheduled_timestamp = Column(DateTime, nullable=False)
    file_paths = Column(JSON, nullable=True)  # Store list as JSON for SQLite compatibility
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SubscribedUser(Base):
    __tablename__ = "subscribed_users"

    user_id = Column(String, primary_key=True)
    chat_id = Column(String, nullable=False, unique=True)
    chat_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


