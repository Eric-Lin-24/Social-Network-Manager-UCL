from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from models import Base, User
import os

# Database configuration
# Use SQLite by default for easier setup (no PostgreSQL installation required)
# For PostgreSQL, set DATABASE_URL environment variable to your PostgreSQL connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./accounts.db"
)

# SQLite requires check_same_thread=False for FastAPI
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def _migrate_db():
    """Run lightweight schema migrations for new columns on existing tables."""
    inspector = inspect(engine)

    # Add workspace_id to projects table if missing
    if "projects" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("projects")]
        if "workspace_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE projects ADD COLUMN workspace_id TEXT"))

    # Add email and phone to team_members table if missing
    if "team_members" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("team_members")]
        with engine.begin() as conn:
            if "email" not in cols:
                conn.execute(text("ALTER TABLE team_members ADD COLUMN email TEXT DEFAULT ''"))
            if "phone" not in cols:
                conn.execute(text("ALTER TABLE team_members ADD COLUMN phone TEXT DEFAULT ''"))

def init_db():
    """Initialize database tables and run migrations"""
    Base.metadata.create_all(bind=engine)
    _migrate_db()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()
    _migrate_db()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()
