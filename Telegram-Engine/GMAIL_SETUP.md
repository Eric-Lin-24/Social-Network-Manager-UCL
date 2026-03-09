# Gmail Bot Setup Guide

This guide explains how to configure and use the Gmail/Email delivery feature in the Scheduled Message System.

## Table of Contents
- [Overview](#overview)
- [Gmail Configuration](#gmail-configuration)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Gmail bot allows you to schedule and send emails through Gmail's SMTP server. It runs alongside the Telegram bot and uses the same scheduling system, checking every 5 seconds for due emails.

### Key Features
- Schedule emails with specific timestamps
- Attach multiple files to emails
- User subscription system with unique user IDs
- Automatic delivery via Gmail SMTP
- Shared scheduling infrastructure with Telegram

---

## Gmail Configuration

### Step 1: Enable 2-Factor Authentication

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to **Security**
3. Enable **2-Step Verification** if not already enabled

### Step 2: Generate an App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Or navigate to: **Google Account → Security → 2-Step Verification → App passwords**
2. Select app: **Mail**
3. Select device: **Other (Custom name)**
4. Enter name: `Scheduled Message System` (or any name you prefer)
5. Click **Generate**
6. Copy the **16-character passwornpd** (remove spaces)
7. **Save this password securely** - you won't be able to see it again

### Step 3: Configure Environment Variables

1. Navigate to the `Telegram-Engine` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Gmail credentials:
   ```env
   # Gmail Configuration
   GMAIL_ADDRESS=your_email@gmail.com
   GMAIL_APP_PASSWORD=abcdeFGHijklmnop  # 16-character app password (no spaces)
   ```

4. Save the file

### Step 4: Restart the Application

If the application is running, restart it to load the new environment variables:
```bash
python main.py
```

You should see:
```
Email Scheduler: Active (configure Gmail in .env)
```

---

## API Endpoints

The Gmail bot provides the following REST API endpoints:

### 1. Subscribe an Email User

**POST** `/subscribe-email-user`

Register a new email user and receive a unique `user_id`.

**Request Body:**
```json
{
  "email_address": "recipient@example.com",
  "user_name": "John Doe"
}
```

**Response:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email_address": "recipient@example.com",
  "user_name": "John Doe",
  "created_at": "2026-02-07T12:00:00.000000"
}
```

---

### 2. Schedule an Email

**POST** `/schedule-email`

Schedule an email to be sent at a specific time.

**Request (Form Data):**
- `from_sender` (string): Sender identifier
- `target_user_id` (string): Comma-separated list of user IDs
- `subject` (string): Email subject line
- `message` (string): Email body (plain text)
- `scheduled_timestamp` (string): ISO 8601 timestamp (UTC)
- `files` (optional): List of file uploads

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "from_sender": "admin",
  "target_user_id": ["550e8400-e29b-41d4-a716-446655440000"],
  "message": "Hello! This is a test email.",
  "scheduled_timestamp": "2026-02-08T10:00:00",
  "file_paths": ["uploads/filename.pdf"],
  "is_sent": false,
  "created_at": "2026-02-07T12:00:00.000000"
}
```

---

### 3. Get Pending Emails

**GET** `/pending-emails?from_sender=admin`

Retrieve all emails that haven't been sent yet for a specific sender.

**Response:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "from_sender": "admin",
    "target_user_id": ["550e8400-e29b-41d4-a716-446655440000"],
    "message": "Pending email content",
    "scheduled_timestamp": "2026-02-08T10:00:00",
    "is_sent": false,
    ...
  }
]
```

---

### 4. Get All Email Subscribers

**GET** `/subscribed-email-users`

Retrieve all registered email users.

**Response:**
```json
[
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email_address": "recipient@example.com",
    "user_name": "John Doe",
    "created_at": "2026-02-07T12:00:00.000000"
  }
]
```

---

### 5. Delete a Scheduled Email

**DELETE** `/delete-email?email_id=660e8400-e29b-41d4-a716-446655440001`

Delete a scheduled email before it's sent.

**Response:**
```json
true
```

---

## Usage Examples

### Example 1: Subscribe a User

```bash
curl -X POST http://localhost:8000/subscribe-email-user \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "alice@example.com",
    "user_name": "Alice Smith"
  }'
```

**Response:**
```json
{
  "user_id": "abc123-def456-ghi789",
  "email_address": "alice@example.com",
  "user_name": "Alice Smith",
  "created_at": "2026-02-07T14:30:00"
}
```

Save the `user_id` - you'll need it to schedule emails!

---

### Example 2: Schedule an Email (No Attachments)

```bash
curl -X POST http://localhost:8000/schedule-email \
  -F "from_sender=system" \
  -F "target_user_id=abc123-def456-ghi789" \
  -F "subject=Meeting Reminder" \
  -F "message=Don't forget our meeting tomorrow at 10 AM!" \
  -F "scheduled_timestamp=2026-02-08T09:00:00Z"
```

---

### Example 3: Schedule an Email with File Attachments

```bash
curl -X POST http://localhost:8000/schedule-email \
  -F "from_sender=hr" \
  -F "target_user_id=abc123-def456-ghi789,xyz789-uvw456" \
  -F "subject=Monthly Report" \
  -F "message=Please find attached the monthly report." \
  -F "scheduled_timestamp=2026-02-10T08:00:00Z" \
  -F "files=@/path/to/report.pdf" \
  -F "files=@/path/to/summary.xlsx"
```

---

### Example 4: Python Script

```python
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

# 1. Subscribe a user
subscribe_response = requests.post(
    f"{BASE_URL}/subscribe-email-user",
    json={
        "email_address": "bob@example.com",
        "user_name": "Bob Johnson"
    }
)
user_data = subscribe_response.json()
user_id = user_data["user_id"]
print(f"User ID: {user_id}")

