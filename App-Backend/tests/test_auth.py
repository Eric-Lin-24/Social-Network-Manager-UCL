"""
Unit tests for App-Backend auth functions (auth.py).

These tests do not require a running server — they test the pure Python
functions directly against an in-memory database session.
"""
import pytest
from auth import verify_password, get_password_hash, create_user
from schemas import UserCreate


class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        hashed = get_password_hash("mysecret")
        assert verify_password("mysecret", hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = get_password_hash("mysecret")
        assert verify_password("wrongpassword", hashed) is False

    def test_empty_password_does_not_match_non_empty_hash(self):
        hashed = get_password_hash("notempty")
        assert verify_password("", hashed) is False

    def test_case_sensitive(self):
        hashed = get_password_hash("Password")
        assert verify_password("password", hashed) is False


class TestGetPasswordHash:
    def test_returns_string(self):
        result = get_password_hash("anypassword")
        assert isinstance(result, str)

    def test_different_calls_produce_different_hashes(self):
        # bcrypt salts are random — same input should yield different hashes
        h1 = get_password_hash("samepassword")
        h2 = get_password_hash("samepassword")
        assert h1 != h2

    def test_hash_is_verifiable(self):
        password = "roundtrip_test"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_hash_starts_with_bcrypt_prefix(self):
        hashed = get_password_hash("test")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")


class TestCreateUser:
    def test_creates_user_with_correct_username(self, db_session):
        user_data = UserCreate(username="alice", password="pass123")
        user = create_user(db_session, user_data)
        assert user.username == "alice"

    def test_creates_user_with_uuid(self, db_session):
        user_data = UserCreate(username="bob", password="pass123")
        user = create_user(db_session, user_data)
        assert user.uuid is not None
        assert len(user.uuid) > 0

    def test_password_is_hashed_not_plaintext(self, db_session):
        user_data = UserCreate(username="carol", password="plaintext")
        user = create_user(db_session, user_data)
        assert user.hashed_password != "plaintext"
        assert verify_password("plaintext", user.hashed_password) is True

    def test_created_user_is_persisted(self, db_session):
        from models import User
        user_data = UserCreate(username="dave", password="pass")
        create_user(db_session, user_data)
        found = db_session.query(User).filter(User.username == "dave").first()
        assert found is not None
