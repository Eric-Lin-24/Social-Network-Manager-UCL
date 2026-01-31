# Scheduled Message API

A FastAPI application for scheduling messages with file attachments, storing data in a database (SQLite/PostgreSQL), and automatically sending messages via Telegram when they're due.

## Features

- 📅 Schedule messages to be sent at specific times
- 📎 Upload and attach files (documents, images, etc.)
- 👥 User subscription system with auto-generated unique IDs
- ⚡ Automatic background task to send due messages
- 🤖 Telegram bot integration for subscriptions and delivery
- 💾 SQLite database (or PostgreSQL for production)
- 🔌 RESTful API endpoints with automatic documentation
- 🔄 Concurrent FastAPI + Telegram bot with single command

## Quick Start

### Prerequisites

- Python 3.8+
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd SNM-Demo
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   API_BASE_URL=http://localhost:8000
   BASE_URL=http://localhost:8000
   ```

4. **Run the application**:
   ```bash
   python main.py
   ```

   This single command starts both:
   - FastAPI server on `http://localhost:8000`
   - Telegram bot in polling mode

## Getting Your Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token and add it to your `.env` file
5. Test your bot by searching for it on Telegram and sending `/start`

## How It Works

### User Flow

1. **User subscribes via Telegram**:
   - User finds your bot on Telegram
   - Sends `/start` command
   - Receives unique `user_id` (UUID)

2. **Schedule a message via API**:
   - API client schedules message with `user_id`
   - Optionally attaches files
   - Sets future delivery time

3. **Automatic delivery**:
   - Background scheduler checks every 30 seconds
   - Finds messages due for delivery
   - Looks up `chat_id` from `user_id`
   - Sends message + files via Telegram
   - Marks message as sent

## API Endpoints

### Base URL
```
http://localhost:8000
```

### 1. Schedule a Message
**POST** `/schedule-message`

Schedule a message to be sent at a specific time with optional file attachments.

**Request** (multipart/form-data):
```bash
curl -X POST "http://localhost:8000/schedule-message" \
  -F "target_user_id=user-123-abc,user-456-def" \
  -F "message=Hello, this is a scheduled message!" \
  -F "scheduled_timestamp=2025-12-05T15:30:00Z" \
  -F "files=@document.pdf" \
  -F "files=@image.jpg"
```

**Parameters**:
- `target_user_id` (string, required): Comma-separated list of user IDs
- `message` (string, required): Message content
- `scheduled_timestamp` (string, required): UTC timestamp (ISO 8601 format)
- `files` (file[], optional): File attachments

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_user_id": ["user-123-abc", "user-456-def"],
  "message": "Hello, this is a scheduled message!",
  "scheduled_timestamp": "2025-12-05T15:30:00",
  "file_paths": ["uploads/550e8400_doc.pdf"],
  "is_sent": false,
  "created_at": "2025-12-04T10:00:00"
}
```

---

### 2. Subscribe a User
**POST** `/subscribe-user`

Register a new user and receive a randomly generated user_id.

**Request** (JSON):
```bash
curl -X POST "http://localhost:8000/subscribe-user" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "123456789",
    "chat_name": "JohnDoe"
  }'
```

**Parameters**:
- `chat_id` (string, required): Unique chat identifier
- `chat_name` (string, required): Display name

**Response**:
```json
{
  "user_id": "660e9511-f39c-52e5-b827-557766551111",
  "chat_id": "123456789",
  "chat_name": "JohnDoe",
  "created_at": "2025-12-04T10:00:00"
}
```

**Note**: This endpoint is automatically called by the Telegram bot when users send `/start`.

---

### 3. Get Pending Messages
**GET** `/pending-messages`

Retrieve all messages that haven't been sent yet.

**Request**:
```bash
curl -X GET "http://localhost:8000/pending-messages"
```

**Response**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "target_user_id": ["user-123"],
    "message": "Pending message",
    "scheduled_timestamp": "2025-12-05T15:30:00",
    "file_paths": null,
    "is_sent": false,
    "created_at": "2025-12-04T10:00:00"
  }
]
```

---

### 4. Get Subscribed Users
**GET** `/subscribed-users`

Retrieve all registered users.

**Request**:
```bash
curl -X GET "http://localhost:8000/subscribed-users"
```

**Response**:
```json
[
  {
    "user_id": "660e9511-f39c-52e5-b827-557766551111",
    "chat_id": "123456789",
    "chat_name": "JohnDoe",
    "created_at": "2025-12-04T10:00:00"
  }
]
```

---

## Telegram Bot Commands

### `/start`
Subscribe to receive scheduled messages and get your unique `user_id`.

**Example**:
```
User: /start

Bot: ✅ Welcome, JohnDoe!

You have been successfully subscribed to receive messages.

🆔 Your User ID: 660e9511-f39c-52e5-b827-557766551111
💬 Chat ID: 123456789

You will now receive scheduled messages sent to your user ID.
```

### `/help`
Show help message with available commands.

---

## Testing the System

### Step 1: Subscribe via Telegram
1. Find your bot on Telegram
2. Send `/start`
3. Save the `user_id` you receive

### Step 2: Schedule a Test Message
```bash
# Schedule a message for 1 minute from now
curl -X POST "http://localhost:8000/schedule-message" \
  -F "target_user_id=YOUR_USER_ID" \
  -F "message=Test message from the scheduler!" \
  -F "scheduled_timestamp=$(date -u -d '+1 minute' +'%Y-%m-%dT%H:%M:%SZ')"
```

