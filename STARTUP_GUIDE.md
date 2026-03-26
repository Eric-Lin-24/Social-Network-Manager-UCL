# Community Curator — Startup Guide

This guide walks you through everything needed to run Community Curator from source.
The two backend services (messaging engine and app backend) are already deployed and running
on a remote server — you only need to set up and run the Electron desktop app.

---

## Contact

If you encounter any issues during setup, or need to be added as an approved user for
Microsoft or Google OAuth testing, please get in touch:

**Yusuf Karakose**
zcabyka@ucl.ac.uk

Please include your Microsoft account email (e.g. your UCL email) so it can be added
to the approved users list before you test the OAuth sign-in flows.

---

## Prerequisites

Make sure you have the following installed before starting:

- **Node.js** v18 or later — https://nodejs.org
- **npm** (comes with Node.js)
- **Git** (to clone the repository)

You do not need Python, Docker, or any database — the backends are already running remotely.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Eric-Lin-24/Social-Network-Manager-UCL.git
cd Social-Network-Manager-UCL
```

---

## Step 2 — Install Dependencies

```bash
npm install
```

This installs Electron and all required Node.js packages. It may take a minute.

---

## Step 3 — Create the `.env` File

The app requires a `.env` file in the root of the project for OAuth credentials.
A template is provided at `.env.example`. Copy it and fill in the values:

```bash
cp .env.example .env
```

Then open `.env` and fill in the following:

```env
MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
AZURE_VM_URL=http://20.153.191.11:8000
```

### Where to get each value

#### `MICROSOFT_CLIENT_ID`

This is used for Microsoft 365 / OneDrive sign-in.

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory → App registrations**
3. Open the app registration for Community Curator
4. Copy the **Application (client) ID**

> Note: You must be added as an approved user before Microsoft sign-in will work.
> Email zcabyka@ucl.ac.uk with your Microsoft account email to be added.

#### `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

These are used for Google Drive sign-in.

1. Go to https://console.cloud.google.com
2. Navigate to **APIs & Services → Credentials**
3. Open the OAuth 2.0 Client for Community Curator
4. Copy the **Client ID** and **Client Secret**

> Note: You must be added as a test user before Google sign-in will work.
> Email zcabyka@ucl.ac.uk with your Google account email to be added.

#### `AZURE_VM_URL`

This is already set correctly in the example — leave it as:

```
AZURE_VM_URL=http://20.153.191.11:8000
```

The app backend and messaging engine are both running on this server. No local
Python setup is required.

---

## Step 4 — Run the App

```bash
npm start
```

The Community Curator window will open. You will be prompted to register or sign in
using the app's own account system (separate from Microsoft/Google).

---

## Step 5 — Create an Account

On first launch:

1. Click **Sign Up**
2. Enter a username and password of your choice
3. Click **Register**
4. You will be signed in automatically

On future launches, use **Sign In** with the same credentials.

---

## Optional Integrations

These are not required to run the app but unlock additional features:

### Microsoft 365 / OneDrive

Click **Connect Microsoft** in the Settings page. This enables:
- Browsing and attaching OneDrive files to scheduled messages

You must be on the approved users list first — email zcabyka@ucl.ac.uk.

### Google Drive

Click **Connect Google Drive** in the Settings page. This enables:
- Browsing and attaching Google Drive files to scheduled messages

You must be added as a test user first — email zcabyka@ucl.ac.uk.

---

## Packaging the App (for distribution)

To build a standalone installer:

```bash
npm run make
```

The output will be in the `out/` folder. On Windows this produces a Squirrel installer.

> Important: Make sure the `.env` file is present and filled in before running
> `npm run make`, as the credentials are loaded at startup.

---

## Troubleshooting

**The app opens but shows a connection error**
- Check that your machine has internet access — the app connects to a remote server at `20.153.191.11`

**Microsoft sign-in fails with "not authorised"**
- Your account has not been added to the approved users list yet. Email zcabyka@ucl.ac.uk with your Microsoft account email.

**Google sign-in fails with "access blocked"**
- Your account has not been added as a test user. Email zcabyka@ucl.ac.uk with your Google account email.

**The app does not start after `npm start`**
- Make sure `.env` exists in the project root (not just `.env.example`)
- Make sure you ran `npm install` first

**Tray icon shows as the default Electron icon**
- This can happen if the app is packaged without the icon asset. Contact zcabyka@ucl.ac.uk for a pre-built installer.
