# Community Curator — User Manual

Community Curator is a desktop application for managing team projects, scheduling
outbound communications, and browsing cloud files. This manual covers every part
of the application in plain language.

---

## Table of Contents

1. [Getting Started — Login & Registration](#1-getting-started--login--registration)
2. [Navigation](#2-navigation)
3. [Dashboard](#3-dashboard)
4. [Timeline — Projects & Tasks](#4-timeline--projects--tasks)
5. [People — Team Members & Teams](#5-people--team-members--teams)
6. [Messages — Composing & Scheduling](#6-messages--composing--scheduling)
7. [Calendar](#7-calendar)
8. [Documents — Cloud Storage](#8-documents--cloud-storage)
9. [Settings](#9-settings)

---

## 1. Getting Started — Login & Registration

When you open the app you will see the login screen. You must create an account
or sign in before accessing any feature.

### Creating an Account

1. Click the **Sign Up** tab
2. Enter a username (minimum 3 characters)
3. Enter a password (minimum 6 characters)
4. Re-enter the password to confirm
5. Click **Sign Up**

Your account is created and you are signed in automatically.

### Signing In

1. Click the **Sign In** tab
2. Enter your username and password
3. Click **Sign In**

If the credentials are wrong an error message will appear beneath the form.

### After Signing In

The main application loads with the **Timeline** view open by default. Your
account name appears at the bottom of the left sidebar.

---

## 2. Navigation

The left sidebar is the main way to move between sections of the app.

| Sidebar Item | What it does |
|---|---|
| **Timeline** | Manage projects and tasks |
| **People** | Manage team members and teams |
| **Calendar** | Visual overview of scheduled messages |
| **Messages** | Compose and schedule messages |
| **Documents** | Browse OneDrive and Google Drive |
| **Settings** | Account connections and preferences |

**Collapsing the sidebar:** Click the arrow icon at the top of the sidebar to
collapse it to icons only. Click again to expand. This preference is remembered
between sessions.

**Message badge:** A number badge appears on the Messages item when there are
pending scheduled messages.

---

## 3. Dashboard

The Dashboard gives you a quick summary of messaging activity and a fast way to
schedule a message without opening the full composer.

### Metric Cards

Three cards across the top of the page show:

- **Messages Sent (30d)** — how many messages were sent in the last 30 days
- **Messages Pending** — how many messages are currently queued to send
- **Next Message** — the recipient and scheduled time of the next outgoing message

### Quick Schedule

The left panel lets you schedule a message in a few steps:

1. Select a recipient from the **Recipient** dropdown
2. Type your message in the text box
3. Set the date and time using the **Schedule For** picker
4. Click **Schedule Message**

**Save Draft** below the text box saves the message content as a draft so you
can return to it later from the full composer.

**Open Full Editor** takes you to the Messages view with all advanced options.

### Mini Calendar

The right panel shows a compact calendar of the current month.

- **Green dot** on a day — at least one message was sent that day
- **Orange dot** on a day — at least one message is pending for that day
- **Click any day** — opens the full composer with that day pre-selected, defaulting to 9:00 AM
- Use **Prev**, **Next**, and **Today** to navigate months

---

## 4. Timeline — Projects & Tasks

The Timeline is the planning core of the app. It organises work into projects
and tasks with date ranges and team assignments.

### Views

Switch between **Gantt** (default) and **List** using the toggle at the top right.

#### Gantt View

The Gantt chart shows tasks as horizontal bars on a calendar grid.

- Each **row** is a task. Tasks are grouped under their project.
- The **bar position** represents the task's date range.
- A vertical **Today line** marks the current date.
- **Zoom** to Day, Week, or Month using the buttons in the toolbar.
- Use **Previous** and **Next** to move the visible range forward or backward.
- Click **Today** to jump back to the current date.

#### List View

Shows all tasks in a table with columns for status, dates, assignees, and project.
Useful for scanning tasks without a visual calendar.

### Filtering

- **Filter by Project** — dropdown to show only tasks belonging to one project
- **Filter by Worker** — dropdown to show only tasks assigned to one team member

Both filters can be combined. Select "All Projects" or "All Workers" to clear them.

### Creating a Project

1. Click the **Project** button in the toolbar
2. Enter a project name and choose a colour
3. Click **Save**

The project appears in the timeline as a collapsible group.

### Creating a Task

**Option 1 — Project add button:**
Click the **+** icon on a project row. A modal opens with:
- Task title
- Start and end dates
- Status (Planned / In Progress / Done)
- Assignee (select from team members)
- Hours per week

**Option 2 — Drag to create:**
Drag the **Task** block from the toolbar onto the timeline grid at the desired
date. A creation modal opens pre-filled with those dates.

### Editing a Task

Click any task bar (Gantt) or task row (List) to open the edit modal.
All fields are editable. Click **Save** to confirm.

### Rescheduling by Dragging

In Gantt view, drag the left or right edge of a task bar to change its start or
end date. The task updates automatically.

### Task Status Colours

| Colour | Status |
|---|---|
| Orange | Planned |
| Blue | In Progress |
| Green | Done |

### Deleting a Project

Click the **delete** icon on the project row. This removes the project and
all its tasks. A confirmation prompt appears first.

### Sending a Message About a Project

Click the **message** icon on a project row. This opens the Calendar in day
selection mode with the project pre-loaded, so you can pick a day and the
composer will open ready to message that project's team.

---

## 5. People — Team Members & Teams

The People section has two tabs: **Members** and **Teams**.

---

### Members Tab

Displays all team members as cards.

**Searching:** Type in the search box at the top right to filter by name, role,
or email address.

### Adding a Member

Click **Add member** and fill in:
- Full Name (required)
- Role (e.g. Developer, Designer)
- Email address
- Phone number
- Weekly capacity in hours (defaults to 40)

Click **Save**.

### Member Cards

Each card shows the member's initials, name, role, email, team badges, active
task count, and weekly capacity.

- Click the **envelope icon** on a card to open the composer pre-filled with
  that member as a recipient.
- Click anywhere else on the card to open the **Member Profile**.

### Member Profile

The profile page has two panels:

**Left panel (info card):**
- Avatar, name, role
- Email, phone, and weekly capacity
- **Send Message** — opens the composer with this member as recipient
- **Edit Profile** — opens the edit modal
- **Remove Member** — deletes the member after confirmation
- **Teams** section — lists which teams this member belongs to. Click a team
  to jump to its detail page.

**Right panel (tasks):**
- All tasks assigned to this member, grouped by status:
  - In Progress
  - Planned
  - Completed
- Each task shows its title, project, and date range.

Click **All People** at the top left to go back to the member list.

---

### Teams Tab

Displays all teams as cards, each showing the team name, colour, and member count.

**Searching:** Type in the search box to filter teams by name.

### Creating a Team

Click **New Team** and fill in:
- Team name
- Colour (colour picker)
- Members to include (checkboxes)

Click **Save**.

### Team Detail

Click a team card to open its detail page:

- **Edit Team** — change name, colour, or membership
- **Delete Team** — removes the team after confirmation
- **Send Message to Team** — opens the composer with all team members who have
  an email address pre-selected as recipients
- **Members list** — shows all members in the team with their cards

Click **Back** to return to the team list.

---

## 6. Messages — Composing & Scheduling

The Messages view is the full-featured composer for scheduling Telegram messages
and emails.

### Channel Selection

At the top of the form, choose between:

- **Telegram** — sends via the connected Telegram bot to subscribed users
- **Email** — sends via Gmail SMTP to subscribed email addresses

The form adapts based on your selection.

### Selecting Recipients

Click the **Recipients** dropdown. A searchable list appears showing all
available contacts for the selected channel.

- Type to search by name or address
- Click a contact to add them — they appear as a removable chip above the input
- Click the **×** on a chip to remove a recipient
- Click **Refresh** to reload the contact list from the server

**Email only:** Click **+ Add new** to add an email address that is not yet
in the subscriber list.

### Subject Line (Email only)

When the Email channel is selected, a **Subject** field appears below the
recipient selector. This becomes the email subject line.

### Writing the Message

Type your message in the large text area. A character count appears below it.

### Attaching Files

Two attachment options are available side by side:

**Local Files:**
- Drag and drop files onto the upload zone, or click to open a file browser
- Supported for any file type

**Cloud Storage:**
- Click to open the Documents view in file selection mode
- Navigate your OneDrive or Google Drive folders
- Tick the files you want and click **Done**
- You are returned to the composer with the files attached

All selected files appear in a list below the upload zones. Click the **×**
next to a file to remove it.

### Scheduling

**Quick options (right of the form):**
- **Send Immediately** — schedules the message for approximately one minute from now
- **In 1 Hour** — schedules one hour from now
- **Tomorrow 9 AM** — schedules for 9:00 AM the next day

**Custom date and time:**
1. Click **Schedule days** to open the Calendar in day selection mode
2. Click the day you want
3. Click **Confirm**
4. Back in the composer, adjust the **Time** picker to the exact time

Selected days appear as removable chips. You can schedule for multiple days
by selecting days one at a time.

### Sending

Click **Schedule Message** (Telegram) or **Schedule Email** (Email).

The app validates that you have at least one recipient, a message, and a
scheduled time. On success a confirmation notification appears and the form clears.

### Saving a Draft

Click **Save Draft** to save the current message content. Drafts are accessible
from the Messages queue view and can be restored to the composer later.

### Clearing the Form

Click **Clear Form** to reset all fields back to empty.

---

## 7. Calendar

The Calendar gives a visual overview of all scheduled messages and task activity
across a monthly grid.

### Reading the Calendar

Each day cell can contain:

- **Message chips** — coloured pills showing message previews (up to 2 per day,
  with a count for extras)
- **Task dots** — small coloured dots for tasks that span that day (up to 5
  shown, project colour used)
- **Today** — highlighted with a border

### Navigating Months

Use **Prev**, **Next**, and **Today** at the top to move between months.

### Viewing Day Details

Click any day to open a detail panel showing:

**Messages for that day:**
- Status badge (Pending / Sent)
- Platform badge (Email / Telegram)
- Scheduled time
- Message preview text
- Subject line (emails only)
- Number of file attachments
- **Delete** button to cancel the message

**Tasks for that day:**
- Task title and project name
- Date range
- Status badge
- Assigned team members

**Schedule message for this day** button — opens the composer with that day
pre-selected.

### Selecting a Day for Scheduling

Click **Select day** in the top toolbar to enter day selection mode. Click a
day on the grid to select it. Click **Confirm** to open the composer with that
day pre-filled.

This mode is also entered automatically when you click "Send a message" from a
project on the Timeline, or click a day on the Dashboard mini calendar.

---

## 8. Documents — Cloud Storage

The Documents view lets you browse files from OneDrive and Google Drive, and
select files to attach to messages.

### Switching Between Sources

Click **OneDrive** or **Google Drive** at the top. You must have connected the
respective account in Settings first.

### Browsing Folders

- Click a **folder card** (or its **Open** button) to enter that folder
- The **breadcrumb trail** at the top shows your current path — click any
  segment to jump back to that level
- Click **Root** to return to the top-level folder
- Click **Back** to go up one level

### Searching

Type in the **Search documents** box to filter the current folder by file or
folder name. Clear the box to see all items again.

### Refreshing

Click **Sync** to reload the current folder from the cloud. The last sync time
is shown next to the button.

### File Cards

Each card shows:
- File or folder icon
- Name
- Type and size
- Last modified date
- **Open in browser** link (opens the file in your web browser)

### Selecting Files to Attach to a Message

1. Click **Select** in the toolbar to enter selection mode
2. Tick the checkbox on each file you want to attach (folders can still be
   opened to navigate into them)
3. Click **Done** — you are returned to the composer with the files attached
4. Click **Cancel** to exit selection mode without attaching anything

---

## 9. Settings

### Your Account

Shows your current username and a **Logout** button. Clicking Logout returns
you to the login screen.

### Connected Accounts

Four integration cards are shown:

#### Microsoft 365 / OneDrive

Connects your Microsoft account for OneDrive file access.

- Click **Connect** — a Microsoft sign-in window opens
- Sign in with your Microsoft or UCL account
- Once connected, your email address and "Connected" status appear
- Click **Disconnect** to remove the connection

> Note: Your Microsoft account must be on the approved users list. Contact
> zcabyka@ucl.ac.uk if sign-in is blocked.

#### Google Drive

Connects your Google account for Google Drive file access.

- Click **Connect** — a Google sign-in window opens in your browser
- Sign in and grant the requested permissions
- Once connected, your Google email and "Connected" status appear
- Click **Disconnect** to remove the connection

> Note: Your Google account must be added as a test user. Contact
> zcabyka@ucl.ac.uk if access is blocked.

#### Telegram

Shows the number of Telegram users who have subscribed to receive messages
via the connected bot.

- Click **Refresh** to reload the current subscriber count
- To subscribe a new user: ask them to send `/start` to the Telegram bot

#### WhatsApp

WhatsApp integration is not yet available. The **Connect** button shows a
"coming soon" message.

### Appearance

Select a theme from the dropdown:

- **Dark** — dark background throughout (default)
- **Light** — light background throughout
- **System** — follows your operating system's dark/light mode setting

Your choice is saved automatically and applied on next launch.

---

## Tips & Common Workflows

### Scheduling a message to a team

1. Go to **People → Teams**
2. Open the team you want to message
3. Click **Send Message to Team**
4. The composer opens with all team members who have an email address pre-filled
5. Write your message, set a time, and click **Schedule Email**

### Scheduling a message tied to a project date

1. Go to **Timeline**
2. Click the **message** icon on the project row
3. The Calendar opens — days with tasks for that project are highlighted
4. Click the day you want to send the message
5. Click **Confirm**
6. Write and schedule your message in the composer

### Attaching a cloud file to a message

1. Open the composer (**Messages**)
2. Under **Cloud Storage**, click the attachment zone
3. Browse to your file in OneDrive or Google Drive
4. Tick the file and click **Done**
5. The file appears in your attachment list

### Finding a team member quickly

1. Go to **People → Members**
2. Type the member's name, role, or email in the search box
3. Click the member card to view their profile, tasks, and teams

---

*For setup instructions, see STARTUP_GUIDE.md.*
*For technical issues or access requests, contact zcabyka@ucl.ac.uk.*
