// ============================================
// SETTINGS VIEW
// ============================================

function renderSettings() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="animate-slide-up">
      <!-- User Account Section -->
      ${AppState.username ? `
      <div class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Your Account</h3>
        <div class="connection-card">
          <div class="connection-icon" style="background: var(--accent-primary-soft); color: var(--accent-primary);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="connection-info flex-1">
            <div class="connection-name">${AppState.username}</div>
            <div class="connection-status">
              <span class="badge badge-success">Signed In</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="handleLogout()">Logout</button>
        </div>
      </div>
      ` : ''}

      <div class="mb-8">
        <h3 class="text-lg font-semibold mb-4">Connected Accounts</h3>
        <div class="grid grid-cols-2 gap-4">
          
          <div class="connection-card">
            <div class="connection-icon microsoft"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg></div>
            <div class="connection-info flex-1">
              <div class="connection-name">Microsoft 365</div>
              <div class="connection-status">
                ${AppState.isAuthenticated 
                  ? `<span class="badge badge-success">Connected</span> ${AppState.userProfile?.email || ''}`
                  : '<span class="badge badge-error">Not connected</span>'}
              </div>
            </div>
            ${AppState.isAuthenticated 
              ? `<button class="btn btn-ghost btn-sm" onclick="MicrosoftGraphAPI.logout()">Disconnect</button>`
              : `<button class="btn btn-primary btn-sm" onclick="MicrosoftGraphAPI.authenticateWithMicrosoft()">Connect</button>`}
          </div>

          <div class="connection-card">
            <div class="connection-icon google"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 22 22 22 12 2"/></svg></div>
            <div class="connection-info flex-1">
              <div class="connection-name">Google Drive</div>
              <div class="connection-status">
                ${AppState.googleDriveConnected 
                  ? `<span class="badge badge-success">Connected</span> ${AppState.googleDriveEmail || ''}`
                  : '<span class="badge badge-error">Not connected</span>'}
              </div>
            </div>
            ${AppState.googleDriveConnected 
              ? `<button class="btn btn-ghost btn-sm" onclick="GoogleDriveAPI.logout()">Disconnect</button>`
              : `<button class="btn btn-primary btn-sm" onclick="GoogleDriveAPI.authenticateWithGoogle()">Connect</button>`}
          </div>

          <div class="connection-card">
            <div class="connection-icon telegram" style="background: #2AABEE20; color: #2AABEE;">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
            </div>
            <div class="connection-info flex-1">
              <div class="connection-name">Telegram</div>
              <div class="connection-status">
                ${AppState.subscribedChats.length > 0 
                  ? `<span class="badge badge-success">Connected</span> ${AppState.subscribedChats.length} chats`
                  : '<span class="badge badge-warning">Checking...</span>'}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="AzureVMAPI.refreshSubscribedChats()">Refresh</button>
          </div>

          <div class="connection-card">
            <div class="connection-icon whatsapp" style="background: #25D36620; color: #25D366;">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div class="connection-info flex-1">
              <div class="connection-name">WhatsApp</div>
              <div class="connection-status">
                <span class="badge badge-error">Not connected</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showNotification('WhatsApp integration coming soon!', 'info')">Connect</button>
          </div>
        </div>
      </div>

      <div class="card mb-6" style="margin-top: 48px;">
        <h3 class="font-semibold mb-4">Appearance</h3>
        <div class="form-group" style="max-width: 300px;">
          <label class="form-label">Theme</label>
          <select id="theme-select" onchange="handleThemeChange(event)">
            <option value="dark" ${localStorage.getItem('theme') === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${localStorage.getItem('theme') === 'light' ? 'selected' : ''}>Light</option>
            <option value="auto" ${localStorage.getItem('theme') === 'auto' ? 'selected' : ''}>System</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3 class="font-semibold mb-4">About</h3>
        <div class="flex flex-col gap-3">
          <div class="flex justify-between"><span class="text-muted">Application</span><span>Community Curator</span></div>
          <div class="flex justify-between"><span class="text-muted">Version</span><span>1.0.0</span></div>
          <div class="flex justify-between"><span class="text-muted">Platform</span><span>Electron</span></div>
        </div>
        <div class="divider"></div>
        <p class="text-sm text-muted">Community Curator helps you manage documents, schedule messages, and collect feedback.</p>
      </div>
    </div>
  `;
}

function updateUserCard() {
  const avatar = document.getElementById('user-avatar');
  const name = document.getElementById('user-name');
  const status = document.getElementById('user-status');

  // Check if user is logged in with custom auth
  if (AppState.username && AppState.userId) {
    const initials = AppState.username.substring(0, 2).toUpperCase();
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = AppState.username;
    if (status) status.innerHTML = '<span style="color: var(--success);">● Signed In</span>';
  }
  // Check if connected to Microsoft
  else if (AppState.isAuthenticated && AppState.userProfile) {
    const initials = AppState.userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = AppState.userProfile.name;
    if (status) status.innerHTML = '<span style="color: var(--success);">● Connected</span>';
  } else {
    if (avatar) avatar.textContent = '?';
    if (name) name.textContent = 'Not Connected';
    if (status) status.innerHTML = '<span>Click to connect</span>';
  }
}

if (typeof window !== 'undefined') {
  window.renderSettings = renderSettings;
  window.updateUserCard = updateUserCard;
}