### Step 3: Wait for Delivery
- The background scheduler checks every 30 seconds
- Your message will be delivered within 30 seconds of the scheduled time
- Check your Telegram for the message!

---

## Database Schema

### `scheduled_messages` Table
| Column | Type | Description |
|--------|------|-------------|
| id | String (PK) | Unique message identifier (UUID) |
| target_user_id | JSON | List of recipient user IDs |
| message | String | Message content |
| scheduled_timestamp | DateTime | When to send (UTC) |
| file_paths | JSON | Local file paths of attachments |
| is_sent | Boolean | Delivery status |
| created_at | DateTime | Creation timestamp |

### `subscribed_users` Table
| Column | Type | Description |
|--------|------|-------------|
| user_id | String (PK) | Unique user identifier (UUID) |
| chat_id | String (Unique) | Platform chat identifier |
| chat_name | String | Display name |
| created_at | DateTime | Subscription timestamp |

---

## Project Structure

```
SNM-Demo/
├── main.py                  # Main entry point - starts all services
├── api.py                   # FastAPI application and REST endpoints
├── telegram_bot.py          # Telegram bot for user subscriptions
├── telegram_messenger.py    # Message delivery via Telegram Bot API
├── scheduler.py             # Background scheduler for due messages
├── database.py              # Database connection and session management
├── models.py                # SQLAlchemy ORM models
├── schemas.py               # Pydantic validation schemas
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (create this)
├── README.md                # This file - user guide
├── ARCHITECTURE.md          # Detailed system architecture
├── TESTING_GUIDE.md         # Testing instructions
├── scheduled_messages.db    # SQLite database (auto-created)
└── uploads/                 # File storage directory (auto-created)
```

---

## Configuration

### Environment Variables

**Required**:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `API_BASE_URL` - URL where FastAPI is running (default: `http://localhost:8000`)

**Optional**:
- `DATABASE_URL` - Database connection string (default: SQLite)
- `BASE_URL` - Base URL for the application (default: `http://localhost:8000`)

### Database Configuration

**SQLite** (default):
```bash
DATABASE_URL=sqlite:///./scheduled_messages.db
```

**PostgreSQL** (production):
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
```

---

## Background Scheduler

The application runs a background task that:
- Checks for due messages every 30 seconds
- Queries messages where `scheduled_timestamp <= now` and `is_sent = false`
- For each message:
  - Looks up `chat_id` from `user_id` in subscribed_users table
  - Sends message via Telegram Bot API
  - Sends file attachments if any
  - Marks message as sent
- Logs all operations and errors

---

## Interactive API Documentation

FastAPI provides automatic interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Advanced Usage

### Multiple Recipients
```bash
curl -X POST "http://localhost:8000/schedule-message" \
  -F "target_user_id=user1,user2,user3" \
  -F "message=Broadcast message!" \
  -F "scheduled_timestamp=2025-12-05T15:30:00Z"
```

### With File Attachments
```bash
curl -X POST "http://localhost:8000/schedule-message" \
  -F "target_user_id=user-123" \
  -F "message=Here's your document!" \
  -F "scheduled_timestamp=2025-12-05T15:30:00Z" \
  -F "files=@report.pdf" \
  -F "files=@chart.png"
```

### Check Pending Messages
```bash
curl http://localhost:8000/pending-messages | jq
```

### Check Subscribed Users
```bash
curl http://localhost:8000/subscribed-users | jq
```

---

## Production Considerations

### Database
- Use PostgreSQL instead of SQLite for production
- Set up regular backups
- Configure connection pooling

### Deployment
- Use process manager (systemd, PM2, or Docker)
- Set up reverse proxy (Nginx/Caddy)
- Enable HTTPS with SSL certificate
- Use Telegram webhooks instead of polling
- Implement rate limiting
- Add API authentication

### Monitoring
- Set up logging aggregation
- Monitor delivery success rates
- Track API response times
- Alert on failures

### Security
- Never commit `.env` file
- Validate and sanitize all inputs
- Limit file upload sizes
- Scan uploaded files for malware
- Use environment-specific configurations

---

## Troubleshooting

### Bot Token Error
```
ValueError: TELEGRAM_BOT_TOKEN environment variable is not set!
```
**Solution**: Create `.env` file with `TELEGRAM_BOT_TOKEN=your_token`

### Multiple Bot Instance Conflict
```
Conflict: terminated by other getUpdates request
```
**Solution**: Only one bot instance can run. Kill other instances:
```bash
# Windows
taskkill /F /IM python.exe

# Linux
pkill -f telegram_bot.py
```

### Messages Not Sending
**Debug Steps**:
1. Check scheduled time is in the past
2. Verify user_id exists in subscribed_users table
3. Ensure bot is running (`python main.py` output)
4. Check logs for errors
5. Query database: `SELECT * FROM scheduled_messages WHERE is_sent = 0;`

---

## Documentation

- **README.md** (this file) - User guide and quick start
- **ARCHITECTURE.md** - Complete system architecture documentation
- **TESTING_GUIDE.md** - Detailed testing instructions

---

## License

This project is provided as-is for demonstration purposes.

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review ARCHITECTURE.md for detailed component information
3. Check logs for error messages
4. Verify configuration in `.env` file
