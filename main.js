const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { PublicClientApplication, CachePersistence } = require('@azure/msal-node');
const SimpleStore = require('./simpleStore');
const http = require('http');
const { google } = require('googleapis');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config();

// ============================================
// FIX WINDOWS CACHE PERMISSION ERRORS
// ============================================
// Set custom cache path to avoid permission issues
app.setPath('userData', path.join(app.getPath('appData'), 'community-curator'));
app.setPath('cache', path.join(app.getPath('userData'), 'Cache'));
app.setPath('sessionData', path.join(app.getPath('userData'), 'Session'));

// Disable hardware acceleration to fix GPU errors on Windows
app.disableHardwareAcceleration();

// Additional command line switches to reduce cache errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '1');

const store = new SimpleStore();
let authServer = null;
let googleAuthServer = null;
let googleTokens = null;


// MSAL Configuration with persistent cache
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || 'd4769f4f-14be-444b-9934-f859662bc020',
    authority: 'https://login.microsoftonline.com/organizations'
  },
  cache: {
    cachePlugin: {
      beforeCacheAccess: async (cacheContext) => {
        // Load cache from file
        const cacheLocation = path.join(app.getPath('userData'), 'msal-cache.json');
        if (fs.existsSync(cacheLocation)) {
          const cacheData = fs.readFileSync(cacheLocation, 'utf-8');
          cacheContext.tokenCache.deserialize(cacheData);
        }
      },
      afterCacheAccess: async (cacheContext) => {
        // Save cache to file
        if (cacheContext.cacheHasChanged) {
          const cacheLocation = path.join(app.getPath('userData'), 'msal-cache.json');
          fs.writeFileSync(cacheLocation, cacheContext.tokenCache.serialize());
        }
      }
    }
  }
};

const pca = new PublicClientApplication(msalConfig);
const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = [
  'User.Read',
  'Files.ReadWrite',
  'offline_access'
];

// Google OAuth Configuration
// Credentials loaded from .env file - see .env.example
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = 'http://localhost:3001';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Load stored tokens on startup
async function loadStoredTokens() {
  try {
    console.log('Loading stored tokens...');

    // Check for Microsoft/OneDrive cached accounts
    try {
      const cache = pca.getTokenCache();
      const accounts = await cache.getAllAccounts();

      if (accounts && accounts.length > 0) {
        console.log('✓ Found cached Microsoft account:', accounts[0].username);
        console.log('✓ Microsoft tokens available in MSAL cache');
      } else {
        console.log('No cached Microsoft accounts found');
      }
    } catch (error) {
      console.log('No cached Microsoft accounts found');
    }

    // Load Google tokens
    const storedGoogleAccessToken = store.get('googleAccessToken');
    const storedGoogleRefreshToken = store.get('googleRefreshToken');
    const storedGoogleTokenExpiry = store.get('googleTokenExpiry');
    const googleUserInfo = store.get('googleUserInfo');

    if (storedGoogleAccessToken && storedGoogleRefreshToken) {
      // ✅ Restore oauth2Client credentials
      oauth2Client.setCredentials({
        access_token: storedGoogleAccessToken,
        refresh_token: storedGoogleRefreshToken,
        expiry_date: storedGoogleTokenExpiry
      });

      // ✅ Restore googleTokens variable (used by download handler)
      googleTokens = {
        access_token: storedGoogleAccessToken,
        refresh_token: storedGoogleRefreshToken,
        expires_at: storedGoogleTokenExpiry,
        scope: googleUserInfo?.scope,
        token_type: 'Bearer'
      };

      console.log('✓ Found stored Google account:', googleUserInfo?.email || 'Unknown');
      console.log('✓ Google tokens loaded successfully');
    } else {
      console.log('No stored Google tokens found');
    }

  } catch (error) {
    console.error('Error loading tokens:', error);
  }
}


