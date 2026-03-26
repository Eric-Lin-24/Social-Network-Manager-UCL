import asyncio
import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from models import ScheduledEmail, ScheduledMessage

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")

import scheduler


@pytest.mark.asyncio
async def test_check_and_send_due_messages_marks_message_sent(db_session, monkeypatch):
    due = ScheduledMessage(
        id="msg-1",
        from_sender="sender",
        target_user_id=["u1"],
        message="hello",
        scheduled_timestamp=datetime.utcnow() - timedelta(seconds=1),
        is_sent=False,
    )
    db_session.add(due)
    db_session.commit()

    send_mock = AsyncMock(return_value={"success": ["u1"], "failed": []})
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(scheduler, "send_message_to_users", send_mock)

    async def stop_after_one_cycle(_seconds):
        raise asyncio.CancelledError()

    monkeypatch.setattr(scheduler.asyncio, "sleep", stop_after_one_cycle)

    with pytest.raises(asyncio.CancelledError):
        await scheduler.check_and_send_due_messages()

    stored = db_session.query(ScheduledMessage).filter(ScheduledMessage.id == "msg-1").first()
    assert stored is not None
    assert stored.is_sent is True
    send_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_and_send_due_emails_marks_email_sent(db_session, monkeypatch):
    due = ScheduledEmail(
        id="email-1",
        from_sender="sender",
        target_user_id=["u1"],
        subject="subj",
        message="body",
        scheduled_timestamp=datetime.utcnow() - timedelta(seconds=1),
        is_sent=False,
    )
    db_session.add(due)
    db_session.commit()

    send_mock = AsyncMock(return_value={"success": ["u1"], "failed": []})
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(scheduler, "send_email_to_users", send_mock)

    async def stop_after_one_cycle(_seconds):
        raise asyncio.CancelledError()

    monkeypatch.setattr(scheduler.asyncio, "sleep", stop_after_one_cycle)

    with pytest.raises(asyncio.CancelledError):
        await scheduler.check_and_send_due_emails()

    stored = db_session.query(ScheduledEmail).filter(ScheduledEmail.id == "email-1").first()
    assert stored is not None
    assert stored.is_sent is True
    send_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_message_scheduler_registers_startup_and_creates_tasks(monkeypatch):
    class DummyApp:
        def __init__(self):
            self.startup_fn = None

        def on_event(self, event_name):
            assert event_name == "startup"

            def decorator(fn):
                self.startup_fn = fn
                return fn

            return decorator

    app = DummyApp()
    create_task_calls = []

    def fake_create_task(coro):
        create_task_calls.append(coro)

        class _DummyTask:
            pass

        return _DummyTask()

    monkeypatch.setattr(scheduler.asyncio, "create_task", fake_create_task)
    scheduler.start_message_scheduler(app)

    assert app.startup_fn is not None
    await app.startup_fn()

    assert len(create_task_calls) == 2

    for created in create_task_calls:
        created.close()
