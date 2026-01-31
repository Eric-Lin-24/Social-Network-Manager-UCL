// ============================================
// GOOGLE DRIVE API
// ============================================
// User-scoped Google Drive connection state stored in localStorage by AppState.userId.

const GoogleDriveAPI = {
  async authenticateWithGoogle() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║   [RENDERER] GOOGLE DRIVE AUTH - User clicked login button ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('   AppState.userId:', AppState.userId);
      console.log('   AppState.username:', AppState.username);

      // Must have an app user logged in, otherwise we cannot scope storage
      if (!AppState.userId) {
        showNotification(
          'Please sign in to your Community Curator account first before connecting to Google Drive',
          'error'
        );
        return;
      }

      const result = await window.electronAPI.googleLogin();

      if (result?.success) {
        console.log('✅ Google authentication window opened');
        showNotification('Google authentication in progress...', 'info');
      } else {
        console.warn('ℹ️ googleLogin() did not return success:', result);
      }
    } catch (error) {
      console.error('Google Drive login error:', error);
      showNotification('Google login failed: ' + error.message, 'error');
    }
  },

  async checkAuthentication() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   [RENDERER] GOOGLE DRIVE - CHECK AUTH (WITH RESTORE)      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('   AppState.userId:', AppState.userId);

    // If there is no logged-in app user, force-disconnect in UI.
    if (!AppState.userId) {
      console.log('❌ No AppState.userId -> cannot scope Google Drive auth.');
      AppState.googleDriveConnected = false;
      AppState.googleDriveEmail = '';
      return false;
    }

    const userGoogleEmailKey = `google_email_${AppState.userId}`;
    const userGoogleTokenKey = `google_token_${AppState.userId}`;

    // What we have saved for THIS app user
    const savedEmail = localStorage.getItem(userGoogleEmailKey);
    const savedTokenRaw = localStorage.getItem(userGoogleTokenKey);

    console.log('🔑 Google storage keys:', { userGoogleEmailKey, userGoogleTokenKey });
    console.log('📦 Saved email exists?', !!savedEmail, savedEmail ? `(email: ${savedEmail})` : '');
    console.log('📦 Saved token exists?', !!savedTokenRaw);

    try {
      // What the main process currently thinks (this is the real authority for API calls)
      let userInfo = await window.electronAPI.getGoogleUserInfo();

      // If main has no session, try to restore it from THIS user's saved token
      if (!userInfo) {
        console.log('ℹ️  No Google userInfo from main process (not signed in / not restored).');

        if (savedTokenRaw) {
          try {
            console.log('🔄 Attempting silent restore from user-scoped localStorage token...');
            const savedToken = JSON.parse(savedTokenRaw);

            // ✅ YOU MUST IMPLEMENT THIS IPC IN MAIN + PRELOAD
            // It should set the google OAuth client credentials in main process
            // and refresh if needed.
            if (typeof window.electronAPI.restoreGoogleSession === 'function') {
              await window.electronAPI.restoreGoogleSession(savedToken);

              // Re-check after restore
              userInfo = await window.electronAPI.getGoogleUserInfo();
              const tokenInfoAfterRestore = await window.electronAPI.getGoogleAccessToken();

              if (userInfo && tokenInfoAfterRestore) {
                // Cross-user leak protection
                if (savedEmail && userInfo.email && savedEmail !== userInfo.email) {
                  console.warn('⚠️ Google user mismatch after restore for this app user.');
                  console.warn('   Saved for app user:', savedEmail);
                  console.warn('   Main process user:', userInfo.email);
                  console.warn('   → Clearing THIS user’s saved keys to avoid leak.');

                  localStorage.removeItem(userGoogleEmailKey);
                  localStorage.removeItem(userGoogleTokenKey);

                  AppState.googleDriveConnected = false;
                  AppState.googleDriveEmail = '';
                  showNotification('Google Drive account mismatch detected. Please reconnect.', 'warning');
                  return false;
                }

                AppState.googleDriveConnected = true;
                AppState.googleDriveEmail = userInfo.email || '';

                // Keep storage fresh for THIS user
                localStorage.setItem(userGoogleEmailKey, AppState.googleDriveEmail);
                localStorage.setItem(userGoogleTokenKey, JSON.stringify(tokenInfoAfterRestore));

                console.log('✅ Google Drive authenticated (silent restore succeeded)');
                console.log('   App userId:', AppState.userId);
                console.log('   Email:', AppState.googleDriveEmail);
                return true;
              }

              console.log('❌ Silent restore attempted but main still has no valid session.');
            } else {
              console.warn('⚠️ restoreGoogleSession IPC not implemented yet; cannot silent-restore.');
            }
          } catch (e) {
            console.warn('❌ Silent restore failed:', e);
          }
        }

        // IMPORTANT: don't leak another user's email into UI.
        // Only show connected if main process actually has a user.
        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';

        // Do NOT delete savedEmail/token here — keep them for this user.
        return false;
      }

      // If main process is signed in as someone else, do NOT allow cross-user leak.
      if (savedEmail && userInfo.email && savedEmail !== userInfo.email) {
        console.warn('⚠️ Google user mismatch for this app user.');
        console.warn('   Saved for app user:', savedEmail);
        console.warn('   Main process user:', userInfo.email);
        console.warn('   → Disconnecting (clearing THIS user’s saved keys) to avoid leak.');

        localStorage.removeItem(userGoogleEmailKey);
        localStorage.removeItem(userGoogleTokenKey);

        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';
        showNotification('Google Drive account mismatch detected. Please reconnect.', 'warning');
        return false;
      }

      // Verify token exists from main process
      const tokenInfo = await window.electronAPI.getGoogleAccessToken();

      if (!tokenInfo) {
        console.warn('❌ Google userInfo exists but no access token available (session expired).');

        // Clear THIS user's saved data because it no longer corresponds to a working session
        localStorage.removeItem(userGoogleEmailKey);
        localStorage.removeItem(userGoogleTokenKey);

        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';
        showNotification('Google Drive session expired. Please reconnect in Settings.', 'warning');
        return false;
      }

      // ✅ Success: main process has a valid session; save it under THIS app user
      AppState.googleDriveConnected = true;
      AppState.googleDriveEmail = userInfo.email || '';

      localStorage.setItem(userGoogleEmailKey, AppState.googleDriveEmail);
      localStorage.setItem(userGoogleTokenKey, JSON.stringify(tokenInfo));

      console.log('✅ Google Drive authenticated');
      console.log('   App userId:', AppState.userId);
      console.log('   Saved email key:', userGoogleEmailKey);
      console.log('   Saved token key:', userGoogleTokenKey);
      console.log('   Email:', AppState.googleDriveEmail);

      return true;
    } catch (error) {
      console.error('Google auth check error:', error);

      // Clear ONLY THIS user's saved auth data on error
      localStorage.removeItem(userGoogleEmailKey);
      localStorage.removeItem(userGoogleTokenKey);

      AppState.googleDriveConnected = false;
      AppState.googleDriveEmail = '';
      return false;
    }
  },

  async logout() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║   [RENDERER] GOOGLE DRIVE LOGOUT                           ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('   AppState.userId:', AppState.userId);

      await window.electronAPI.googleLogout();

      // Clear user-specific Google auth
      if (AppState.userId) {
        localStorage.removeItem(`google_email_${AppState.userId}`);
        localStorage.removeItem(`google_token_${AppState.userId}`);
      }

      AppState.googleDriveConnected = false;
      AppState.googleDriveEmail = '';

      // Switch to OneDrive if currently on Google Drive
      if (AppState.activeDocumentSource === 'googledrive') {
        AppState.activeDocumentSource = 'onedrive';
        AppState.documents = AppState.documents.filter(d => d.source !== 'googledrive');
      }

      showNotification('Disconnected from Google Drive', 'success');
      renderApp();
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Logout failed', 'error');
    }
  },

  async getGoogleDriveFiles() {
    if (!AppState.googleDriveConnected) {
      console.log('Not authenticated with Google Drive');
      return [];
    }

    try {
      showNotification('Loading Google Drive files...', 'info');

      const files = await window.electronAPI.getGoogleDriveFiles();

      return files.map(file => ({
        id: file.id,
        title: file.name,
        content: file.name,
        source: 'googledrive',
        created_at: file.createdTime,
        updated_at: file.modifiedTime,
        webUrl: file.webViewLink,
        size: file.size || 0,
        mimeType: file.mimeType,
        iconLink: file.iconLink
      }));
    } catch (error) {
      console.error('Error fetching Google Drive files:', error);
      showNotification('Failed to fetch Google Drive files: ' + error.message, 'error');
      return [];
    }
  }
};

// Export to global scope
if (typeof window !== 'undefined') {
  window.GoogleDriveAPI = GoogleDriveAPI;
}
