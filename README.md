# Community Curator

Community Curator is a desktop planning and communications tool built around three parts:

- An Electron desktop app for project planning, team management, document browsing, and message composition
- A FastAPI application backend for user accounts, workspaces, tasks, teams, and timeline data
- A FastAPI messaging engine that schedules and delivers Telegram messages and emails

In practice, the app acts like a lightweight operations hub for community or team coordination: you define projects, assign people, browse files from OneDrive or Google Drive, and schedule outbound updates to Telegram or email recipients.

## What The App Does

The current codebase supports these main workflows:

- Sign up and sign in to a custom backend user account
- Create top-level workspaces and nested projects for planning
- Add team members with roles, contact details, and weekly capacity
- Group people into teams
- Create timeline tasks with date ranges, assignees, and workload estimates
- View work in a Gantt-style timeline, list view, calendar, and people view
- Connect Microsoft 365 and Google Drive from the Electron desktop app
- Browse cloud files and attach them to outgoing messages
- Schedule Telegram messages with optional attachments
- Schedule emails with optional attachments
- Persist message drafts locally in the desktop client
- Auto-subscribe team member email addresses into the email delivery engine

## Architecture

The repository is split into three application layers.

### 1. Electron Desktop App

Root files and the `src/renderer` folder contain the desktop application:

- `main.js`: Electron main process, OAuth handling, token storage, and IPC bridges
- `preload.js`: exposes a safe `window.electronAPI` bridge to the renderer
- `renderer.js`: startup flow, login/register logic, and high-level app bootstrapping
- `src/renderer/`: feature modules and UI views

The desktop app is responsible for:

- Rendering the user interface
- Managing local UI state
- Signing into Microsoft and Google
- Calling the app backend on port `8080`
- Calling the messaging engine on port `8000`

### 2. App Backend

`App-Backend/` is a FastAPI service focused on product data and user accounts.

It provides:

- User registration and sign-in
- Workspaces
- Projects
- Team members
- Teams
- Timeline tasks
- Project assignee email aggregation

Default local port:

- `8080`

Primary storage:

- SQLite by default in `accounts.db`

### 3. Telegram Engine

`Telegram-Engine/` is a second FastAPI service dedicated to outbound communications.

It provides:

- Telegram subscriber registration
- Email subscriber registration
- Telegram message scheduling
- Email scheduling
- Background delivery workers
- Telegram bot polling process
- Gmail SMTP delivery

Default local port:

- `8000`

Primary storage:

- SQLite by default in `scheduled_messages.db`

## Service Relationships

The data flow looks like this:

1. The user signs into the Electron app using the custom auth backend.
2. The Electron app reads and writes planning data through `App-Backend`.
3. The Electron app reads subscribed recipients and schedules outbound messages through `Telegram-Engine`.
4. `Telegram-Engine` runs background schedulers every few seconds and sends due Telegram messages or emails.
5. When a team member with an email is created in `App-Backend`, that backend attempts to subscribe the email into `Telegram-Engine`.

## Key Screens In The Desktop App

### Projects / Timeline

The timeline area is the planning core of the app. It loads:

- workspaces
- projects
- team members
- teams
- timeline tasks

It supports Gantt and list views, zoom levels, filtering, and assignment by person or team.

### People

The People area focuses on:

- team members
- capacity and workload context
- teams and team composition
- email linkage to subscribed email recipients

### Calendar

The calendar view surfaces scheduled work and message-related activity from the renderer state.

### Messages

The scheduling area combines:

- a message composer
- Telegram recipient selection
- email recipient selection
- attachment selection
- queue views for Telegram and email
- drafts

### Documents

The documents area lets the user browse cloud files from:

- OneDrive via Microsoft Graph
- Google Drive via Google APIs

These files can be attached to scheduled messages.

### Settings

Settings shows:

- signed-in app user
- Microsoft connection status
- Google Drive connection status
- Telegram subscriber status
- placeholder WhatsApp integration

## Authentication And Integrations

### Custom App Login

The app uses a simple username/password flow against `App-Backend`:

- `POST /register`
- `POST /sign-in`

The backend returns a user object containing a `uuid`, and the renderer uses that `uuid` as `user_uuid` in most backend requests.

Important note:

- this is not token-based auth yet
- most app backend endpoints trust the `user_uuid` query parameter directly

### Microsoft 365 / OneDrive

Electron uses `@azure/msal-node` for Microsoft authentication and persists cache data in the Electron user data directory.

Used for:

- user identity
- OneDrive file browsing and download

### Google Drive

Electron uses the `googleapis` package and a local OAuth callback server.

Used for:

- Google Drive browsing
- Google file download before attachment scheduling

### Telegram

The messaging engine includes a Telegram bot and subscriber registry:

- users subscribe by sending `/start` to the bot
- the engine maps bot chat IDs to generated user IDs
- scheduled messages target those generated user IDs

### Email / Gmail

The messaging engine can send scheduled emails using Gmail SMTP with an app password.

## Repository Structure

