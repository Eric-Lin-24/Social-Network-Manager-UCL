// ============================================
// COMMUNITY CURATOR - Main Application Entry Point
// Orchestrates initialization and event listeners
// ============================================

// ============================================
// AUTHENTICATION EVENT LISTENERS
// ============================================

// Check if electronAPI exists (it won't in browser testing)
if (typeof window.electronAPI !== 'undefined') {
  // Microsoft authentication events
  window.electronAPI.onAuthSuccess(() => {
    console.log('Authentication successful - checking status');
    MicrosoftGraphAPI.checkAuthentication();
  });

  window.electronAPI.onAuthError((error) => {
    console.error('Authentication error:', error);
    showNotification('Authentication failed: ' + error, 'error');
  });

  // Google authentication events
  window.electronAPI.onGoogleAuthSuccess((data) => {
    console.log('Google authentication successful:', data);
    AppState.googleDriveConnected = true;
    AppState.googleDriveEmail = data.email;
    showNotification(`Connected to Google Drive: ${data.email}`, 'success');
    renderApp();
  });

  window.electronAPI.onGoogleAuthError((error) => {
    console.error('Google authentication error:', error);
    showNotification('Google authentication failed: ' + error, 'error');
  });
} else {
  console.warn('electronAPI not available - running in browser mode');
}

// ============================================
// INITIALIZATION HELPERS
// ============================================

/**
 * Initialize subscribed chats from Azure VM
 */
async function initializeSubscribedChats() {
  // Load saved Azure VM URL from localStorage
  const savedUrl = localStorage.getItem('azureVmUrl');
  if (savedUrl) {
    AppState.azureVmUrl = savedUrl;
  }

  try {
    await AzureVMAPI.fetchSubscribedChats();
    console.log(`Loaded ${AppState.subscribedChats.length} subscribed chats`);
  } catch (error) {
    console.warn('Could not fetch subscribed chats:', error.message);
  }
}


// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Close the modal
 */
function closeModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
  }
}

/**
 * Show a modal
 * @param {string} type - Modal type
 */
function showModal(type) {
  switch (type) {
    case 'newMessage':
      navigateTo('scheduleMessage');
      return;
    default:
      console.warn('Unknown modal type:', type);
      return;
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ============================================
// APP STARTUP
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Community Curator starting...');

  // Initialize theme
  if (typeof initializeTheme === 'function') {
    initializeTheme();
  }

  // Always show login screen on startup - no persistent sessions
  console.log('⚠️ Please sign in to continue');
  renderLoginScreen();
});