// Create a local HTTP server to handle OAuth redirect
function createAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:3000`);

      if (url.pathname === '/') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (code) {
          // Success page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Microsoft Account Connected</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  background: linear-gradient(135deg, #0078d4 0%, #00bcf2 100%);
                  overflow: hidden;
                }
                
                .container {
                  text-align: center;
                  background: white;
                  padding: 60px 50px;
                  border-radius: 24px;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                  max-width: 480px;
                  width: 90%;
                  position: relative;
                  animation: slideUp 0.5s ease-out;
                }
                
                @keyframes slideUp {
                  from { transform: translateY(30px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
                
                @keyframes checkmark {
                  0% { transform: scale(0); opacity: 0; }
                  50% { transform: scale(1.1); }
                  100% { transform: scale(1); opacity: 1; }
                }
                
                @keyframes pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                }
                
                .success-icon {
                  width: 100px;
                  height: 100px;
                  margin: 0 auto 30px;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
                  animation: checkmark 0.6s ease-out 0.2s both;
                }
                
                .checkmark {
                  width: 50px;
                  height: 50px;
                }
                
                .brand-logo {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 12px;
                  margin-bottom: 24px;
                  animation: fadeIn 0.8s ease-out 0.4s both;
                }
                
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                
                .microsoft-icon {
                  width: 32px;
                  height: 32px;
                  background: linear-gradient(135deg, #f35325 0%, #f35325 50%, #81bc06 50%, #81bc06 100%);
                  border-radius: 4px;
                }
                
                h1 { 
                  color: #1f2937;
                  font-size: 32px;
                  font-weight: 700;
                  margin: 0 0 12px 0;
                  animation: fadeIn 0.8s ease-out 0.5s both;
                }
                
                .subtitle {
                  color: #0078d4;
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  animation: fadeIn 0.8s ease-out 0.6s both;
                }
                
                p { 
                  color: #6b7280;
                  font-size: 15px;
                  line-height: 1.6;
                  margin: 0;
                  animation: fadeIn 0.8s ease-out 0.7s both;
                }
                
                .features {
                  margin-top: 30px;
                  padding-top: 30px;
                  border-top: 1px solid #e5e7eb;
                  animation: fadeIn 0.8s ease-out 0.8s both;
                }
                
                .feature-item {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  margin-bottom: 12px;
                  color: #4b5563;
                  font-size: 14px;
                }
                
                .feature-icon {
                  width: 20px;
                  height: 20px;
                  background: #dbeafe;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #0078d4;
                  font-size: 12px;
                  flex-shrink: 0;
                }
                
                .countdown {
                  margin-top: 24px;
                  padding: 12px 24px;
                  background: #f3f4f6;
                  border-radius: 12px;
                  color: #6b7280;
                  font-size: 13px;
                  animation: fadeIn 0.8s ease-out 0.9s both;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success-icon">
                  <svg class="checkmark" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-16"/>
                  </svg>
                </div>
                
                <div class="brand-logo">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect width="10" height="10" fill="#F35325"/>
                    <rect x="11" width="10" height="10" fill="#81BC06"/>
                    <rect y="11" width="10" height="10" fill="#05A6F0"/>
                    <rect x="11" y="11" width="10" height="10" fill="#FFBA08"/>
                  </svg>
                  <span style="color: #0078d4; font-weight: 600; font-size: 16px;">Microsoft Account</span>
                </div>
                
                <h1>Successfully Connected!</h1>
                <p class="subtitle">OneDrive & SharePoint Ready</p>
                <p>Your Microsoft account has been authenticated. You can now access your OneDrive files and SharePoint documents directly from the app.</p>
                
                <div class="features">
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Access OneDrive files</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Browse SharePoint documents</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Secure authentication</span>
                  </div>
                </div>
                
                <div class="countdown">
                  This window will close automatically in <span id="timer">3</span> seconds...
                </div>
              </div>
              
              <script>
                let seconds = 3;
                const timerElement = document.getElementById('timer');
                
                const countdown = setInterval(() => {
                  seconds--;
                  timerElement.textContent = seconds;
                  
                  if (seconds <= 0) {
                    clearInterval(countdown);
                    window.close();
                  }
                }, 1000);
              </script>
            </body>
            </html>
          `);

          // Handle the auth code
          handleAuthCode(code).then(() => {
            setTimeout(() => {
              server.close();
              authServer = null;
            }, 3000);
          });
        } else if (error) {
          // Error page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Failed</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  max-width: 500px;
                }
                .error-icon {
                  width: 80px;
                  height: 80px;
                  margin: 0 auto 20px;
                  background: #ef4444;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .x-mark {
                  color: white;
                  font-size: 50px;
                  font-weight: bold;
                }
                h1 { color: #1f2937; margin: 0 0 10px 0; }
                p { color: #6b7280; margin: 0; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error-icon">
                  <span class="x-mark">✕</span>
                </div>
                <h1>Authentication Failed</h1>
                <p>${errorDescription || error || 'Unknown error occurred'}</p>
              </div>
              <script>
                setTimeout(() => window.close(), 5000);
              </script>
            </body>
            </html>
          `);

          BrowserWindow.getAllWindows()[0]?.webContents.send('auth-error', errorDescription || error);

          setTimeout(() => {
            server.close();
            authServer = null;
          }, 6000);
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(3000, 'localhost', () => {
      console.log('Auth server listening on http://localhost:3000');
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port 3000 already in use, trying to close existing server...');
        // Port is already in use, might be from a previous run
        setTimeout(() => {
          server.listen(3000, 'localhost', () => {
            resolve(server);
          });
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

// Create a local HTTP server to handle Google OAuth redirect
function createGoogleAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:3001`);

      if (url.pathname === '/') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (code) {
          // Success page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Google Drive Connected</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
                  overflow: hidden;
                }
                
                .container {
                  text-align: center;
                  background: white;
                  padding: 60px 50px;
                  border-radius: 24px;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                  max-width: 480px;
                  width: 90%;
                  position: relative;
                  animation: slideUp 0.5s ease-out;
                }
                
                @keyframes slideUp {
                  from { transform: translateY(30px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
                
                @keyframes checkmark {
                  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
                  50% { transform: scale(1.1) rotate(0deg); }
                  100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
                
                .success-icon {
                  width: 100px;
                  height: 100px;
                  margin: 0 auto 30px;
                  background: linear-gradient(135deg, #34a853 0%, #0f9d58 100%);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 10px 30px rgba(52, 168, 83, 0.4);
                  animation: checkmark 0.6s ease-out 0.2s both;
                }
                
                .checkmark {
                  width: 50px;
                  height: 50px;
                }
                
                .brand-logo {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 12px;
                  margin-bottom: 24px;
                  animation: fadeIn 0.8s ease-out 0.4s both;
                }
                
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                
                .google-drive-icon {
                  width: 32px;
                  height: 32px;
                }
                
                h1 { 
                  color: #1f2937;
                  font-size: 32px;
                  font-weight: 700;
                  margin: 0 0 12px 0;
                  animation: fadeIn 0.8s ease-out 0.5s both;
                }
                
                .subtitle {
                  color: #4285f4;
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  animation: fadeIn 0.8s ease-out 0.6s both;
                }
                
                p { 
                  color: #6b7280;
                  font-size: 15px;
                  line-height: 1.6;
                  margin: 0;
                  animation: fadeIn 0.8s ease-out 0.7s both;
                }
                
                .features {
                  margin-top: 30px;
                  padding-top: 30px;
                  border-top: 1px solid #e5e7eb;
                  animation: fadeIn 0.8s ease-out 0.8s both;
                }
                
                .feature-item {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  margin-bottom: 12px;
                  color: #4b5563;
                  font-size: 14px;
                }
                
                .feature-icon {
                  width: 20px;
                  height: 20px;
                  background: #e8f5e9;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #34a853;
                  font-size: 12px;
                  flex-shrink: 0;
                }
                
                .countdown {
                  margin-top: 24px;
                  padding: 12px 24px;
                  background: #f3f4f6;
                  border-radius: 12px;
                  color: #6b7280;
                  font-size: 13px;
                  animation: fadeIn 0.8s ease-out 0.9s both;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success-icon">
                  <svg class="checkmark" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-16"/>
                  </svg>
                </div>
                
                <div class="brand-logo">
                  <svg class="google-drive-icon" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span style="color: #4285f4; font-weight: 600; font-size: 16px;">Google Drive</span>
                </div>
                
                <h1>Successfully Connected!</h1>
                <p class="subtitle">Drive Access Enabled</p>
                <p>Your Google Drive account has been authenticated. You can now access and attach your Google Drive files directly from the app.</p>
                
                <div class="features">
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Browse your Drive files</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Attach files to messages</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6l3 3 5-6" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span>Secure OAuth authentication</span>
                  </div>
                </div>
                
                <div class="countdown">
                  This window will close automatically in <span id="timer">3</span> seconds...
                </div>
              </div>
              
              <script>
                let seconds = 3;
                const timerElement = document.getElementById('timer');
                
                const countdown = setInterval(() => {
                  seconds--;
                  timerElement.textContent = seconds;
                  
                  if (seconds <= 0) {
                    clearInterval(countdown);
                    window.close();
                  }
                }, 1000);
              </script>
            </body>
            </html>
          `);

          // Handle the auth code
          handleGoogleAuthCode(code).then(() => {
            setTimeout(() => {
              server.close();
              googleAuthServer = null;
            }, 3000);
          });
        } else if (error) {
          // Error page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Failed</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  max-width: 500px;
                }
                .error-icon {
                  width: 80px;
                  height: 80px;
                  margin: 0 auto 20px;
                  background: #ef4444;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .x-mark {
                  color: white;
                  font-size: 50px;
                  font-weight: bold;
                }
                h1 { color: #1f2937; margin: 0 0 10px 0; }
                p { color: #6b7280; margin: 0; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error-icon">
                  <span class="x-mark">✕</span>
                </div>
                <h1>Authentication Failed</h1>
                <p>${error || 'Unknown error occurred'}</p>
              </div>
              <script>
                setTimeout(() => window.close(), 5000);
              </script>
            </body>
            </html>
          `);

          BrowserWindow.getAllWindows()[0]?.webContents.send('google-auth-error', error);

          setTimeout(() => {
            server.close();
            googleAuthServer = null;
          }, 6000);
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(3001, 'localhost', () => {
      console.log('Google Auth server listening on http://localhost:3001');
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port 3001 already in use, trying to close existing server...');
        setTimeout(() => {
          server.listen(3001, 'localhost', () => {
            resolve(server);
          });
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  mainWindow.webContents.openDevTools();

  return mainWindow;
}

// ...existing code...

async function handleAuthCode(code) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         MICROSOFT AUTH - PROCESSING AUTH CODE             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('🔐 Authorization code received:', code.substring(0, 20) + '...');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    const tokenRequest = {
      code: code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI
    };

    console.log('\n📤 Sending token request to Microsoft...');
    console.log('   Scopes:', SCOPES);
    console.log('   Redirect URI:', REDIRECT_URI);

    const response = await pca.acquireTokenByCode(tokenRequest);

    console.log('\n✅ TOKEN EXCHANGE SUCCESSFUL!');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   TOKEN DETAILS                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ Account:', response.account.username);
    console.log('║ Home Account ID:', response.account.homeAccountId);
    console.log('║ Token Type:', response.tokenType);
    console.log('║ Access Token (first 30 chars):', response.accessToken.substring(0, 30) + '...');
    console.log('║ Token Expires:', new Date(response.expiresOn).toISOString());
    console.log('║ Scopes Granted:', response.scopes.join(', '));
    console.log('╚════════════════════════════════════════════════════════════╝');

    console.log('\n💾 Saving tokens to MSAL cache...');
    console.log('   Cache location:', path.join(app.getPath('userData'), 'msal-cache.json'));
    console.log('   ✓ Tokens cached via MSAL persistence plugin');

    console.log('\n📡 Notifying renderer process...');
    // Notify renderer process
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      console.log('   ✓ Main window found');
      console.log('   ✓ Sending "auth-success" event to renderer');
      mainWindow.webContents.send('auth-success');
      mainWindow.focus();
      console.log('   ✓ Window focused');
    } else {
      console.warn('   ⚠ No main window found!');
    }

    console.log('\n🎉 AUTHENTICATION COMPLETE!\n');
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║              AUTHENTICATION FAILED                         ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('❌ Error:', error.message);
    console.error('❌ Error Code:', error.errorCode);
    console.error('❌ Full Error:', error);
    BrowserWindow.getAllWindows()[0]?.webContents.send('auth-error', error.message);
  }
}

// Handle login request from renderer
ipcMain.handle('msal-login', async () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         MICROSOFT AUTH - LOGIN INITIATED                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('🚀 Login request received from renderer process');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    // Start the local auth server if not already running
    if (!authServer) {
      console.log('\n🌐 Starting local OAuth redirect server...');
      console.log('   Port: 3000');
      console.log('   Hostname: localhost');
      authServer = await createAuthServer();
      console.log('   ✓ Server started successfully');
    } else {
      console.log('\n🌐 Auth server already running on port 3000');
    }

    const authCodeUrlParams = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      prompt: 'select_account'
    };

    console.log('\n🔗 Generating Microsoft authorization URL...');
    console.log('   Scopes:', SCOPES);
    console.log('   Redirect URI:', REDIRECT_URI);
    console.log('   Prompt:', authCodeUrlParams.prompt);

    const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParams);

    console.log('   ✓ Authorization URL generated');
    console.log('   URL:', authCodeUrl.substring(0, 100) + '...');

    console.log('\n🌍 Opening user\'s default browser...');
    // Open in the user's default browser instead of Electron window
    const { shell } = require('electron');
    await shell.openExternal(authCodeUrl);

    console.log('   ✓ Browser opened successfully');
    console.log('\n⏳ Waiting for user to complete sign-in...');
    console.log('   (User will be redirected to http://localhost:3000 after login)');
    console.log('   (handleAuthCode will be called when redirect is received)\n');

    return { success: true };
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║              LOGIN INITIATION FAILED                       ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('❌ Error:', error.message);
    console.error('❌ Full Error:', error);

    // Clean up server on error
    if (authServer) {
      console.log('🧹 Cleaning up auth server...');
      authServer.close();
      authServer = null;
    }

    throw error;
  }
});

// Get stored access token (with silent refresh if expired)
ipcMain.handle('get-access-token', async () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      GET ACCESS TOKEN - Request from Renderer              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('📞 Renderer requested access token');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    // ✅ Query MSAL's cache for accounts instead of SimpleStore
    const cache = pca.getTokenCache();
    console.log('\n🔍 Checking MSAL token cache...');
    console.log('   Cache location:', path.join(app.getPath('userData'), 'msal-cache.json'));

    const accounts = await cache.getAllAccounts();

    if (!accounts || accounts.length === 0) {
      console.log('   ℹ️  NO CACHED ACCOUNTS FOUND');
      console.log('   → User needs to sign in first');
      console.log('   → Returning null to renderer\n');
      return null;
    }

    // Use the first account (or you could pick based on username/homeAccountId)
    const account = accounts[0];
    console.log('\n✅ Found cached account:');
    console.log('   Username:', account.username);
    console.log('   Home Account ID:', account.homeAccountId);
    console.log('   Environment:', account.environment);

    console.log('\n🔄 Attempting silent token acquisition...');
    console.log('   (Will use refresh token if access token expired)');

    // Try silent token acquisition with the cached account
    const response = await pca.acquireTokenSilent({
      account: account,
      scopes: SCOPES
    });

    console.log('\n✅ SILENT TOKEN ACQUISITION SUCCESSFUL!');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   TOKEN RETRIEVED                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ Access Token (first 30 chars):', response.accessToken.substring(0, 30) + '...');
    console.log('║ Token Type:', response.tokenType);
    console.log('║ Expires On:', new Date(response.expiresOn).toISOString());
    console.log('║ Scopes:', response.scopes.join(', '));
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n📤 Returning access token to renderer process\n');

    return response.accessToken;
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║         SILENT TOKEN ACQUISITION FAILED                    ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('❌ Error:', error.message);
    console.error('❌ Error Code:', error.errorCode);
    console.error('   → User will need to sign in again');
    console.error('   → Returning null to renderer\n');
    // If silent fails, return null to trigger interactive login
    return null;
  }
});

