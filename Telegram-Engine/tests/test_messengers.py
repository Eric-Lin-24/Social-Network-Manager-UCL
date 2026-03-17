"""
Unit tests for Telegram and Gmail messenger helper functions.

All external I/O (Telegram Bot API, SMTP) is mocked so these tests run
without network access or real credentials.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
import asyncio


# ============================================================
# telegram_messenger.py
# ============================================================

class TestSendTelegramMessage:
    """Tests for send_telegram_message(chat_id, message, file_paths=None)."""

    @pytest.mark.asyncio
    async def test_sends_text_message_and_returns_true(self):
        mock_bot = AsyncMock()
        mock_bot.send_message = AsyncMock(return_value=MagicMock())
        with patch("telegram_messenger.Bot", return_value=mock_bot):
            from telegram_messenger import send_telegram_message
            result = await send_telegram_message("12345", "Hello!")
        assert result is True
        mock_bot.send_message.assert_awaited_once_with(chat_id="12345", text="Hello!")

    @pytest.mark.asyncio
    async def test_sends_file_attachment(self, tmp_path):
        test_file = tmp_path / "doc.txt"
        test_file.write_text("content")
        mock_bot = AsyncMock()
        mock_bot.send_message = AsyncMock(return_value=MagicMock())
        mock_bot.send_document = AsyncMock(return_value=MagicMock())
        with patch("telegram_messenger.Bot", return_value=mock_bot):
            from telegram_messenger import send_telegram_message
            result = await send_telegram_message("12345", "With file", file_paths=[str(test_file)])
        assert result is True
        mock_bot.send_document.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_on_telegram_error(self):
        from telegram.error import TelegramError
        mock_bot = AsyncMock()
        mock_bot.send_message = AsyncMock(side_effect=TelegramError("Forbidden"))
        with patch("telegram_messenger.Bot", return_value=mock_bot):
            from telegram_messenger import send_telegram_message
            result = await send_telegram_message("bad_id", "Oops")
        assert result is False

    @pytest.mark.asyncio
    async def test_missing_file_is_skipped_gracefully(self):
        mock_bot = AsyncMock()
        mock_bot.send_message = AsyncMock(return_value=MagicMock())
        mock_bot.send_document = AsyncMock(return_value=MagicMock())
        with patch("telegram_messenger.Bot", return_value=mock_bot):
            from telegram_messenger import send_telegram_message
            # Pass a path that doesn't exist
            result = await send_telegram_message("12345", "msg", file_paths=["/nonexistent/file.pdf"])
        # Message should still send; file silently skipped
        assert result is True
        mock_bot.send_message.assert_awaited_once()
        mock_bot.send_document.assert_not_awaited()


class TestSendMessageToUsers:
    """Tests for send_message_to_users(target_user_ids, message, file_paths=None)."""

    @pytest.mark.asyncio
    async def test_success_for_valid_users(self, db_session):
        from models import SubscribedUser
        import uuid
        user = SubscribedUser(user_id=str(uuid.uuid4()), chat_id="99999", chat_name="Test")
        db_session.add(user)
        db_session.commit()

        with patch("telegram_messenger.send_telegram_message", new_callable=AsyncMock, return_value=True), \
             patch("telegram_messenger.Bot"):
            from telegram_messenger import send_message_to_users
            result = await send_message_to_users([user.user_id], "Hi", db=db_session)

        assert user.user_id in result["success"]
        assert result["failed"] == []

    @pytest.mark.asyncio
    async def test_unknown_user_goes_to_failed(self, db_session):
        with patch("telegram_messenger.Bot"):
            from telegram_messenger import send_message_to_users
            result = await send_message_to_users(["unknown-id"], "Hi", db=db_session)

        assert "unknown-id" in result["failed"]


# ============================================================
# gmail_messenger.py
# ============================================================

class TestSendEmailMessage:
    """Tests for send_email_message(to_email, subject, message, file_paths=None)."""

    def test_sends_email_and_returns_true(self):
        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)
        with patch("gmail_messenger.smtplib.SMTP", return_value=mock_smtp), \
             patch("gmail_messenger.GMAIL_ADDRESS", "sender@gmail.com"), \
             patch("gmail_messenger.GMAIL_APP_PASSWORD", "apppassword"):
            from gmail_messenger import send_email_message
            result = send_email_message("recipient@example.com", "Subject", "Body text")
        assert result is True
        mock_smtp.sendmail.assert_called_once()

    def test_returns_false_on_smtp_auth_error(self):
        import smtplib
        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)
        mock_smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Auth failed")
        with patch("gmail_messenger.smtplib.SMTP", return_value=mock_smtp), \
             patch("gmail_messenger.GMAIL_ADDRESS", "bad@gmail.com"), \
             patch("gmail_messenger.GMAIL_APP_PASSWORD", "wrong"):
            from gmail_messenger import send_email_message
            result = send_email_message("to@example.com", "Subj", "Body")
        assert result is False

    def test_sends_file_attachment(self, tmp_path):
        test_file = tmp_path / "report.txt"
        test_file.write_text("data")
        mock_smtp = MagicMock()
        mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp.__exit__ = MagicMock(return_value=False)
        with patch("gmail_messenger.smtplib.SMTP", return_value=mock_smtp), \
             patch("gmail_messenger.GMAIL_ADDRESS", "s@gmail.com"), \
             patch("gmail_messenger.GMAIL_APP_PASSWORD", "pw"):
            from gmail_messenger import send_email_message
            result = send_email_message(
                "r@example.com", "S", "B", file_paths=[str(test_file)]
            )
        assert result is True
        # The message passed to sendmail should be a multipart email with attachment
        args = mock_smtp.sendmail.call_args
        email_content = args[0][2] if args else ""
        assert "report.txt" in email_content


class TestSendEmailToUsers:
    """Tests for send_email_to_users(target_user_ids, subject, message)."""

    @pytest.mark.asyncio
    async def test_success_for_subscribed_email_user(self, db_session):
        from models import EmailSubscribedUser
        import uuid
        user = EmailSubscribedUser(
            user_id=str(uuid.uuid4()),
            email_address="member@example.com",
            user_name="Member",
        )
        db_session.add(user)
        db_session.commit()

        with patch("gmail_messenger.send_email_message", return_value=True):
            from gmail_messenger import send_email_to_users
            result = await send_email_to_users(
                [user.user_id], "Subj", "Body", db=db_session
            )

        assert user.user_id in result["success"]
        assert result["failed"] == []

    @pytest.mark.asyncio
    async def test_unknown_user_goes_to_failed(self, db_session):
        with patch("gmail_messenger.send_email_message", return_value=True):
            from gmail_messenger import send_email_to_users
            result = await send_email_to_users(["no-such-user"], "S", "B", db=db_session)
        assert "no-such-user" in result["failed"]