// Export to global scope
if (typeof window !== 'undefined') {
  window.closeModal = closeModal;
  window.showModal = showModal;
  window.initializeSubscribedChats = initializeSubscribedChats;
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Restore the main app layout (sidebar + header + content area)
 * Called after successful login
 */
function restoreAppLayout() {
  const appContainer = document.querySelector('.app-layout') || document.querySelector('.app-container') || document.body;

  appContainer.innerHTML = `
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">Curator</span>
          <span class="brand-tagline">Community Platform</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <span class="nav-section-title">Main Menu</span>

        <button class="nav-item active" data-view="dashboard" onclick="navigateTo('dashboard')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>Dashboard</span>
        </button>

        <button class="nav-item" data-view="documents" onclick="navigateTo('documents')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span>Documents</span>
        </button>

        <button class="nav-item" data-view="scheduling" onclick="navigateTo('scheduling')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Messages</span>
          <span class="nav-badge" id="message-badge" style="display: none;">0</span>
        </button>

        <button class="nav-item" data-view="calendar" onclick="navigateTo('calendar')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Calendar</span>
        </button>

        <span class="nav-section-title">System</span>

        <button class="nav-item" data-view="settings" onclick="navigateTo('settings')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card" id="user-card" onclick="navigateTo('settings')">
          <div class="user-avatar" id="user-avatar">?</div>
          <div class="user-info">
            <div class="user-name" id="user-name">Not Connected</div>
            <div class="user-status" id="user-status">
              <span>Click to connect</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <h1 class="page-title" id="view-title">Dashboard</h1>
          <p class="page-subtitle" id="view-subtitle">Welcome back! Here's your overview.</p>
        </div>
        <div class="header-right">
          <button class="icon-btn" id="notifications-btn" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>
      </header>

      <div class="scroll-area" id="content">
        <!-- Dynamic content will be rendered here -->
      </div>
    </main>
  `;

  console.log('✓ App layout restored');
}

/**
 * Render the login/signup screen
 */
function renderLoginScreen() {
  const appContainer = document.querySelector('.app-layout') || document.querySelector('.app-container') || document.body;
  appContainer.innerHTML = `
    <div class="login-screen">
      <div class="login-container">
        <div class="login-header">
          <div class="logo-container">
            <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="C icon with document stack">
              <defs>
                <!-- Background - pure dark blue, no green -->
                <radialGradient id="bgGrad" cx="35%" cy="30%" r="85%">
                  <stop offset="0%" stop-color="#1e3a5f"/>
                  <stop offset="60%" stop-color="#142942"/>
                  <stop offset="100%" stop-color="#0a1929"/>
                </radialGradient>
                <!-- Main C gradient - removed green tints -->
                <linearGradient id="cGrad" x1="220" y1="760" x2="820" y2="260" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#3d9ff5"/>
                  <stop offset="0.55" stop-color="#5eb8ff"/>
                  <stop offset="1" stop-color="#7fcbff"/>
                </linearGradient>
                <!-- Inner/secondary C gradient -->
                <linearGradient id="cGrad2" x1="260" y1="760" x2="780" y2="300" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#3388dd"/>
                  <stop offset="0.6" stop-color="#4ea9f5"/>
                  <stop offset="1" stop-color="#6bbfff"/>
                </linearGradient>
                <!-- Subtle shadow -->
                <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000" flood-opacity="0.35"/>
                </filter>
                <!-- Document shadow -->
                <filter id="docShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.2"/>
                </filter>
                <!-- Translucent blue document fill -->
                <linearGradient id="docFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#e6f2ff" stop-opacity="0.7"/>
                  <stop offset="1" stop-color="#cce5ff" stop-opacity="0.6"/>
                </linearGradient>
              </defs>
              <!-- Rounded square background -->
              <rect x="64" y="64" width="896" height="896" rx="180" fill="url(#bgGrad)"/>
              <!-- Optional subtle inner border -->
              <rect x="92" y="92" width="840" height="840" rx="165" fill="none" stroke="#2B5A9A" stroke-opacity="0.22" stroke-width="3"/>
              <!-- Big "C" made from stroked arcs (modern, no glow) -->
              <g filter="url(#softShadow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <!-- Outer C -->
                <path
                  d="M 760 300
                     A 310 310 0 1 0 760 724"
                  stroke="url(#cGrad)"
                  stroke-width="120"/>
                <!-- Inner accent C -->
                <path
                  d="M 720 340
                     A 270 270 0 1 0 720 684"
                  stroke="url(#cGrad2)"
                  stroke-width="74"
                  stroke-opacity="0.92"/>
                <!-- Thin dark separation stroke (gives that layered feel) -->
                <path
                  d="M 690 365
                     A 245 245 0 1 0 690 659"
                  stroke="#061835"
                  stroke-width="18"
                  stroke-opacity="0.55"/>
              </g>
              <!-- Document stack - centered inside the C -->
              <g filter="url(#docShadow)">
                <!-- back sheet -->
                <rect x="492" y="402" width="180" height="220" rx="20" fill="#5595d9" fill-opacity="0.35"/>
                <!-- middle sheet -->
                <rect x="472" y="417" width="180" height="220" rx="20" fill="#6ba5e5" fill-opacity="0.45"/>
                <!-- front sheet -->
                <path
                  d="M 452 434
                     H 600
                     Q 630 434 630 464
                     V 622
                     Q 630 652 600 652
                     H 472
                     Q 452 652 452 632
                     V 454
                     Q 452 434 472 434
                     Z"
                  fill="url(#docFill)"/>
                <!-- folded corner -->
                <path
                  d="M 570 434
                     H 600
                     Q 630 434 630 464
                     V 494
                     H 600
                     Q 570 494 570 464
                     Z"
                  fill="#b8d9f7" fill-opacity="0.5"/>
                <!-- small outline for crispness -->
                <path
                  d="M 452 434
                     H 600
                     Q 630 434 630 464
                     V 622
                     Q 630 652 600 652
                     H 472
                     Q 452 652 452 632
                     V 454
                     Q 452 434 472 434
                     Z"
                  fill="none" stroke="#4a8acc" stroke-opacity="0.4" stroke-width="2"/>
              </g>
            </svg>
          </div>
          <h1 class="login-title">Community Curator</h1>
          <p class="login-subtitle">Social Network Manager</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" onclick="showAuthTab('signin')">Sign In</button>
          <button class="auth-tab" onclick="showAuthTab('signup')">Sign Up</button>
        </div>

        <!-- Sign In Form -->
        <div id="signin-form" class="auth-form active">
          <h2 class="auth-heading">Welcome Back</h2>
          <p class="auth-description">Sign in to your account to continue</p>

          <form onsubmit="handleSignIn(event)">
            <div class="form-group">
              <label for="signin-username">Username</label>
              <input
                type="text"
                id="signin-username"
                name="username"
                required
                placeholder="Enter your username"
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="signin-password">Password</label>
              <input
                type="password"
                id="signin-password"
                name="password"
                required
                placeholder="Enter your password"
                autocomplete="current-password"
              />
            </div>

            <div id="signin-error" class="auth-error hidden"></div>

            <button type="submit" class="auth-button" id="signin-button">
              <span>Sign In</span>
            </button>
          </form>
        </div>

        <!-- Sign Up Form -->
        <div id="signup-form" class="auth-form">
          <h2 class="auth-heading">Create Account</h2>
          <p class="auth-description">Sign up to start managing your community</p>

          <form onsubmit="handleSignUp(event)">
            <div class="form-group">
              <label for="signup-username">Username</label>
              <input
                type="text"
                id="signup-username"
                name="username"
                required
                placeholder="Choose a username"
                autocomplete="username"
                minlength="3"
              />
            </div>

            <div class="form-group">
              <label for="signup-password">Password</label>
              <input
                type="password"
                id="signup-password"
                name="password"
                required
                placeholder="Choose a password"
                autocomplete="new-password"
                minlength="6"
              />
            </div>

            <div class="form-group">
              <label for="signup-password-confirm">Confirm Password</label>
              <input
                type="password"
                id="signup-password-confirm"
                name="password_confirm"
                required
                placeholder="Confirm your password"
                autocomplete="new-password"
                minlength="6"
              />
            </div>

            <div id="signup-error" class="auth-error hidden"></div>

            <button type="submit" class="auth-button" id="signup-button">
              <span>Sign Up</span>
            </button>
          </form>
        </div>

        <div class="login-footer">
          <p class="footer-title">Open Source</p>
          <p class="footer-subtitle">Built for UCL & Charities</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Switch between sign in and sign up tabs
 */
function showAuthTab(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  tabs.forEach(t => t.classList.remove('active'));
  forms.forEach(f => f.classList.remove('active'));

  const activeTab = document.querySelector(`.auth-tab[onclick*="${tab}"]`);
  const activeForm = document.getElementById(`${tab}-form`);

  if (activeTab) activeTab.classList.add('active');
  if (activeForm) activeForm.classList.add('active');

  // Clear any error messages
  document.querySelectorAll('.auth-error').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
}

/**
 * Handle sign in form submission
 */
/**
 * Handle sign in form submission
 */
async function handleSignIn(event) {
  event.preventDefault();

  const button = document.getElementById('signin-button');
  const errorDiv = document.getElementById('signin-error');
  const form = event.target;

  const username = form.username.value.trim();
  const password = form.password.value;

  if (!username || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Show loading state
  button.disabled = true;
  button.innerHTML = '<span>Signing in.</span>';
  errorDiv.classList.add('hidden');

  try {
    console.log('🔐 Attempting sign in for user:', username);

    const response = await fetch(`${AppState.authenticationUrl}/sign-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    if (!response.ok) {
      let errorMessage = 'Sign in failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✓ Sign in successful:', data);
    console.log('✓ Response data:', JSON.stringify(data, null, 2));

    // Save user data in memory only (not persisted)
    // The backend returns 'uuid' field, not 'user_id'
    AppState.userId = data.uuid || data.user_id || data.id; // Support multiple field names for compatibility
    AppState.username = data.username;

    console.log('✓ User logged in:', AppState.username);
    console.log('✓ User ID set to:', AppState.userId);

    // ============================================
    // RESTORE SAVED INTEGRATIONS FOR THIS USER
    // ============================================
    console.log('\n🔍 Checking for saved integrations for user:', AppState.userId);

    // ----------------------------
    // Microsoft (OneDrive)
    // ----------------------------
    const userMsTokenKey = `ms_token_${AppState.userId}`;
    const userMsProfileKey = `ms_profile_${AppState.userId}`;
    const savedMsToken = localStorage.getItem(userMsTokenKey);
    const savedMsProfile = localStorage.getItem(userMsProfileKey);

    if (savedMsToken && savedMsProfile) {
      console.log('✅ Found saved Microsoft credentials for this user');
      AppState.accessToken = savedMsToken;
      AppState.userProfile = JSON.parse(savedMsProfile);
      AppState.isAuthenticated = true;
      console.log('   → Microsoft account:', AppState.userProfile.email);
      console.log('   → Microsoft credentials restored');
    } else {
      console.log('ℹ️  No saved Microsoft credentials for this user');
    }

    // ----------------------------
    // Google Drive
    // ----------------------------
    // Instead of only restoring the email string, try a real auth check
    // (this will also enforce mismatch protection).
    if (typeof window.GoogleDriveAPI !== 'undefined' && typeof GoogleDriveAPI.checkAuthentication === 'function') {
      try {
        const ok = await GoogleDriveAPI.checkAuthentication();
        if (ok) {
          console.log('✅ Google Drive session active for this user');
          console.log('   → Google account:', AppState.googleDriveEmail);
        } else {
          console.log('ℹ️  No active Google Drive session for this user');
        }
      } catch (e) {
        console.warn('ℹ️  GoogleDriveAPI.checkAuthentication() failed:', e?.message || e);
        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';
      }
    } else {
      // Fallback to your previous behavior if GoogleDriveAPI isn't loaded for some reason
      const userGoogleEmailKey = `google_email_${AppState.userId}`;
      const savedGoogleEmail = localStorage.getItem(userGoogleEmailKey);

      if (savedGoogleEmail) {
        console.log('✅ Found saved Google Drive connection for this user');
        AppState.googleDriveConnected = true;
        AppState.googleDriveEmail = savedGoogleEmail;
        console.log('   → Google account:', savedGoogleEmail);
        console.log('   → Google Drive credentials restored (email-only fallback)');
      } else {
        console.log('ℹ️  No saved Google Drive credentials for this user');
      }
    }

    // Initialize app
    if (typeof initializeSubscribedChats === 'function') {
      await initializeSubscribedChats();
    }

    if (AppState.azureVmUrl && typeof AzureVMAPI !== 'undefined' && AzureVMAPI.startMessagePolling) {
      AzureVMAPI.startMessagePolling(30000);
    }

    // Restore the main app layout before rendering
    restoreAppLayout();
    renderApp();

  } catch (error) {
    console.error('Sign in error:', error);
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
    button.disabled = false;
    button.innerHTML = '<span>Sign In</span>';
  }
}


