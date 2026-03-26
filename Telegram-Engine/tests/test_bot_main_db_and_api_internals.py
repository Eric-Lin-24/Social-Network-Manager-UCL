import importlib
import signal
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def telegram_bot_module(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("API_BASE_URL", "http://example.test")
    sys.modules.pop("telegram_bot", None)
    return importlib.import_module("telegram_bot")


@pytest.mark.asyncio
async def test_start_command_success_path(telegram_bot_module):
    update = MagicMock()
    update.effective_user.username = "alice"
    update.effective_user.first_name = "Alice"
    update.effective_chat.id = 123
    update.message.reply_text = AsyncMock()

    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"user_id": "uid-1"}

    with patch.object(telegram_bot_module.requests, "post", return_value=response):
        await telegram_bot_module.start_command(update, MagicMock())

    update.message.reply_text.assert_awaited_once()


@pytest.mark.asyncio
async def test_help_command_replies(telegram_bot_module):
    update = MagicMock()
    update.message.reply_text = AsyncMock()

    await telegram_bot_module.help_command(update, MagicMock())

    update.message.reply_text.assert_awaited_once()


def test_telegram_bot_main_registers_handlers_and_runs(telegram_bot_module):
    application = MagicMock()
    application.add_handler = MagicMock()
    application.run_polling = MagicMock()

    builder = MagicMock()
    builder.token.return_value.build.return_value = application

    with patch.object(telegram_bot_module.Application, "builder", return_value=builder), \
         patch.object(telegram_bot_module, "CommandHandler", side_effect=lambda *a, **k: (a, k)):
        telegram_bot_module.main()

    assert application.add_handler.call_count == 2
    application.run_polling.assert_called_once()


def test_run_api_server_calls_uvicorn_run():
    main_mod = importlib.import_module("main")

    fake_api = types.SimpleNamespace(app="fake-app")
    with patch.dict(sys.modules, {"api": fake_api}), \
         patch.object(main_mod.uvicorn, "run") as run_mock:
        main_mod.run_api_server()

    run_mock.assert_called_once()


def test_run_telegram_bot_calls_telegram_main():
    main_mod = importlib.import_module("main")

    fake_bot = types.SimpleNamespace(main=MagicMock())
    with patch.dict(sys.modules, {"telegram_bot": fake_bot}):
        main_mod.run_telegram_bot()

    fake_bot.main.assert_called_once()


def test_signal_handler_exits():
    main_mod = importlib.import_module("main")

    with pytest.raises(SystemExit) as exc:
        main_mod.signal_handler(signal.SIGINT, None)

    assert exc.value.code == 0


def test_main_starts_and_stops_processes(monkeypatch):
    main_mod = importlib.import_module("main")

    class FakeProcess:
        def __init__(self, target=None, name=None):
            self.target = target
            self.name = name
            self.started = False
            self.alive = False

        def start(self):
            self.started = True
            self.alive = True

        def is_alive(self):
            return self.alive

        def terminate(self):
            self.alive = False

        def join(self, timeout=None):
            _ = timeout

        def kill(self):
            self.alive = False

    sleep_calls = {"count": 0}

    def fake_sleep(_seconds):
        sleep_calls["count"] += 1
        if sleep_calls["count"] >= 3:
            raise KeyboardInterrupt()

    monkeypatch.setattr(main_mod.multiprocessing, "Process", FakeProcess)
    monkeypatch.setattr(main_mod.time, "sleep", fake_sleep)
    monkeypatch.setattr(main_mod.signal, "signal", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main_mod, "run_telegram", True)

    main_mod.main()


def test_init_db_calls_create_all():
    database_mod = importlib.import_module("database")

    with patch.object(database_mod.Base.metadata, "create_all") as create_all_mock:
        database_mod.init_db()

    create_all_mock.assert_called_once_with(bind=database_mod.engine)


def test_get_db_yields_and_closes_session():
    database_mod = importlib.import_module("database")
    fake_session = MagicMock()

    with patch.object(database_mod, "SessionLocal", return_value=fake_session):
        gen = database_mod.get_db()
        yielded = next(gen)
        assert yielded is fake_session
        with pytest.raises(StopIteration):
            next(gen)

    fake_session.close.assert_called_once()


@pytest.mark.asyncio
async def test_api_startup_event_initializes_db_and_scheduler(monkeypatch):
    api_mod = importlib.import_module("api")

    init_mock = MagicMock()
    scheduler_mock = MagicMock()
    monkeypatch.setattr(api_mod, "init_db", init_mock)
    monkeypatch.setattr(api_mod, "start_message_scheduler", scheduler_mock)

    await api_mod.startup_event()

    init_mock.assert_called_once()
    scheduler_mock.assert_called_once_with(api_mod.app)


def test_api_create_app_returns_app_instance():
    api_mod = importlib.import_module("api")
    assert api_mod.create_app() is api_mod.app
