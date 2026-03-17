// ============================================
// SCHEDULE MESSAGE - Recipients
// Channel selection, recipient management,
// search, filtering, and dropdown UI
// ============================================
// ============================================
// SCHEDULE MESSAGE PAGE
// Full message composer with file attachments
// ============================================

// Store selected local files (cloud files are in AppState.selectedCloudFilesForScheduler)
let selectedLocalFiles = [];

// Store selected recipients (for multi-select)
let selectedRecipients = [];


function setComposeChannel(channel) {
  AppState.composeChannel = channel;
  selectedRecipients = [];
  renderScheduleMessagePage();
}

function _getComposeChannel() {
  return AppState.composeChannel || 'telegram';
}

// Toggle recipient selection
function toggleRecipient(userId, chatId, chatName, platform) {
  const index = selectedRecipients.findIndex(r => r.userId === userId);
  if (index > -1) {
    selectedRecipients.splice(index, 1);
  } else {
    selectedRecipients.push({ userId, chatId, chatName, platform });
  }
  renderRecipientsList();
  // Re-render dropdown to update checkboxes
  const searchInput = document.getElementById('recipient-search-input');
  if (searchInput) {
    filterRecipients(searchInput.value);
  }
}

// Remove a recipient from selection
function removeRecipient(userId) {
  selectedRecipients = selectedRecipients.filter(r => r.userId !== userId);
  renderRecipientsList();
  // Re-render dropdown to update checkboxes
  const searchInput = document.getElementById('recipient-search-input');
  if (searchInput) {
    filterRecipients(searchInput.value);
  }
}

// Render selected recipients as tags
function renderRecipientsList() {
  const container = document.getElementById('selected-recipients-list');
  if (!container) return;

  if (selectedRecipients.length === 0) {
    container.innerHTML = '<span class="text-sm text-muted">No recipients selected</span>';
    return;
  }

  container.innerHTML = selectedRecipients.map(r => `
    <div class="recipient-tag" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--accent-primary-soft); border-radius: 16px; margin: 2px;">
      <span class="text-sm" style="color: var(--accent-primary);">${r.chatName}</span>
      <button onclick="removeRecipient('${escapeAttr(r.userId)}')" style="background: none; border: none; cursor: pointer; padding: 0; display: flex; color: var(--accent-primary);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Get the correct recipient source list based on channel
function _getRecipientSource() {
  if (_getComposeChannel() === 'email') {
    return (AppState.subscribedEmailUsers || []).map(u => ({
      id: u.user_id,
      chat_id: u.user_id,
      name: u.user_name || u.email_address,
      user_id: u.user_id,
      type: u.email_address,
      platform: 'email'
    }));
  }
  return AppState.subscribedChats || [];
}

// Filter recipients based on search input
const filterRecipients = debounce((searchTerm) => {
  const dropdown = document.getElementById('recipient-dropdown');
  if (!dropdown) return;

  const subscribedChats = _getRecipientSource();
  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Filter chats based on search term
  const filteredChats = normalizedSearch === ''
    ? subscribedChats
    : subscribedChats.filter(chat => {
        const chatName = (chat.name || chat.chat_name || chat.id || '').toLowerCase();
        const platform = (chat.type || chat.platform || '').toLowerCase();
        return chatName.includes(normalizedSearch) || platform.includes(normalizedSearch);
      });

  // Show dropdown if there's input or focus
  dropdown.style.display = 'block';

  // Re-render the dropdown with filtered results
  renderRecipientDropdown(filteredChats);
}, 100);

// Render the recipient dropdown with given chats
function renderRecipientDropdown(chats) {
  const dropdown = document.getElementById('recipient-dropdown');
  if (!dropdown) return;

  const subscribedChats = chats || _getRecipientSource();

  dropdown.innerHTML = `
    <!-- Select All / Clear All -->
    <div class="flex justify-between items-center p-2" style="border-bottom: 1px solid var(--border-subtle);">
      <button type="button" class="btn btn-ghost btn-sm" onclick="selectAllRecipients()">Select All</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="clearAllRecipients()">Clear All</button>
    </div>

    <!-- Chat list with checkboxes -->
    ${subscribedChats.length === 0 ? `
      <div class="p-4 text-center text-muted text-sm">No matching chats found</div>
    ` : subscribedChats.map(chat => {
      const chatId = chat.id || chat.chat_id;
      const chatName = chat.name || chat.chat_name || chatId;
      const userId = chat.user_id || '';
      const platform = chat.type || chat.platform || 'Group';
      const isChecked = selectedRecipients.some(r => r.userId === userId);
      return `
        <label class="flex items-center gap-3 p-3 cursor-pointer hover:bg-tertiary" style="border-bottom: 1px solid var(--border-subtle);" onclick="event.stopPropagation()">
          <input type="checkbox" data-user-id="${userId}" data-chat-id="${chatId}" ${isChecked ? 'checked' : ''} onchange="toggleRecipient('${escapeAttr(userId)}', '${escapeAttr(chatId)}', '${escapeAttr(chatName)}', '${escapeAttr(platform)}')" style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
          <div class="flex-1">
            <div class="text-sm font-medium">${chatName}</div>
            <div class="text-xs text-muted">${platform}</div>
          </div>
        </label>
      `;
    }).join('')}
  `;
}

// Hide recipient dropdown
function hideRecipientDropdown() {
  const dropdown = document.getElementById('recipient-dropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

// Show recipient dropdown
function showRecipientDropdown() {
  const dropdown = document.getElementById('recipient-dropdown');
  if (dropdown) {
    dropdown.style.display = 'block';
    renderRecipientDropdown();
  }
}

// Select all recipients
function selectAllRecipients() {
  const subscribedChats = _getRecipientSource();
  selectedRecipients = subscribedChats.map(chat => ({
    userId: chat.user_id,
    chatId: chat.id || chat.chat_id,
    chatName: chat.name || chat.chat_name || chat.id,
    platform: chat.type || chat.platform || 'Group'
  }));
  renderRecipientsList();
  // Re-render dropdown to update checkboxes
  const searchInput = document.getElementById('recipient-search-input');
  if (searchInput) {
    filterRecipients(searchInput.value);
  }
}

// Clear all recipients
function clearAllRecipients() {
  selectedRecipients = [];
  renderRecipientsList();
  // Re-render dropdown to update checkboxes
  const searchInput = document.getElementById('recipient-search-input');
  if (searchInput) {
    filterRecipients(searchInput.value);
  }
}

/**
 * Download file from OneDrive (MAIN PROCESS via IPC)
 * This avoids CSP issues because Graph /content redirects to SharePoint.
 * @param {string} fileId - OneDrive file ID
 * @param {string} fileName - File name
 * @returns {Promise<File>} - Downloaded file as File object
 */