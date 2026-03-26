import importlib
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def whatsapp_module():
    pytest.importorskip("selenium")
    pytest.importorskip("webdriver_manager")

    side_panel = MagicMock()
    search_bar = MagicMock()
    side_panel.find_element.return_value = search_bar

    main_panel = MagicMock()
    message_bar = MagicMock()
    main_panel.find_element.return_value = message_bar

    wait_instance = MagicMock()
    wait_instance.until.side_effect = [side_panel, main_panel]

    fake_driver = MagicMock()

    with patch("selenium.webdriver.Chrome", return_value=fake_driver), \
         patch("webdriver_manager.chrome.ChromeDriverManager.install", return_value="chromedriver"), \
         patch("selenium.webdriver.support.ui.WebDriverWait", return_value=wait_instance):
        sys.modules.pop("whatsapp_messenger", None)
        module = importlib.import_module("whatsapp_messenger")

    return module


def test_send_whatsapp_message_returns_true(whatsapp_module):
    result = whatsapp_module.send_whatsapp_message("Alice", "Hello there")
    assert result is True


def test_get_contact_name_from_user_id_returns_email(db_session, whatsapp_module):
    from models import EmailSubscribedUser

    user = EmailSubscribedUser(user_id="u1", email_address="alice@example.com", user_name="Alice")
    db_session.add(user)
    db_session.commit()

    assert whatsapp_module.get_contact_name_from_user_id(db_session, "u1") == "alice@example.com"


def test_get_contact_name_from_user_id_returns_none_for_missing(db_session, whatsapp_module):
    assert whatsapp_module.get_contact_name_from_user_id(db_session, "missing") is None


@pytest.mark.asyncio
async def test_send_message_to_users_success_and_failed(monkeypatch, whatsapp_module):
    fake_db = MagicMock()
    fake_db.close = MagicMock()
    monkeypatch.setattr(whatsapp_module, "SessionLocal", lambda: fake_db)

    monkeypatch.setattr(
        whatsapp_module,
        "get_contact_name_from_user_id",
        lambda _db, uid: "Alice" if uid == "u1" else None,
    )
    monkeypatch.setattr(whatsapp_module, "send_whatsapp_message", lambda *_args, **_kwargs: True)

    result = await whatsapp_module.send_message_to_users(["u1", "u2"], "hello")

    assert result["success"] == ["u1"]
    assert result["failed"] == ["u2"]
    fake_db.close.assert_called_once()
