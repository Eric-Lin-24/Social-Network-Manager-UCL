// ============================================
// GOOGLE DRIVE API
// ============================================
// User-scoped Google Drive connection state stored in localStorage by AppState.userId.

const GoogleDriveAPI = {
  async authenticateWithGoogle() {
    try {
      if (!AppState.userId) {
        showNotification('Please sign in to your Community Curator account first before connecting to Google Drive', 'error');
        return;
      }

      const result = await window.electronAPI.googleLogin();
      if (result?.success) {
        showNotification('Google authentication in progress...', 'info');
      }
    } catch (error) {
      console.error('Google Drive login error:', error);
      showNotification('Google login failed: ' + error.message, 'error');
    }
  },

  async checkAuthentication() {
    if (!AppState.userId) {
      AppState.googleDriveConnected = false;
      AppState.googleDriveEmail = '';
      return false;
    }

    const userGoogleEmailKey = `google_email_${AppState.userId}`;
    const userGoogleTokenKey = `google_token_${AppState.userId}`;
    const savedEmail = localStorage.getItem(userGoogleEmailKey);
    const savedTokenRaw = localStorage.getItem(userGoogleTokenKey);

    try {
      let userInfo = await window.electronAPI.getGoogleUserInfo();

      // If main has no session, try to restore from saved token
      if (!userInfo) {

        if (savedTokenRaw) {
          try {
            const savedToken = JSON.parse(savedTokenRaw);
            if (typeof window.electronAPI.restoreGoogleSession === 'function') {
              await window.electronAPI.restoreGoogleSession(savedToken);

              // Re-check after restore
              userInfo = await window.electronAPI.getGoogleUserInfo();
              const tokenInfoAfterRestore = await window.electronAPI.getGoogleAccessToken();

              if (userInfo && tokenInfoAfterRestore) {
                // Cross-user leak protection
                if (savedEmail && userInfo.email && savedEmail !== userInfo.email) {

                  localStorage.removeItem(userGoogleEmailKey);
                  localStorage.removeItem(userGoogleTokenKey);

                  AppState.googleDriveConnected = false;
                  AppState.googleDriveEmail = '';
                  showNotification('Google Drive account mismatch detected. Please reconnect.', 'warning');
                  return false;
                }

                AppState.googleDriveConnected = true;
                AppState.googleDriveEmail = userInfo.email || '';

                localStorage.setItem(userGoogleEmailKey, AppState.googleDriveEmail);
                localStorage.setItem(userGoogleTokenKey, JSON.stringify(tokenInfoAfterRestore));
                return true;
              }
            } else {
              // restoreGoogleSession IPC not implemented
            }
          } catch (e) {
            // Silent restore failed
          }
        }

        // Don't leak another user's email into UI
        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';
        return false;
      }

      // If main process is signed in as someone else, prevent cross-user leak
      if (savedEmail && userInfo.email && savedEmail !== userInfo.email) {

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

        // Clear THIS user's saved data because it no longer corresponds to a working session
        localStorage.removeItem(userGoogleEmailKey);
        localStorage.removeItem(userGoogleTokenKey);

        AppState.googleDriveConnected = false;
        AppState.googleDriveEmail = '';
        showNotification('Google Drive session expired. Please reconnect in Settings.', 'warning');
        return false;
      }

      // Success: main process has a valid session
      AppState.googleDriveConnected = true;
      AppState.googleDriveEmail = userInfo.email || '';
      localStorage.setItem(userGoogleEmailKey, AppState.googleDriveEmail);
      localStorage.setItem(userGoogleTokenKey, JSON.stringify(tokenInfo));
      return true;
    } catch (error) {
      console.error('Google auth check error:', error);

      // Clear ONLY this user's saved auth data on error
      localStorage.removeItem(userGoogleEmailKey);
      localStorage.removeItem(userGoogleTokenKey);

      AppState.googleDriveConnected = false;
      AppState.googleDriveEmail = '';
      return false;
    }
  },

  async logout() {
    try {
      await window.electronAPI.googleLogout();

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
