"""
Shared test fixtures for App-Backend.

Uses an in-memory SQLite database so tests are isolated and fast.
The get_db dependency is overridden for every test.
"""
import builtins
import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware

# Make CORSMiddleware available as a builtin so that the api module (which
# references it without a proper import) can resolve it at import time.
builtins.CORSMiddleware = CORSMiddleware

# Add the App-Backend directory to sys.path so imports work.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import Base
from database import get_db
from api import app

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        TEST_DATABASE_URL, connect_args={"check_same_thread": False}
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
    """TestClient with the real database swapped for an in-memory one."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Convenience helpers used across multiple test modules
# ---------------------------------------------------------------------------

USER_UUID = "test-user-uuid-1234"


def register_and_get_uuid(client) -> str:
    """Register a test user and return the user uuid."""
    resp = client.post("/register", json={"username": "testuser", "password": "password123"})
    assert resp.status_code == 201
    return resp.json()["uuid"]
