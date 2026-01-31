# Scheduled Message System - Complete Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Design](#architecture-design)
3. [Component Details](#component-details)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Data Flow](#data-flow)
7. [File Structure](#file-structure)
8. [Configuration](#configuration)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

### What Does This System Do?

The Scheduled Message System is a comprehensive solution for scheduling and delivering messages through Telegram at specified times. It consists of three main components working together:

1. **FastAPI REST API** - Handles message scheduling, user subscriptions, and file uploads
2. **Telegram Bot** - Allows users to subscribe and provides a delivery channel for scheduled messages
3. **Background Scheduler** - Monitors scheduled messages and triggers delivery at the right time

### Key Features

- ✅ Schedule messages to be sent at specific future times
- ✅ Support for multiple recipients per message
- ✅ File attachment support (documents, images, etc.)
- ✅ User subscription system with auto-generated unique IDs
- ✅ Telegram integration for message delivery
- ✅ Automatic message sending via background scheduler
- ✅ RESTful API with comprehensive validation
- ✅ SQLite database (production-ready for PostgreSQL)
- ✅ Persistent file storage
- ✅ Detailed logging and error handling

### Use Cases

- **Reminder Systems** - Send reminders to users at specific times
- **Notification Services** - Schedule notifications for events
- **Content Distribution** - Deliver content to subscribers on schedule
- **Automated Messaging** - Send periodic updates or reports
- **Marketing Campaigns** - Schedule promotional messages

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interactions                        │
├─────────────────────────┬───────────────────────────────────────┤
│  Telegram Users         │  API Clients (curl, Postman, etc.)   │
│  - Send /start          │  - Schedule messages                  │
│  - Receive messages     │  - Query data                         │
└───────────┬─────────────┴──────────────┬────────────────────────┘
            │                            │
            ▼                            ▼
┌───────────────────────┐    ┌──────────────────────────┐
│   Telegram Bot API    │    │   FastAPI Application    │
│   (telegram_bot.py)   │◄───┤      (api.py)           │
│                       │    │                          │
│ - Polls for updates   │    │ - REST API endpoints     │
│ - Handles /start cmd  │    │ - File upload handling   │
│ - Subscribes users    │    │ - Data validation        │
└───────────┬───────────┘    └────────┬─────────────────┘
            │                         │
            │ HTTP POST               │ DB queries
            │ /subscribe-user         │
            │                         │
            └─────────►┌──────────────▼──────────────┐
                       │   Database (SQLite/PG)      │
                       │   (scheduled_messages.db)   │
                       │                             │
                       │ Tables:                     │
                       │ - scheduled_messages        │
                       │ - subscribed_users          │
                       └──────────────┬──────────────┘
                                      ▲
                                      │
                       ┌──────────────▼──────────────┐
                       │  Background Scheduler       │
                       │  (scheduler.py)             │
                       │                             │
                       │ - Checks every 5s           │
                       │ - Finds due messages        │
                       │ - Triggers sending          │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │   Telegram Messenger        │
                       │   (telegram_messenger.py)   │
                       │                             │
                       │ - Looks up chat_id          │
                       │ - Sends message via Bot API │
                       │ - Sends file attachments    │
                       └─────────────────────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │   Telegram Bot API          │
                       │   (External Service)        │
                       │                             │
                       │ - Delivers to user's chat   │
                       └─────────────────────────────┘
```

### Component Communication

1. **User Subscription Flow**
   ```
   User → Telegram Bot → FastAPI (/subscribe-user) → Database
   ```

2. **Message Scheduling Flow**
   ```
   API Client → FastAPI (/schedule-message) → Database + File Storage
   ```

3. **Message Delivery Flow**
   ```
   Background Scheduler → Database (query) → Telegram Sender → Database (lookup chat_id) → Telegram Bot API → User
   ```

---

## Component Details

### 1. FastAPI Application (`api.py`)

**Purpose**: Core REST API server that handles all HTTP requests and coordinates system operations.

**Responsibilities**:
- Define and serve REST API endpoints
- Validate incoming requests using Pydantic schemas
- Handle file uploads and storage
- Manage database sessions
- Initialize background tasks on startup
- Serve static files (uploaded attachments)

**Key Functions**:

#### `startup_event()`
- Runs when the application starts
- Initializes database tables if they don't exist
- Starts the background message scheduler

#### `schedule_message()`
- **Endpoint**: `POST /schedule-message`
- **Purpose**: Create a scheduled message
- **Process**:
  1. Parse and validate form data (target_user_id, message, scheduled_timestamp)
  2. Parse comma-separated target_user_id into a list
  3. Validate and parse ISO 8601 timestamp
  4. Generate unique message ID (UUID)
  5. Handle file uploads:
     - Generate unique filename for each file
     - Save file to `uploads/` directory
     - Store local file path in database
  6. Create ScheduledMessage database record
  7. Commit to database
  8. Return created message object

#### `subscribe_user()`
- **Endpoint**: `POST /subscribe-user`
- **Purpose**: Register a new user and generate unique user_id
- **Process**:
  1. Receive chat_id and chat_name from request
  2. Check if chat_id already exists in database
  3. Generate random UUID for user_id
  4. Create SubscribedUser database record
  5. Commit to database
  6. Return user object with user_id

#### `get_pending_messages()`
- **Endpoint**: `GET /pending-messages`
- **Purpose**: Query all messages that haven't been sent yet
- **Process**:
  1. Query ScheduledMessage table where is_sent == False
  2. Return list of messages

#### `get_subscribed_users()`
- **Endpoint**: `GET /subscribed-users`
- **Purpose**: Query all registered users
- **Process**:
  1. Query all records from SubscribedUser table
  2. Return list of users

**Dependencies**:
- `database.py` - Database connection and session management
- `models.py` - SQLAlchemy ORM models
- `schemas.py` - Pydantic validation schemas
- `scheduler.py` - Background scheduler initialization

---

### 2. Telegram Bot (`telegram_bot.py`)

**Purpose**: Telegram bot interface for user subscriptions.

**Responsibilities**:
- Poll Telegram API for incoming messages
- Handle bot commands (/start, /help)
- Subscribe users by calling the FastAPI endpoint
- Provide user feedback and confirmation

**Key Functions**:

#### `start_command()`
- **Trigger**: User sends `/start` to the bot
- **Process**:
  1. Extract user information from Telegram update:
     - chat_id (Telegram's unique chat identifier)
     - username or first_name (display name)
  2. Make HTTP POST request to FastAPI `/subscribe-user` endpoint
  3. Handle response scenarios:
     - **200 OK**: User successfully subscribed
       - Display welcome message with user_id and chat_id
       - Log successful subscription
     - **400 Bad Request**: User already exists
       - Display "welcome back" message
       - Inform user they're already subscribed
     - **Other errors**: Display error message
  4. Handle connection errors and timeouts gracefully

#### `help_command()`
- **Trigger**: User sends `/help` to the bot
- **Process**:
  1. Display list of available commands
  2. Explain how to use the bot

#### `main()`
- **Process**:
  1. Create Telegram Application with bot token
  2. Register command handlers
  3. Start polling loop (runs continuously)
  4. Listen for incoming updates

**Configuration**:
- `TELEGRAM_BOT_TOKEN` - Bot authentication token from BotFather
- `API_BASE_URL` - URL of the FastAPI server

---

### 3. Background Scheduler (`scheduler.py`)

**Purpose**: Continuously monitor database for due messages and trigger delivery.

**Responsibilities**:
- Run as an async background task
- Check for due messages every 5 seconds
- Trigger message sending via Telegram
- Update database after sending
- Handle errors and log operations

**Key Functions**:

#### `check_and_send_due_messages()`
- **Type**: Async infinite loop
- **Process**:
  1. **Every 5 seconds**:
     ```python
     await asyncio.sleep(5)
     ```
  2. Query database for due messages:
     ```sql
     SELECT * FROM scheduled_messages
     WHERE scheduled_timestamp <= NOW()
     AND is_sent = False
     ```
  3. For each due message:
     - Log message details (ID, recipients, scheduled time)
     - Call `send_message_to_users()` from telegram_sender
     - Log delivery results (success/failure per recipient)
     - Mark message as sent: `is_sent = True`
     - Commit database transaction
  4. Handle exceptions:
     - Log errors
     - Rollback database on failure
     - Continue with next message

#### `start_message_scheduler()`
- **Called**: On FastAPI startup
- **Process**:
  1. Register as a startup event handler
  2. Create async task for `check_and_send_due_messages()`
  3. Log scheduler initialization

**Behavior**:
- Runs continuously in the background
- Non-blocking (doesn't interfere with API requests)
- Resilient to errors (continues even if one message fails)
- Messages marked as sent won't be resent (idempotent)

---

### 4. Telegram Messenger (`telegram_messenger.py`)

**Purpose**: Handle actual message delivery through Telegram Bot API.

**Responsibilities**:
- Look up chat_id from user_id
- Send text messages via Telegram
- Send file attachments via Telegram
- Handle Telegram API errors
- Log delivery status

**Key Functions**:

#### `send_telegram_message()`
- **Parameters**:
  - `chat_id`: Telegram chat identifier
  - `message`: Text content to send
  - `file_paths`: Optional list of local file paths
- **Process**:
  1. Initialize Telegram Bot instance with token
  2. Send text message:
     ```python
     await bot.send_message(chat_id=chat_id, text=message)
     ```
  3. For each file attachment:
     - Check if file path exists
     - Open file in binary mode
     - Send as document:
       ```python
       await bot.send_document(chat_id=chat_id, document=file, filename=name)
       ```
     - Log success or error for each file
  4. Return True if successful, False otherwise
  5. Catch and log TelegramError exceptions

#### `get_chat_id_from_user_id()`
- **Parameters**:
  - `db`: Database session
  - `user_id`: UUID string from scheduled message
- **Process**:
  1. Query subscribed_users table:
     ```sql
     SELECT chat_id FROM subscribed_users
     WHERE user_id = ?
     ```
  2. Return chat_id if found, None otherwise
  3. Log warning if user not found

#### `send_message_to_users()`
- **Parameters**:
  - `target_user_ids`: List of user_id strings
  - `message`: Text content
  - `file_paths`: Optional file paths
- **Process**:
  1. Open database session
  2. Initialize results tracking:
     ```python
     results = {"success": [], "failed": []}
     ```
  3. For each user_id:
     - Look up chat_id using `get_chat_id_from_user_id()`
     - If found:
       - Call `send_telegram_message()`
       - Add to success or failed list based on result
     - If not found:
       - Add to failed list
       - Log error
  4. Close database session
  5. Return results dictionary

#### `send_message_sync()`
- **Purpose**: Synchronous wrapper for use in non-async contexts
- **Process**:
  ```python
  return asyncio.run(send_message_to_users(...))
  ```

---

### 5. Database Module (`database.py`)

**Purpose**: Manage database connections and sessions.

**Key Components**:

#### Database Engine
```python
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```
- Creates SQLAlchemy engine
- `check_same_thread=False` needed for SQLite with FastAPI
- Supports both SQLite and PostgreSQL

#### Session Factory
```python
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```
- Creates database session instances
- `autocommit=False` - Manual transaction control
- `autoflush=False` - Explicit flush required

#### `init_db()`
- Creates all database tables
- Called on application startup
- Uses SQLAlchemy's `Base.metadata.create_all()`

#### `get_db()`
- FastAPI dependency injection function
- Creates session for each request
- Automatically closes session after request completes
- Usage:
  ```python
  @app.get("/endpoint")
  def endpoint(db: Session = Depends(get_db)):
      # db is available here
      pass
  # db automatically closed here
  ```

---

### 6. Database Models (`models.py`)

**Purpose**: Define database schema using SQLAlchemy ORM.

#### `ScheduledMessage` Model

**Table**: `scheduled_messages`

**Columns**:
- `id` (String, Primary Key)
  - UUID string
  - Uniquely identifies each scheduled message

- `target_user_id` (JSON)
  - List of user_id strings
  - Stored as JSON array for SQLite compatibility
  - Example: `["user-123", "user-456"]`

- `message` (String, NOT NULL)
  - The message text content
  - Can be any length

- `scheduled_timestamp` (DateTime, NOT NULL)
  - UTC timestamp when message should be sent
  - ISO 8601 format

- `file_paths` (JSON, NULLABLE)
  - List of local file paths
  - Stored as JSON array
  - Example: `["uploads/file1.pdf", "uploads/file2.jpg"]`
  - NULL if no attachments

- `is_sent` (Boolean, DEFAULT False)
  - Tracks whether message has been delivered
  - Used to prevent duplicate sends

- `created_at` (DateTime, DEFAULT utcnow)
  - Timestamp when message was scheduled

**Example Record**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_user_id": ["user-abc-123", "user-def-456"],
  "message": "Hello! This is a scheduled message.",
  "scheduled_timestamp": "2025-12-05T10:30:00",
  "file_paths": ["uploads/550e8400_doc.pdf"],
  "is_sent": false,
  "created_at": "2025-12-04T15:20:00"
}
```

#### `SubscribedUser` Model

**Table**: `subscribed_users`

**Columns**:
- `user_id` (String, Primary Key)
  - UUID string
  - Randomly generated unique identifier
  - Shared with users for scheduling messages

- `chat_id` (String, NOT NULL, UNIQUE)
  - Telegram chat identifier
  - Unique per user
  - Used to deliver messages

- `chat_name` (String, NOT NULL)
  - Display name of the user
  - Can be username, first_name, or generated

- `created_at` (DateTime, DEFAULT utcnow)
  - Timestamp when user subscribed

**Example Record**:
```json
{
  "user_id": "660e9511-f39c-52e5-b827-557766551111",
  "chat_id": "123456789",
  "chat_name": "JohnDoe",
  "created_at": "2025-12-04T12:00:00"
}
```

**Relationships**:
- No explicit foreign key relationships
- Linked conceptually: `ScheduledMessage.target_user_id` → `SubscribedUser.user_id`
- Lookups performed in application code

---

### 7. Validation Schemas (`schemas.py`)

**Purpose**: Define Pydantic models for request/response validation.

**Key Schemas**:

#### `ScheduleMessageRequest`
- Validates incoming schedule message requests
- Not directly used (FastAPI Form data instead)

#### `ScheduleMessageResponse`
- Defines response structure for scheduled messages
- Includes all ScheduledMessage fields
- Ensures consistent API responses

#### `SubscribeUserRequest`
- Validates subscribe user POST requests
- Fields: chat_id, chat_name

#### `SubscribeUserResponse`
- Defines response structure for user subscriptions
- Includes user_id, chat_id, chat_name, created_at

---

### 8. Launcher Script (`main.py`)

**Purpose**: Run both FastAPI and Telegram bot concurrently in separate processes.

**Key Components**:

#### `run_fastapi()`
- Imports FastAPI app
- Starts uvicorn server on port 8000
- Runs in separate process

#### `run_telegram_bot()`
- Imports and calls telegram bot's main()
- Starts bot polling
- Runs in separate process

#### `signal_handler()`
- Handles Ctrl+C gracefully
- Ensures clean shutdown

#### Main Process
- Creates two multiprocessing.Process instances
- Starts both processes
- Monitors process health
- Auto-restarts crashed processes
- Handles cleanup on shutdown:
  - Terminates both processes
  - Waits up to 5 seconds
  - Force kills if necessary

**Benefits**:
- Single command to start entire system
- Automatic process monitoring
- Graceful shutdown
- Process isolation

---

## Database Schema

### Entity-Relationship Diagram

```
┌─────────────────────────────────┐
│     subscribed_users            │
├─────────────────────────────────┤
│ PK  user_id         VARCHAR     │◄───┐
│ UQ  chat_id         VARCHAR     │    │ Lookup relationship
│     chat_name       VARCHAR     │    │ (no FK constraint)
│     created_at      DATETIME    │    │
└─────────────────────────────────┘    │
                                       │
┌─────────────────────────────────┐    │
│    scheduled_messages           │    │
├─────────────────────────────────┤    │
│ PK  id                VARCHAR   │    │
│     target_user_id    JSON      │────┘
│     message           TEXT      │
│     scheduled_timestamp DATETIME│
│     file_paths        JSON      │
│     is_sent           BOOLEAN   │
│     created_at        DATETIME  │
└─────────────────────────────────┘
```

### Indexes

**Recommended for Production**:
```sql
-- Speed up scheduled message queries
CREATE INDEX idx_scheduled_messages_is_sent
ON scheduled_messages(is_sent);

CREATE INDEX idx_scheduled_messages_timestamp
ON scheduled_messages(scheduled_timestamp);

-- Speed up user lookups
CREATE INDEX idx_subscribed_users_chat_id
ON subscribed_users(chat_id);
```

---

## API Endpoints

### 1. POST `/schedule-message`

**Purpose**: Schedule a new message to be sent at a specific time.

**Request Format**: `multipart/form-data`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target_user_id | string | Yes | Comma-separated list of user IDs |
| message | string | Yes | Message text content |
| scheduled_timestamp | string | Yes | ISO 8601 UTC timestamp |
| files | file[] | No | File attachments (multiple allowed) |

**Example Request**:
```bash
curl -X POST "http://localhost:8000/schedule-message" \
  -F "target_user_id=user-123,user-456" \
  -F "message=Hello from the scheduler!" \
  -F "scheduled_timestamp=2025-12-05T10:30:00Z" \
  -F "files=@document.pdf" \
  -F "files=@image.jpg"
```

**Success Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_user_id": ["user-123", "user-456"],
  "message": "Hello from the scheduler!",
  "scheduled_timestamp": "2025-12-05T10:30:00",
  "file_paths": [
    "uploads/550e8400_abc123_document.pdf",
    "uploads/550e8400_def456_image.jpg"
  ],
  "is_sent": false,
  "created_at": "2025-12-04T18:45:23"
}
```

**Error Responses**:
- 400: Invalid timestamp format
- 500: Database error or file upload failure

---

### 2. POST `/subscribe-user`

**Purpose**: Register a new user and generate a unique user_id.

**Request Format**: `application/json`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chat_id | string | Yes | Unique chat identifier (e.g., Telegram chat ID) |
| chat_name | string | Yes | Display name for the user |

**Example Request**:
```bash
curl -X POST "http://localhost:8000/subscribe-user" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "123456789",
    "chat_name": "JohnDoe"
  }'
```

**Success Response** (200):
```json
{
  "user_id": "660e9511-f39c-52e5-b827-557766551111",
  "chat_id": "123456789",
  "chat_name": "JohnDoe",
  "created_at": "2025-12-04T18:50:00"
}
```

**Error Responses**:
- 400: User with this chat_id already exists
- 500: Database error

---

### 3. GET `/pending-messages`

**Purpose**: Retrieve all messages that haven't been sent yet.

**Request Format**: No parameters

**Example Request**:
```bash
curl -X GET "http://localhost:8000/pending-messages"
```

**Success Response** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "target_user_id": ["user-123"],
    "message": "Pending message 1",
    "scheduled_timestamp": "2025-12-05T10:30:00",
    "file_paths": null,
    "is_sent": false,
    "created_at": "2025-12-04T18:45:23"
  },
  {
    "id": "770e9511-f39c-52e5-b827-557766551222",
    "target_user_id": ["user-456", "user-789"],
    "message": "Pending message 2",
    "scheduled_timestamp": "2025-12-06T14:00:00",
    "file_paths": ["uploads/file.pdf"],
    "is_sent": false,
    "created_at": "2025-12-04T19:00:00"
  }
]
```

**Error Responses**:
- 500: Database error

---

### 4. GET `/subscribed-users`

**Purpose**: Retrieve all registered users.

**Request Format**: No parameters

**Example Request**:
```bash
curl -X GET "http://localhost:8000/subscribed-users"
```

**Success Response** (200):
```json
[
  {
    "user_id": "660e9511-f39c-52e5-b827-557766551111",
    "chat_id": "123456789",
    "chat_name": "JohnDoe",
    "created_at": "2025-12-04T18:50:00"
  },
  {
    "user_id": "880f0622-g40d-63f6-c938-668877662222",
    "chat_id": "987654321",
    "chat_name": "JaneSmith",
    "created_at": "2025-12-04T19:15:00"
  }
]
```

**Error Responses**:
- 500: Database error

---

### 5. GET `/`

**Purpose**: API information and available endpoints.

**Example Response**:
```json
{
  "message": "Scheduled Message API",
  "endpoints": {
    "POST /schedule-message": "Schedule a new message",
    "POST /subscribe-user": "Subscribe a new user",
    "GET /pending-messages": "Get all pending messages",
    "GET /subscribed-users": "Get all subscribed users"
  }
}
```

---

## Data Flow

### Complete Message Lifecycle

#### Phase 1: User Subscription
```
1. User opens Telegram
2. Searches for bot by username
3. Clicks "Start" or sends /start command
   ↓
4. Telegram sends update to Bot
   ↓
5. telegram_bot.py receives update
6. Extracts chat_id and username
   ↓
7. HTTP POST to FastAPI /subscribe-user
   Data: {chat_id, chat_name}
   ↓
8. FastAPI validates request
9. Generates UUID for user_id
10. Checks if chat_id already exists
    ↓
11. Saves to database:
    INSERT INTO subscribed_users
    VALUES (user_id, chat_id, chat_name, now())
    ↓
12. Returns user_id to bot
    ↓
13. Bot sends welcome message to user
    Message includes user_id for reference
    ↓
14. User saves their user_id
```

#### Phase 2: Message Scheduling
```
1. API client (curl, app, etc.) prepares request
2. Includes: target_user_id, message, timestamp, files
   ↓
3. HTTP POST to FastAPI /schedule-message
   ↓
4. FastAPI receives multipart/form-data
5. Parses form fields
6. Validates timestamp format
   ↓
7. Processes files:
   - Generates unique filename
   - Saves to uploads/ directory
   - Stores file path
   ↓
8. Generates message UUID
9. Creates ScheduledMessage object
   ↓
10. Saves to database:
    INSERT INTO scheduled_messages
    VALUES (id, target_user_id, message,
            scheduled_timestamp, file_paths,
            false, now())
    ↓
11. Returns created message object
    ↓
12. Message now in database, waiting for scheduled time
```

#### Phase 3: Message Delivery
```
Background Scheduler (running continuously):

1. Sleep for 30 seconds
   ↓
2. Wake up and query database:
   SELECT * FROM scheduled_messages
   WHERE scheduled_timestamp <= NOW()
   AND is_sent = false
   ↓
3. For each due message:
   ↓
4. Extract target_user_ids list
   Example: ["user-123", "user-456"]
   ↓
5. For each user_id:
   ↓
6. Look up chat_id:
   SELECT chat_id FROM subscribed_users
   WHERE user_id = ?
   ↓
7. If user found:
   ↓
8. Send text message:
   Telegram Bot API: sendMessage
   Parameters: {chat_id, text}
   ↓
9. If files exist:
   ↓
10. For each file:
    - Open file from local path
    - Telegram Bot API: sendDocument
    - Parameters: {chat_id, document, filename}
   ↓
11. Log delivery result
    ↓
12. After all recipients processed:
    UPDATE scheduled_messages
    SET is_sent = true
    WHERE id = ?
    ↓
13. Commit database transaction
    ↓
14. User receives message in Telegram!
    ↓
15. Repeat from step 1
```

---

## File Structure

```
SNM-Demo/
│
├── main.py                      # Main entry point - starts all services
│   ├── run_api_server()
│   ├── run_telegram_bot()
│   ├── signal_handler()
│   └── Process management logic
│
├── api.py                       # FastAPI application (Core API)
│   ├── FastAPI instance creation
│   ├── Static file mounting (/files)
│   ├── Startup event handlers
│   ├── POST /schedule-message endpoint
│   ├── POST /subscribe-user endpoint
│   ├── GET /pending-messages endpoint
│   ├── GET /subscribed-users endpoint
│   └── GET / root endpoint
│
├── telegram_bot.py              # Telegram bot interface
│   ├── Bot token configuration
│   ├── /start command handler
│   ├── /help command handler
│   └── Main polling loop
│
├── telegram_messenger.py        # Message delivery logic
│   ├── send_telegram_message()
│   ├── get_chat_id_from_user_id()
│   ├── send_message_to_users()
│   └── send_message_sync()
│
├── scheduler.py                 # Scheduler task
│   ├── check_and_send_due_messages()
│   └── start_message_scheduler()
│
├── database.py                  # Database configuration
│   ├── Engine creation
│   ├── SessionLocal factory
│   ├── init_db()
│   └── get_db() dependency
│
├── models.py                    # SQLAlchemy ORM models
│   ├── Base declarative class
│   ├── ScheduledMessage model
│   └── SubscribedUser model
│
├── schemas.py                   # Pydantic validation schemas
│   ├── ScheduleMessageRequest
│   ├── ScheduleMessageResponse
│   ├── SubscribeUserRequest
│   └── SubscribeUserResponse
│
├── requirements.txt             # Python dependencies
│   ├── fastapi
│   ├── uvicorn[standard]
│   ├── sqlalchemy
│   ├── python-telegram-bot
│   ├── requests
│   ├── python-dotenv
│   └── Others...
│
├── .env                         # Environment variables (create this)
│   ├── TELEGRAM_BOT_TOKEN
│   ├── API_BASE_URL
│   ├── DATABASE_URL (optional)
│   └── BASE_URL (optional)
│
├── README.md                    # User-facing documentation
├── ARCHITECTURE.md              # This file
│
├── scheduled_messages.db        # SQLite database (auto-created)
│
└── uploads/                     # File storage directory (auto-created)
    ├── {message-id}_{file-id}_filename.ext
    └── ...
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Telegram Bot Token from @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# FastAPI Base URL (for file access)
BASE_URL=http://localhost:8000

# Telegram bot's API base URL
API_BASE_URL=http://localhost:8000

# Database URL (optional, defaults to SQLite)
# For SQLite (default):
DATABASE_URL=sqlite:///./scheduled_messages.db

# For PostgreSQL:
# DATABASE_URL=postgresql://username:password@localhost:5432/dbname
```

### Application Configuration

**FastAPI Settings** (`main.py`):
```python
# Port configuration
PORT = 8000

# Upload directory
UPLOAD_DIR = Path("uploads")

# File serving endpoint
app.mount("/files", StaticFiles(directory="uploads"), name="files")
```

**Background Scheduler Settings** (`scheduler.py`):
```python
# Check interval (seconds)
CHECK_INTERVAL = 5

# In check_and_send_due_messages():
await asyncio.sleep(CHECK_INTERVAL)
```

**Logging Configuration**:
```python
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO  # Change to DEBUG for verbose output
)
```

---

## Deployment Guide

### Local Development

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your bot token
   ```

3. **Run Application**:
   ```bash
   python main.py
   ```

### Production Deployment

#### Option 1: Single Server with Systemd

**Create systemd service** (`/etc/systemd/system/scheduled-messages.service`):
```ini
[Unit]
Description=Scheduled Message System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/scheduled-messages
Environment="PATH=/opt/scheduled-messages/venv/bin"
ExecStart=/opt/scheduled-messages/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable and start**:
```bash
sudo systemctl enable scheduled-messages
sudo systemctl start scheduled-messages
```

#### Option 2: Docker Deployment

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - DATABASE_URL=postgresql://postgres:password@db:5432/scheduled_messages
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=scheduled_messages
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Deploy**:
```bash
docker-compose up -d
```

#### Option 3: Separate Services

Run components separately with process manager (PM2, Supervisor):

**FastAPI**:
```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --workers 4
```

**Telegram Bot**:
```bash
python telegram_bot.py
```

### Production Checklist

- [ ] Use PostgreSQL instead of SQLite
- [ ] Set up reverse proxy (Nginx/Caddy)
- [ ] Enable HTTPS with SSL certificate
- [ ] Configure firewall (allow only 80/443)
- [ ] Set up log rotation
- [ ] Configure backup for database and uploads/
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure rate limiting
- [ ] Set up alerting for failures
- [ ] Use environment-specific configurations
- [ ] Secure API with authentication
- [ ] Use Telegram webhooks instead of polling

---

## Troubleshooting

### Common Issues

#### 1. Bot Token Error
**Error**: `ValueError: TELEGRAM_BOT_TOKEN environment variable is not set!`

**Solution**:
- Create `.env` file in project root
- Add: `TELEGRAM_BOT_TOKEN=your_token_here`
- Get token from @BotFather on Telegram

#### 2. Database Lock Error
**Error**: `database is locked`

**Solution**:
- SQLite doesn't handle concurrent writes well
- For production, use PostgreSQL:
  ```bash
  DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
  ```

#### 3. File Not Found Error
**Error**: `File not found: uploads/file.pdf`

**Solution**:
- Ensure uploads/ directory exists and is writable
- Check file paths in database are correct
- Verify files weren't deleted manually

#### 4. Multiple Bot Instances Conflict
**Error**: `Conflict: terminated by other getUpdates request`

**Solution**:
- Only one bot instance can poll at a time
- Kill other instances:
  ```bash
  # Windows (PowerShell)
  Get-Process python | Stop-Process -Force

  # Windows (CMD)
  tasklist | findstr python
  taskkill /PID <pid> /F

  # Linux/Mac
  ps aux | grep telegram_bot
  kill <pid>
  ```

#### 5. Messages Not Sending
**Symptoms**: Messages stay in pending state

**Debug Steps**:
1. Check background scheduler is running:
   ```
   Look for log: "Message scheduler started!"
   ```
2. Check scheduled time is in the past
3. Verify user_id exists in subscribed_users table
4. Check bot has permission to message user
5. Review logs for errors

#### 6. API Connection Error
**Error**: `Cannot connect to the server`

**Solution**:
- Verify FastAPI is running on port 8000
- Check `API_BASE_URL` in telegram_bot.py
- Ensure firewall allows localhost connections
- Try: `curl http://localhost:8000/`

### Logging and Debugging

**Enable Debug Logging**:
```python
# In each module
logging.basicConfig(level=logging.DEBUG)
```

**Check Database**:
```bash
sqlite3 scheduled_messages.db

# View pending messages
SELECT * FROM scheduled_messages WHERE is_sent = 0;

# View subscribed users
SELECT * FROM subscribed_users;

# Check message status
SELECT id, scheduled_timestamp, is_sent FROM scheduled_messages;
```

**Monitor Background Scheduler**:
```python
# Add this to scheduler.py
logger.info(f"Checked at {datetime.utcnow()}, found {len(due_messages)} due messages")
```

---

## Advanced Topics

### Scaling Considerations

**For High Volume**:
1. Use PostgreSQL with connection pooling
2. Implement message queue (Celery + Redis)
3. Separate scheduler into dedicated service
4. Use Telegram webhooks instead of polling
5. Add caching layer (Redis)
6. Horizontal scaling with load balancer

### Security Best Practices

1. **API Authentication**: Add JWT or API key authentication
2. **Rate Limiting**: Implement request throttling
3. **Input Validation**: Sanitize all user inputs
4. **File Upload Security**:
   - Validate file types
   - Limit file sizes
   - Scan for malware
5. **Database Security**: Use parameterized queries (already done with SQLAlchemy)
6. **Environment Variables**: Never commit .env file

### Monitoring and Observability

**Metrics to Track**:
- Messages scheduled per hour
- Message delivery success rate
- Average delivery latency
- API response times
- Database query performance
- Error rates per endpoint

**Tools**:
- Prometheus + Grafana for metrics
- ELK Stack for log aggregation
- Sentry for error tracking
- Uptime monitoring (UptimeRobot, etc.)

---

## Conclusion

This system provides a complete solution for scheduling and delivering messages through Telegram. The architecture is modular, scalable, and production-ready with proper error handling, logging, and database management.

For questions or issues, refer to the troubleshooting section or review the individual component documentation above.
