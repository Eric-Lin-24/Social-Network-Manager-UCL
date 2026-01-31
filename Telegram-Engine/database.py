from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base
import os

# Database configuration
# Use SQLite by default for easier setup (no PostgreSQL installation required)
# For PostgreSQL, set DATABASE_URL environment variable to your PostgreSQL connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./scheduled_messages.db"
)

# SQLite requires check_same_thread=False for FastAPI
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