// Logout
ipcMain.handle('msal-logout', async () => {
  console.log('\n🚪 [Microsoft Auth] Logging out...');

  try {
    // ✅ Remove account from MSAL's cache
    const cache = pca.getTokenCache();
    const accounts = await cache.getAllAccounts();

    if (accounts && accounts.length > 0) {
      console.log(`   → Removing ${accounts.length} account(s) from cache...`);
      // Remove all accounts from cache
      for (const account of accounts) {
        console.log('   → Removing:', account.username);
        await cache.removeAccount(account);
      }
      console.log('   ✓ Microsoft accounts removed from cache');
    } else {
      console.log('   ℹ No accounts to remove');
    }

    // Clean up old SimpleStore entries (for backward compatibility)
    store.delete('accessToken');
    store.delete('account');

    console.log('   ✓ Logout complete\n');
    return true;
  } catch (error) {
    console.error('   ❌ Logout error:', error.message);
    return false;
  }
});

// Download OneDrive file
ipcMain.handle('download-onedrive-file', async (event, { fileId, fileName }) => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           ONEDRIVE FILE DOWNLOAD REQUEST                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('File ID:', fileId);
  console.log('File Name:', fileName);

  try {
    // Get access token via MSAL
    const cache = pca.getTokenCache();
    const accounts = await cache.getAllAccounts();

    if (!accounts || accounts.length === 0) {
      throw new Error('No Microsoft account signed in. Please sign in first.');
    }

    const account = accounts[0];
    const response = await pca.acquireTokenSilent({
      account: account,
      scopes: SCOPES
    });

    const accessToken = response.accessToken;
    console.log('✓ Access token acquired for download');

    // Download file content from OneDrive
    // The /content endpoint returns a 302 redirect to a pre-authenticated URL
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
    console.log('Fetching from:', url);

    // First request with redirect: 'manual' to get the redirect URL
    const redirectResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      redirect: 'manual'
    });

    let downloadUrl = url;
    let downloadResponse;

    // Check if we got a redirect (302)
    if (redirectResponse.status === 302 || redirectResponse.status === 301) {
      downloadUrl = redirectResponse.headers.get('location');
      console.log('Got redirect to:', downloadUrl);

      // Follow the redirect WITHOUT the Authorization header (pre-authenticated URL)
      downloadResponse = await fetch(downloadUrl);
    } else if (redirectResponse.ok) {
      // Some files might not redirect, use the response directly
      downloadResponse = redirectResponse;
    } else {
      const errorText = await redirectResponse.text();
      console.error('Initial request failed:', redirectResponse.status, errorText);
      throw new Error(`Download failed: ${redirectResponse.status} ${redirectResponse.statusText}`);
    }

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('Download failed:', downloadResponse.status, errorText);
      throw new Error(`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }

    // Get content type from response
    const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
    console.log('Content-Type:', contentType);

    const buffer = await downloadResponse.arrayBuffer();
    console.log('✓ File downloaded successfully, size:', buffer.byteLength, 'bytes');

    return {
      buffer: Array.from(new Uint8Array(buffer)),
      fileName: fileName,
      mimeType: contentType
    };
  } catch (error) {
    console.error('❌ OneDrive download error:', error.message);
    throw error;
  }
});

// ============================================
// GOOGLE OAUTH HANDLERS
// ============================================

async function handleGoogleAuthCode(code) {
  console.log('\n🔐 [Google Auth] Processing authorization code...');

  try {
    console.log('   → Exchanging auth code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('   ✓ Token exchange successful');

    // ✅ Store tokens in googleTokens variable
    googleTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type
    };

    // Store tokens in persistent storage
    store.set('googleAccessToken', tokens.access_token);
    store.set('googleRefreshToken', tokens.refresh_token);
    store.set('googleTokenExpiry', tokens.expiry_date);

    console.log('   → Fetching user profile...');
    // Get user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    store.set('googleUserInfo', {
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture
    });

    console.log('   ✓ Account:', userInfo.data.email);
    console.log('   ✓ Name:', userInfo.data.name);
    console.log('   ✓ Tokens cached in SimpleStore');
    console.log('   ✓ Cache persisted to: community-curator-store.json\n');

    // Notify renderer process
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('google-auth-success', {
        email: userInfo.data.email,
        name: userInfo.data.name
      });
      mainWindow.focus();
    }
  } catch (error) {
    console.error('\n❌ [Google Auth] Failed:', error.message);
    console.error('   Error details:', error);
    BrowserWindow.getAllWindows()[0]?.webContents.send('google-auth-error', error.message);
  }
}


// Handle Google login request from renderer
ipcMain.handle('google-login', async () => {
  console.log('\n🔓 [Google Auth] Starting login flow...');

  try {
    // Start the local auth server if not already running
    if (!googleAuthServer) {
      console.log('   → Starting local auth server on port 3001...');
      googleAuthServer = await createGoogleAuthServer();
    } else {
      console.log('   → Auth server already running');
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent'
    });

    console.log('   → Opening browser for user authentication...');
    console.log('   → Scopes requested:', GOOGLE_SCOPES.join(', '));

    // Open in the user's default browser
    const { shell } = require('electron');
    await shell.openExternal(authUrl);

    console.log('   ✓ Browser opened - waiting for user to complete sign-in...\n');
    return { success: true };
  } catch (error) {
    console.error('\n❌ [Google Auth] Login failed:', error.message);

    // Clean up server on error
    if (googleAuthServer) {
      googleAuthServer.close();
      googleAuthServer = null;
    }

    throw error;
  }
});



// Get stored Google access token (with refresh if expired)
ipcMain.handle('get-google-access-token', async () => {
  const accessToken = store.get('googleAccessToken');
  const refreshToken = store.get('googleRefreshToken');
  const expiry = store.get('googleTokenExpiry');

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Check if token is expired
  if (expiry && Date.now() >= expiry) {
    console.log('\n🔄 [Google Auth] Access token expired, refreshing...');
    try {
      // Refresh the token
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      store.set('googleAccessToken', credentials.access_token);
      store.set('googleTokenExpiry', credentials.expiry_date);

      console.log('   ✓ Token refresh successful\n');
      return credentials.access_token;
    } catch (error) {
      console.error('   ✗ Token refresh failed:', error.message);
      console.log('   ℹ User will need to sign in again\n');
      return null;
    }
  }

  return accessToken;
});

// Get Google user info
ipcMain.handle('get-google-user-info', async () => {
  return store.get('googleUserInfo') || null;
});

// Get Google Drive files
ipcMain.handle('get-google-drive-files', async () => {
  try {
    // Get access token directly from storage
    let accessToken = store.get('googleAccessToken');
    const refreshToken = store.get('googleRefreshToken');
    const expiry = store.get('googleTokenExpiry');

    if (!accessToken || !refreshToken) {
      return [];
    }

    // Check if token is expired and refresh if needed
    if (expiry && Date.now() >= expiry) {
      try {
        oauth2Client.setCredentials({
          refresh_token: refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update stored tokens
        store.set('googleAccessToken', credentials.access_token);
        store.set('googleTokenExpiry', credentials.expiry_date);

        accessToken = credentials.access_token;
      } catch (error) {
        console.log('Token refresh failed:', error.message);
        return [];
      }
    }

    // Set credentials and fetch files
    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      pageSize: 100,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, iconLink)',
      orderBy: 'modifiedTime desc'
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error fetching Google Drive files:', error);
    throw error;
  }
});

// Download Google Drive file
ipcMain.handle('download-google-drive-file', async (event, { fileId, fileName, mimeType }) => {
  // Get tokens from storage (like other handlers do)
  let accessToken = store.get('googleAccessToken');
  const refreshToken = store.get('googleRefreshToken');
  const expiry = store.get('googleTokenExpiry');

  if (!accessToken || !refreshToken) {
    throw new Error('No Google access token available. Please sign in to Google Drive.');
  }

  // Check if token is expired and refresh if needed
  if (expiry && Date.now() >= expiry) {
    console.log('\n🔄 [Google Drive Download] Access token expired, refreshing...');
    try {
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      store.set('googleAccessToken', credentials.access_token);
      store.set('googleTokenExpiry', credentials.expiry_date);

      accessToken = credentials.access_token;

      // Also update googleTokens variable for consistency
      googleTokens = {
        access_token: credentials.access_token,
        refresh_token: refreshToken,
        expires_at: credentials.expiry_date,
        token_type: 'Bearer'
      };

      console.log('   ✓ Token refresh successful\n');
    } catch (error) {
      console.error('   ✗ Token refresh failed:', error.message);
      throw new Error('Failed to refresh Google token. Please sign in again.');
    }
  }

  const googleWorkspaceTypes = {
    'application/vnd.google-apps.document': { mimeType: 'application/pdf', extension: '.pdf' },
    'application/vnd.google-apps.spreadsheet': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
    'application/vnd.google-apps.presentation': { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: '.pptx' },
    'application/vnd.google-apps.drawing': { mimeType: 'application/pdf', extension: '.pdf' }
  };

  const isGoogleWorkspace = googleWorkspaceTypes[mimeType];
  let url, exportMimeType, exportFileName;

  if (isGoogleWorkspace) {
    exportMimeType = isGoogleWorkspace.mimeType;
    const baseFileName = fileName.replace(/\.[^/.]+$/, '');
    exportFileName = baseFileName + isGoogleWorkspace.extension;
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
  } else {
    exportMimeType = mimeType;
    exportFileName = fileName;
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    buffer: Array.from(new Uint8Array(buffer)),
    fileName: exportFileName,
    mimeType: exportMimeType
  };
});


// Logout from Google
ipcMain.handle('google-logout', async () => {
  console.log('\n🚪 [Google Auth] Logging out...');

  const userInfo = store.get('googleUserInfo');
  if (userInfo?.email) {
    console.log('   → Removing account:', userInfo.email);
  }

  store.delete('googleAccessToken');
  store.delete('googleRefreshToken');
  store.delete('googleTokenExpiry');
  store.delete('googleUserInfo');
  oauth2Client.setCredentials({});

  console.log('   ✓ Google tokens removed from cache');
  console.log('   ✓ Logout complete\n');
  return true;
});

app.whenReady().then(() => {
  createWindow();
    loadStoredTokens();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
