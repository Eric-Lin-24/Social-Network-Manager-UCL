// ============================================
// MICROSOFT GRAPH API (OneDrive)
// ============================================

const MicrosoftGraphAPI = {
  baseUrl: 'https://graph.microsoft.com/v1.0',

  async authenticateWithMicrosoft() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║   [RENDERER] MICROSOFT AUTH - User clicked login button   ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('\n🔍 CHECKING APP STATE:');
      console.log('   AppState.userId:', AppState.userId);
      console.log('   AppState.username:', AppState.username);
      console.log('   AppState object:', AppState);

      // Check if user is logged into the app first
      if (!AppState.userId) {
        console.error('❌ Cannot connect to Microsoft: No app user logged in');
        console.error('   → AppState.userId is:', AppState.userId);
        console.error('   → AppState.username is:', AppState.username);
        console.error('   → User must sign in to Community Curator first');
        showNotification('Please sign in to your Community Curator account first before connecting to Microsoft', 'error');
        return;
      }

      console.log('✅ App user logged in:', AppState.userId);
      console.log('📤 Calling window.electronAPI.login()...');

      const result = await window.electronAPI.login();

      if (result.success) {
        console.log('✅ Login request sent to main process');
        console.log('⏳ Browser should open shortly for user authentication');
        console.log('⏳ Waiting for "auth-success" event from main process...\n');
        showNotification('Authentication in progress...', 'info');
      }
    } catch (error) {
      console.error('\n╔════════════════════════════════════════════════════════════╗');
      console.error('║   [RENDERER] AUTHENTICATION ERROR                          ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      console.error('❌ Error:', error);
      showNotification('Login failed: ' + error.message, 'error');
    }
  },

  async checkAuthentication() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║   [RENDERER] CHECK AUTHENTICATION                          ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('⏰ Timestamp:', new Date().toISOString());

      if (token) {
        AppState.accessToken = token;
        AppState.isAuthenticated = true;
        await this.getUserProfile();
        console.log('User authenticated:', AppState.userProfile);
        showNotification('Successfully logged in!', 'success');
        renderApp();
      } else {
        console.log('ℹ️  No saved credentials found for this user');
      }

      // No saved credentials or they expired - check if main process has a fresh token (just logged in)
      console.log('\n📞 Requesting fresh token from main process...');
      console.log('   Calling window.electronAPI.getAccessToken()...');
      const token = await window.electronAPI.getAccessToken();

      if (!token) {
        console.log('\n❌ No token available from main process');
        console.log('   → User needs to click "Connect to Microsoft" to sign in\n');
        AppState.isAuthenticated = false;
        AppState.accessToken = null;
        AppState.userProfile = null;
        return false;
      }

      console.log('✅ Received fresh token from main process!');
      console.log('   Token (first 30 chars):', token.substring(0, 30) + '...');

      // Fresh token from main process - save it for this user
      AppState.accessToken = token;
      AppState.isAuthenticated = true;

      // Fetch user profile to verify token works
      try {
        console.log('\n📥 Fetching user profile from Microsoft Graph...');
        await this.getUserProfile();
        console.log('✅ User profile fetched successfully');
        console.log('   Email:', AppState.userProfile.email);
        console.log('   Display Name:', AppState.userProfile.displayName);
      } catch (profileError) {
        console.error('\n❌ Failed to fetch user profile');
        console.error('   Error:', profileError.message);
        console.error('   → Token may be invalid');
        AppState.isAuthenticated = false;
        AppState.accessToken = null;
        AppState.userProfile = null;
        showNotification('Microsoft authentication failed. Please try again.', 'error');
        return false;
      }

      // Save to user-specific storage
      console.log('\n💾 Saving credentials to localStorage...');
      console.log('   Token key:', userMsTokenKey);
      console.log('   Profile key:', userMsProfileKey);
      localStorage.setItem(userMsTokenKey, token);
      localStorage.setItem(userMsProfileKey, JSON.stringify(AppState.userProfile));
      console.log('   ✓ Credentials saved');

      console.log('\n🎉 MICROSOFT AUTHENTICATION SUCCESSFUL!');
      console.log('   User:', AppState.userId);
      console.log('   Email:', AppState.userProfile.email);
      console.log('   Profile saved to localStorage for future sessions\n');

      showNotification('Successfully connected to Microsoft!', 'success');

      // If user is on settings page, refresh it to show updated connection status
      if (AppState.currentView === 'settings') {
        renderSettings();
      }

      return true;
    } catch (error) {
      console.error('\n╔════════════════════════════════════════════════════════════╗');
      console.error('║   [RENDERER] AUTH CHECK ERROR                              ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      console.error('❌ Error:', error);
      AppState.isAuthenticated = false;
      AppState.accessToken = null;
      AppState.userProfile = null;
      return false;
    }
  },

  async logout() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║   [RENDERER] MICROSOFT LOGOUT                              ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('🚪 User requested logout');
      console.log('📤 Calling window.electronAPI.logout()...');

      await window.electronAPI.logout();

      // Clear user-specific Microsoft auth
      if (AppState.userId) {
        const userMsTokenKey = `ms_token_${AppState.userId}`;
        const userMsProfileKey = `ms_profile_${AppState.userId}`;
        console.log('🧹 Clearing localStorage...');
        console.log('   Removing:', userMsTokenKey);
        console.log('   Removing:', userMsProfileKey);
        localStorage.removeItem(userMsTokenKey);
        localStorage.removeItem(userMsProfileKey);
      }

      AppState.isAuthenticated = false;
      AppState.accessToken = null;
      AppState.userProfile = null;
      AppState.documents = [];

      console.log('✅ Logout successful');
      console.log('   → All credentials cleared\n');
      showNotification('Disconnected from Microsoft', 'success');
      renderApp();
    } catch (error) {
      console.error('\n❌ Logout error:', error);
      showNotification('Logout failed', 'error');
    }
  },

  async graphFetch(path, options = {}) {
    const token = await window.electronAPI.getAccessToken();
    if (!token) {
      throw new Error('No access token available – please sign in');
    }

    const url = this.baseUrl + path;
    const fetchOptions = Object.assign({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }, options);

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      let bodyText = await res.text();
      let parsed = bodyText;
      try { parsed = JSON.parse(bodyText); } catch (_) {}

      if (res.status === 401) {
        // Token expired - clear saved credentials
        if (AppState.userId) {
          localStorage.removeItem(`ms_token_${AppState.userId}`);
          localStorage.removeItem(`ms_profile_${AppState.userId}`);
        }
        AppState.isAuthenticated = false;
        AppState.accessToken = null;
        AppState.userProfile = null;

        const err = new Error('Unauthorized: Your session has expired. Please sign in again.');
        err.status = res.status;
        err.body = parsed;
        throw err;
      }

      const errorMessage = (parsed && parsed.error && parsed.error.message) ? parsed.error.message.toLowerCase() : '';
      if (errorMessage.includes('admin') && errorMessage.includes('consent')) {
        const err = new Error('Admin consent required: This app needs administrator approval.');
        err.status = res.status;
        err.body = parsed;
        err.needsAdminConsent = true;
        throw err;
      }

      const err = new Error(`Microsoft Graph request failed: ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.body = parsed;
      throw err;
    }

    return res.json();
  },

  async getUserProfile() {
    try {
      const profile = await this.graphFetch('/me');
      AppState.userProfile = {
        name: profile.displayName || profile.userPrincipalName,
        email: profile.mail || profile.userPrincipalName
      };

      return AppState.userProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },


  async getOneDriveFiles() {
    if (!AppState.isAuthenticated) {
      console.log('Not authenticated');
      return [];
    }

    try {
      const path = '/me/drive/root/children';
      const data = await this.graphFetch(path);

      return (data.value || []).map(file => ({
        id: file.id,
        title: file.name,
        content: file.name,
        source: 'onedrive',
        created_at: file.createdDateTime,
        updated_at: file.lastModifiedDateTime,
        webUrl: file.webUrl,
        size: file.size,
        mimeType: file.file ? file.file.mimeType : 'folder'
      }));
    } catch (error) {
      console.error('Error fetching OneDrive files:', error);

      const message = error.needsAdminConsent
        ? 'Admin consent required. Please contact your IT administrator.'
        : (error && error.body && error.body.error && error.body.error.message)
        ? error.body.error.message
        : error.message || String(error);

      showNotification('Failed to fetch OneDrive files: ' + message, 'error');
      return [];
    }
  }
};

// Export to global scope
if (typeof window !== 'undefined') {
  window.MicrosoftGraphAPI = MicrosoftGraphAPI;
}