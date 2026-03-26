from models import EmailSubscribedUser, SubscribedUser
from telegram_messenger import get_chat_id_from_user_id
from gmail_messenger import get_email_from_user_id


def test_get_chat_id_from_user_id_returns_chat_id(db_session):
    user = SubscribedUser(user_id="u-1", chat_id="chat-123", chat_name="Alice")
    db_session.add(user)
    db_session.commit()

    assert get_chat_id_from_user_id(db_session, "u-1") == "chat-123"


def test_get_chat_id_from_user_id_returns_none_for_missing(db_session):
    assert get_chat_id_from_user_id(db_session, "missing") is None


def test_get_email_from_user_id_returns_email(db_session):
    user = EmailSubscribedUser(user_id="e-1", email_address="alice@example.com", user_name="Alice")
    db_session.add(user)
    db_session.commit()

    assert get_email_from_user_id(db_session, "e-1") == "alice@example.com"


def test_get_email_from_user_id_returns_none_for_missing(db_session):
    assert get_email_from_user_id(db_session, "missing") is None