/**
 * Handle sign up form submission
 */
async function handleSignUp(event) {
  event.preventDefault();

  const button = document.getElementById('signup-button');
  const errorDiv = document.getElementById('signup-error');
  const form = event.target;

  const username = form.username.value.trim();
  const password = form.password.value;
  const passwordConfirm = form.password_confirm.value;

  if (!username || !password || !passwordConfirm) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (password !== passwordConfirm) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Show loading state
  button.disabled = true;
  button.innerHTML = '<span>Creating account...</span>';
  errorDiv.classList.add('hidden');

  try {
    console.log('📝 Attempting sign up for user:', username);

    const response = await fetch(`${AppState.authenticationUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    if (!response.ok) {
      let errorMessage = 'Sign up failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✓ Sign up successful:', data);

    // Show success message and redirect to sign in
    if (typeof showNotification === 'function') {
      showNotification('Account created successfully! Please sign in with your credentials.', 'success');
    }

    // Reset the form
    form.reset();

    // Switch to sign-in tab after a brief delay
    setTimeout(() => {
      showAuthTab('signin');
      // Pre-fill the username in the sign-in form
      document.getElementById('signin-username').value = username;
      button.disabled = false;
      button.innerHTML = '<span>Sign Up</span>';
    }, 1500);

  } catch (error) {
    console.error('Sign up error:', error);
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
    button.disabled = false;
    button.innerHTML = '<span>Sign Up</span>';
  }
}

/**
 * Handle logout - Clear user session and return to login screen
 */
function handleLogout() {
  // Clear main-process user context + any in-memory Google session
  if (window.electronAPI?.clearActiveUser) {
    window.electronAPI.clearActiveUser();
  }
  if (window.electronAPI?.googleLogout) {
    window.electronAPI.googleLogout();
  }

  // Clear user data from AppState
  AppState.userId = null;
  AppState.username = null;
  AppState.customAuthToken = null;

  // Also clear Microsoft and Google integrations (they are user-specific)
  AppState.isAuthenticated = false;
  AppState.accessToken = null;
  AppState.userProfile = null;
  AppState.googleDriveConnected = false;
  AppState.googleDriveEmail = '';

  // Clear other data
  AppState.documents = [];
  AppState.scheduledMessages = [];
  AppState.subscribedChats = [];

  console.log('✓ User logged out');

  // Show success message
  if (typeof showNotification === 'function') {
    showNotification('Logged out successfully', 'success');
  }

  // Return to login screen
  setTimeout(() => {
    renderLoginScreen();
  }, 500);
}

// Export auth functions to global scope
if (typeof window !== 'undefined') {
  window.restoreAppLayout = restoreAppLayout;
  window.renderLoginScreen = renderLoginScreen;
  window.showAuthTab = showAuthTab;
  window.handleSignIn = handleSignIn;
  window.handleSignUp = handleSignUp;
  window.handleLogout = handleLogout;
}