```text
.
|-- App-Backend/
|   |-- api.py
|   |-- auth.py
|   |-- database.py
|   |-- main.py
|   |-- models.py
|   `-- schemas.py
|-- Telegram-Engine/
|   |-- api.py
|   |-- database.py
|   |-- gmail_messenger.py
|   |-- main.py
|   |-- models.py
|   |-- scheduler.py
|   |-- telegram_bot.py
|   `-- telegram_messenger.py
|-- src/renderer/
|   |-- appState.js
|   |-- azureVMAPI.js
|   |-- googleDriveAPI.js
|   |-- microsoftGraphAPI.js
|   `-- views/
|-- index.html
|-- main.js
|-- preload.js
|-- renderer.js
|-- simpleStore.js
`-- package.json
```

## Running The Project

This repo does not currently start all services with one command. You need to run the Python services separately from the Electron app.

### Prerequisites

- Node.js
- Python 3.10+ recommended
- A Telegram bot token if you want Telegram delivery
- Gmail app password if you want email delivery
- Microsoft Azure app registration for OneDrive auth
- Google Cloud OAuth credentials for Google Drive auth

### 1. Install Electron Dependencies

From the repository root:

```bash
npm install
```

### 2. Configure Root `.env`

Copy `.env.example` to `.env` in the repository root and fill in at least:

```env
MICROSOFT_CLIENT_ID=your_microsoft_client_id
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AZURE_VM_URL=http://localhost:8000
```

Important note:

- the current renderer state hardcodes backend URLs in `src/renderer/appState.js`
- by default those values point at `http://20.153.191.11:8000` and `http://20.153.191.11:8080`
- for local development, update those constants to your local services unless you intentionally want the remote VM

### 3. Start The App Backend

Create a virtual environment, install requirements, then run:

```bash
cd App-Backend
pip install -r requirements.txt
python main.py
```

This starts FastAPI on:

```text
http://localhost:8080
```

### 4. Start The Messaging Engine

In a second terminal:

```bash
cd Telegram-Engine
pip install -r requirements.txt
python main.py
```

Recommended `.env` values for this service include:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
API_BASE_URL=http://localhost:8000
BASE_URL=http://localhost:8000
GMAIL_ADDRESS=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password
DATABASE_URL=sqlite:///./scheduled_messages.db
```

This starts:

- FastAPI on `http://localhost:8000`
- the Telegram bot polling process
- the background schedulers for Telegram and email delivery

### 5. Start The Electron App

From the repository root:

```bash
npm start
```

Alternative:

```bash
npm run dev
```

## API Summary

### App Backend (`8080`)

Authentication:

- `POST /register`
- `POST /sign-in`

Planning data:

- `GET/POST /workspaces`
- `GET/PUT/DELETE /workspaces/{workspace_id}`
- `GET/POST /projects`
- `GET/PUT/DELETE /projects/{project_id}`
- `GET/POST /team-members`
- `GET/PUT/DELETE /team-members/{member_id}`
- `GET/POST /timeline-tasks`
- `GET/PUT/DELETE /timeline-tasks/{task_id}`
- `GET/POST /teams`
- `GET/PUT/DELETE /teams/{team_id}`
- `GET /projects/{project_id}/assignee-emails`

Most of these require:

- `user_uuid` as a query parameter

### Messaging Engine (`8000`)

Telegram:

- `POST /schedule-message`
- `POST /subscribe-user`
- `GET /pending-messages`
- `DELETE /delete-message`
- `GET /subscribed-users`

Email:

- `POST /schedule-email`
- `POST /subscribe-email-user`
- `GET /pending-emails`
- `DELETE /delete-email`
- `GET /subscribed-email-users`

Docs:

- `GET /docs`

## Data Model Overview

### App Backend

Core entities:

- `User`
- `Workspace`
- `Project`
- `TeamMember`
- `Team`
- `TimelineTask`

The user-facing hierarchy is roughly:

```text
Workspace -> Project -> TimelineTask
```

### Messaging Engine

Core entities:

- `ScheduledMessage`
- `SubscribedUser`
- `ScheduledEmail`
- `EmailSubscribedUser`

## Persistence

### Electron

Electron persists local auth and app data in the app user data directory using:

- MSAL cache JSON
- a simple JSON store via `simpleStore.js`
- browser `localStorage` for some per-user UI state and drafts

### Python Services

Both Python services default to SQLite:

- `App-Backend/accounts.db`
- `Telegram-Engine/scheduled_messages.db`

The code also allows overriding the database URL for other SQLAlchemy-supported databases.

## Development Notes

### Background Scheduling

The messaging engine checks for due deliveries every 5 seconds and marks them as sent after processing.

### File Attachments

Attachments can come from:

- local files
- OneDrive downloads
- Google Drive downloads

Uploaded files are stored in the messaging engine `uploads/` directory and then served under `/files`.

## Suggested First Improvements

- Move service URLs into a shared runtime configuration layer
- Add a root bootstrap script for running all three services together
- Replace `user_uuid` query-based trust with real authenticated API sessions or tokens
- Split the current README content in subprojects into service-specific setup docs
- Add automated tests for the two FastAPI services

## Useful Commands

```bash
# Electron app
npm start

# Package desktop app
npm run package
npm run make

# App backend
cd App-Backend
python main.py

# Messaging engine
cd Telegram-Engine
python main.py
```