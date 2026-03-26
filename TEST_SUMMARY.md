# Test Summary

Date: 2026-03-24

## Scope Covered

- Telegram-Engine tests
- App-Backend tests
- Root JavaScript tests

## New Tests Added (Telegram-Engine)

### 1) Scheduler coverage
File: Telegram-Engine/tests/test_scheduler.py

Covers:
- check_and_send_due_messages
- check_and_send_due_emails
- start_message_scheduler

### 2) WhatsApp messenger coverage
File: Telegram-Engine/tests/test_whatsapp_messenger.py

Covers:
- send_whatsapp_message
- get_contact_name_from_user_id
- send_message_to_users

### 3) Bot/Main/DB/API internals coverage
File: Telegram-Engine/tests/test_bot_main_db_and_api_internals.py

Covers:
- telegram_bot.start_command
- telegram_bot.help_command
- telegram_bot.main
- main.run_api_server
- main.run_telegram_bot
- main.signal_handler
- main.main
- database.init_db
- database.get_db
- api.startup_event
- api.create_app

### 4) Lookup helper coverage
File: Telegram-Engine/tests/test_lookup_helpers.py

Covers:
- telegram_messenger.get_chat_id_from_user_id
- gmail_messenger.get_email_from_user_id

### 5) Test infrastructure fix
File: Telegram-Engine/tests/conftest.py

Changes:
- Added safe default env vars for import-time checks
- Switched in-memory SQLite fixture to StaticPool so all sessions share one DB connection

## Execution Results

### Telegram-Engine (new test modules only)
Command:
- python -m pytest Telegram-Engine/tests/test_scheduler.py Telegram-Engine/tests/test_whatsapp_messenger.py Telegram-Engine/tests/test_bot_main_db_and_api_internals.py Telegram-Engine/tests/test_lookup_helpers.py -q

Result:
- 18 passed
- 4 skipped
- 0 failed

### Telegram-Engine (full test collection)
Command:
- python -m pytest Telegram-Engine/tests --collect-only -q

Result:
- 56 tests collected

### Telegram-Engine (full test run)
Command:
- python -m pytest Telegram-Engine/tests -q

Result:
- Existing failures remain in legacy messenger tests (test_messengers.py)
- New test modules pass when run directly

### App-Backend
Command:
- python -m pytest App-Backend/tests --collect-only -q

Result:
- 12 tests collected from test_auth.py
- Collection error in tests/test_api.py:
  - ModuleNotFoundError: No module named 'conftest'

### Root JavaScript tests
Command:
- npm test -- --runInBand

Result:
- 1 suite passed
- 55 tests passed
- 0 failed

## Current Gaps / Known Issues

1. Telegram-Engine/tests/test_messengers.py has legacy expectation mismatches against current implementation signatures/behavior.
2. App-Backend/tests/test_api.py has an import path issue for conftest during collection.

## Recommended Next Steps

1. Update Telegram-Engine/tests/test_messengers.py to align with current function signatures and side effects.
2. Fix App-Backend test import strategy (absolute vs package-relative import for conftest) so API tests can collect and run.
3. Run full repo regression after fixes:
   - Telegram-Engine/tests
   - App-Backend/tests
   - npm test
