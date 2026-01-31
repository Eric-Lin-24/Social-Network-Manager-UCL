const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // =========================
  // App User Session (NEW)
  // =========================
  setActiveUser: (userId) => ipcRenderer.invoke('set-active-user', { userId }),
  clearActiveUser: () => ipcRenderer.invoke('clear-active-user'),

  // =========================
  // Microsoft OAuth
  // =========================
  login: () => ipcRenderer.invoke('msal-login'),
  getAccessToken: () => ipcRenderer.invoke('get-access-token'),
  logout: () => ipcRenderer.invoke('msal-logout'),
  downloadOneDriveFile: (fileId, fileName) =>
    ipcRenderer.invoke('download-onedrive-file', { fileId, fileName }),
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', callback),
  onAuthError: (callback) => ipcRenderer.on('auth-error', (event, error) => callback(error)),

  // =========================
  // Google OAuth
  // =========================
  googleLogin: () => ipcRenderer.invoke('google-login'),
  getGoogleAccessToken: () => ipcRenderer.invoke('get-google-access-token'),
  getGoogleUserInfo: () => ipcRenderer.invoke('get-google-user-info'),
  getGoogleDriveFiles: () => ipcRenderer.invoke('get-google-drive-files'),
  downloadGoogleDriveFile: (fileId, fileName, mimeType) =>
    ipcRenderer.invoke('download-google-drive-file', { fileId, fileName, mimeType }),
  googleLogout: () => ipcRenderer.invoke('google-logout'),

  // NEW: user-scoped google token persistence in main store
  loadGoogleForUser: (userId) => ipcRenderer.invoke('load-google-for-user', { userId }),
  clearGoogleForUser: (userId) => ipcRenderer.invoke('clear-google-for-user', { userId }),

  onGoogleAuthSuccess: (callback) => ipcRenderer.on('google-auth-success', (event, data) => callback(data)),
  onGoogleAuthError: (callback) => ipcRenderer.on('google-auth-error', (event, error) => callback(error))
});
