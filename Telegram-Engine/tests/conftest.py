"""
Shared test fixtures for Telegram-Engine.

Uses an in-memory SQLite database and patches out the background scheduler
so tests do not start real asyncio tasks.
"""
import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Add the Telegram-Engine directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Provide safe defaults so import-time checks do not break tests.
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("API_BASE_URL", "http://localhost:8000")

from models import Base
from database import get_db

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient with the real DB replaced by an in-memory one.

    The background scheduler (start_message_scheduler) is patched so it does
    not launch real asyncio tasks during tests.
    """
    with patch("scheduler.start_message_scheduler", return_value=None):
        from api import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