# 2. Schedule an email for 1 hour from now
scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"

schedule_response = requests.post(
    f"{BASE_URL}/schedule-email",
    data={
        "from_sender": "notifications",
        "target_user_id": user_id,
        "subject": "Welcome!",
        "message": "Thank you for subscribing to our service.",
        "scheduled_timestamp": scheduled_time
    }
)
print(f"Email scheduled: {schedule_response.json()}")
```

---

## Architecture

### Email Flow

1. **User Subscription**
   - User registers via `/subscribe-email-user`
   - System generates a unique `user_id` (UUID)
   - Email address is stored in `email_subscribed_users` table

2. **Email Scheduling**
   - Client sends POST request to `/schedule-email`
   - System stores email in `scheduled_emails` table with `is_sent=False`
   - Files (if any) are saved to `uploads/` directory

3. **Background Scheduler**
   - Runs every 5 seconds
   - Queries for emails where `scheduled_timestamp <= now()` and `is_sent=False`
   - For each due email:
     - Looks up recipient email addresses from `user_id`
     - Sends via Gmail SMTP
     - Marks as `is_sent=True`

### Database Schema

**email_subscribed_users** table:
```
user_id (UUID, PK)         - Unique identifier
email_address (String)     - Recipient's email
user_name (String)         - Display name
created_at (DateTime)      - Registration timestamp
```

**scheduled_emails** table:
```
id (UUID, PK)              - Email ID
from_sender (String)       - Sender identifier
target_user_id (JSON)      - List of recipient user IDs
subject (String)           - Email subject
message (String)           - Email body
scheduled_timestamp        - When to send
file_paths (JSON)          - Attached file paths
is_sent (Boolean)          - Delivery status
created_at (DateTime)      - Creation timestamp
```

---

## Troubleshooting

### Error: "SMTP Authentication failed"

**Cause:** Invalid Gmail credentials or app password.

**Solution:**
1. Verify `GMAIL_ADDRESS` is correct
2. Regenerate App Password (see Step 2 above)
3. Ensure no spaces in the app password
4. Check that 2FA is enabled on your Google account

---

### Error: "Gmail credentials not configured"

**Cause:** Missing or empty `GMAIL_ADDRESS` or `GMAIL_APP_PASSWORD` in `.env`.

**Solution:**
1. Check that `.env` file exists in `Telegram-Engine/` directory
2. Verify both variables are set:
   ```env
   GMAIL_ADDRESS=your_email@gmail.com
   GMAIL_APP_PASSWORD=yourapppassword
   ```
3. Restart the application

---

### Emails Not Sending

**Check:**
1. Verify the scheduler is running (check logs for "Email scheduler: Checking every 5 seconds...")
2. Ensure `scheduled_timestamp` is in the past or current time
3. Check that `is_sent` is `False` in the database
4. Review application logs for error messages
5. Test Gmail credentials manually:
   ```python
   import smtplib
   server = smtplib.SMTP("smtp.gmail.com", 587)
   server.starttls()
   server.login("your_email@gmail.com", "your_app_password")
   print("Login successful!")
   server.quit()
   ```

---

### File Attachments Not Working

**Check:**
1. Verify files are uploaded in the request (use `-F` with curl, not `-d`)
2. Check `uploads/` directory exists and has write permissions
3. Review file paths in database (`file_paths` column)
4. Ensure files exist at the specified paths

---

## Gmail Limitations

- **Daily sending limit:** Gmail typically allows 500 emails/day for free accounts
- **Recipient limit:** Maximum 500 recipients per day
- **Attachment size:** Maximum 25 MB per email
- **SMTP rate limits:** Don't send too fast; the scheduler's 5-second interval is safe

---

## Security Best Practices

1. **Never commit `.env` file** - Use `.env.example` as a template
2. **Use App Passwords** - Never use your actual Gmail password
3. **Restrict access** - Keep API endpoints behind authentication if exposed publicly
4. **Monitor logs** - Watch for suspicious activity
5. **Rotate passwords** - Regenerate app passwords periodically

---

## Integration with Frontend

Your Electron frontend can integrate with the Gmail bot using the same pattern as Telegram:

```javascript
// Subscribe email user
const subscribeEmailUser = async (email, name) => {
  const response = await fetch('http://localhost:8000/subscribe-email-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: email,
      user_name: name
    })
  });
  return await response.json();
};

// Schedule email
const scheduleEmail = async (userId, subject, message, timestamp, files) => {
  const formData = new FormData();
  formData.append('from_sender', 'frontend');
  formData.append('target_user_id', userId);
  formData.append('subject', subject);
  formData.append('message', message);
  formData.append('scheduled_timestamp', timestamp);

  if (files) {
    files.forEach(file => formData.append('files', file));
  }

  const response = await fetch('http://localhost:8000/schedule-email', {
    method: 'POST',
    body: formData
  });
  return await response.json();
};
```

---

## API Documentation

Full interactive API documentation is available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Both interfaces provide:
- Complete endpoint documentation
- Request/response schemas
- Interactive "Try it out" functionality
- Example requests and responses

---

## Support

For issues, questions, or feature requests:
1. Check the application logs in the console
2. Review this documentation
3. Check the main [README.md](README.md) file
4. Examine [ARCHITECTURE.md](ARCHITECTURE.md) for system design details

---

## Summary

The Gmail bot provides a powerful, scheduled email delivery system that:
- Works alongside Telegram bot using shared infrastructure
- Supports file attachments and multiple recipients
- Uses secure App Password authentication
- Provides REST API for easy integration
- Runs completely automatically once configured

Just configure your Gmail credentials in `.env`, and you're ready to schedule emails!
