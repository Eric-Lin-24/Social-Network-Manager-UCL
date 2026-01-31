// ============================================
// SCHEDULE MESSAGE PAGE
// Full message composer with file attachments
// ============================================

// Store selected local files (cloud files are in AppState.selectedCloudFilesForScheduler)
let selectedLocalFiles = [];

// Store selected recipients (for multi-select)
let selectedRecipients = [];

// --------------------------------------------
// Helpers: safe escaping for inline onclick
// --------------------------------------------
function _escAttr(str = '') {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function openCalendarDayPicker() {
  // enter selection mode + keep whatever is already selected
  AppState.daySelectionMode = true;
  if (!Array.isArray(AppState.selectedScheduleDays)) AppState.selectedScheduleDays = [];
  navigateTo('calendar');
}

function _getSelectedDays() {
  // Calendar page writes AppState.selectedScheduleDays = ['YYYY-MM-DD', ...]
  if (!Array.isArray(AppState.selectedScheduleDays)) AppState.selectedScheduleDays = [];

  // If none selected, fall back to "today" so composer isn’t empty
  if (AppState.selectedScheduleDays.length === 0) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    AppState.selectedScheduleDays = [`${y}-${m}-${d}`];
  }

  // Dedup + sort
  AppState.selectedScheduleDays = Array.from(new Set(AppState.selectedScheduleDays)).sort();
  return AppState.selectedScheduleDays;
}

function removeSelectedDay(dateISO) {
  AppState.selectedScheduleDays = (AppState.selectedScheduleDays || []).filter(d => d !== dateISO);
  if (AppState.selectedScheduleDays.length === 0) {
    // keep at least one day
    _getSelectedDays();
  }
  renderScheduleMessagePage();
}

function _renderSelectedDaysChips() {
  const days = _getSelectedDays();
  return `
    <div class="flex flex-wrap gap-2" style="margin-top: 8px;">
      ${days.map(d => `
        <span style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid var(--border-subtle);background:var(--bg-tertiary);">
          <span class="text-sm">${d}</span>
          <button onclick="removeSelectedDay('${_escAttr(d)}')" style="border:none;background:none;cursor:pointer;color:var(--text-muted);display:flex;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </span>
      `).join('')}
    </div>
  `;
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
      <button onclick="removeRecipient('${_escAttr(r.userId)}')" style="background: none; border: none; cursor: pointer; padding: 0; display: flex; color: var(--accent-primary);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Filter recipients based on search input
function filterRecipients(searchTerm) {
  const dropdown = document.getElementById('recipient-dropdown');
  if (!dropdown) return;

  const subscribedChats = AppState.subscribedChats || [];
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
}

// Render the recipient dropdown with given chats
function renderRecipientDropdown(chats) {
  const dropdown = document.getElementById('recipient-dropdown');
  if (!dropdown) return;

  const subscribedChats = chats || AppState.subscribedChats || [];

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
          <input type="checkbox" data-user-id="${userId}" data-chat-id="${chatId}" ${isChecked ? 'checked' : ''} onchange="toggleRecipient('${_escAttr(userId)}', '${_escAttr(chatId)}', '${_escAttr(chatName)}', '${_escAttr(platform)}')" style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
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
  const subscribedChats = AppState.subscribedChats || [];
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
async function downloadFileFromOneDrive(fileId, fileName) {
  try {
    console.log('=== ONEDRIVE DOWNLOAD START (IPC) ===');
    console.log('File ID:', fileId);
    console.log('File Name:', fileName);

    if (!AppState.isAuthenticated) {
      throw new Error('Not authenticated with Microsoft. Please sign in.');
    }

    if (!window?.electronAPI?.downloadOneDriveFile) {
      throw new Error('downloadOneDriveFile IPC is not available. Add it to preload + main process.');
    }

    // Main process should use the stored token; no renderer fetch.
    const result = await window.electronAPI.downloadOneDriveFile(fileId, fileName);

    if (!result || !result.buffer) {
      throw new Error('OneDrive download returned no data buffer.');
    }

    const uint8Array = new Uint8Array(result.buffer);
    const blob = new Blob([uint8Array], { type: result.mimeType || 'application/octet-stream' });
    const file = new File([blob], result.fileName || fileName, { type: result.mimeType || 'application/octet-stream' });

    console.log('=== ONEDRIVE DOWNLOAD COMPLETE ===');
    console.log('✓ File object created:', file.name, file.size, 'bytes', file.type);

    return file;
  } catch (error) {
    console.error('=== ONEDRIVE DOWNLOAD FAILED ===');
    console.error('✗ Error:', error.message);
    throw new Error(`Failed to download "${fileName}" from OneDrive: ${error.message}`);
  }
}

async function downloadFileFromGoogleDriveFixed(fileId, fileName, mimeType) {
  console.log('=== GOOGLE DRIVE DOWNLOAD START ===');
  console.log('File ID:', fileId);
  console.log('File Name:', fileName);
  console.log('MIME Type:', mimeType);

  if (typeof window?.electronAPI?.downloadGoogleDriveFile !== 'function') {
    throw new Error('downloadGoogleDriveFile IPC is not available in this build.');
  }

  const result = await window.electronAPI.downloadGoogleDriveFile(fileId, fileName, mimeType);

  if (!result || !result.buffer) {
    throw new Error('Google Drive download returned no file buffer.');
  }

  const uint8Array = new Uint8Array(result.buffer);
  const blob = new Blob([uint8Array], { type: result.mimeType || mimeType || 'application/octet-stream' });
  const file = new File([blob], result.fileName || fileName || `gdrive_${fileId}`, {
    type: result.mimeType || mimeType || 'application/octet-stream'
  });

  console.log('✓ Google Drive File object created:', file.name, file.size, file.type);
  console.log('=== GOOGLE DRIVE DOWNLOAD COMPLETE ===');
  return file;
}

function renderScheduleMessagePage() {
  const content = document.getElementById('content');
  const subscribedChats = AppState.subscribedChats || [];

  // Restore form state if returning from document selection, otherwise reset
  const savedState = AppState.schedulerFormState;
  if (savedState) {
    selectedLocalFiles = savedState.localFiles || [];
    selectedRecipients = savedState.recipients || [];
    // Restore selected days
    if (savedState.selectedDays && savedState.selectedDays.length > 0) {
      AppState.selectedScheduleDays = savedState.selectedDays;
    }
  } else {
    selectedLocalFiles = [];
    selectedRecipients = [];
  }

  content.innerHTML = `
    <div class="animate-slide-up">
      <!-- Back Button -->
      <button class="btn btn-ghost mb-6" onclick="navigateTo('scheduling')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to Messages
      </button>

      <div class="grid grid-cols-3 gap-6">
        <!-- Main Form -->
        <div class="card" style="grid-column: span 2;">
          <h3 class="text-lg font-semibold mb-6">Compose Message</h3>

          <div class="flex flex-col gap-6">
            <!-- Recipient Selection (Multi-select) -->
            <div class="form-group">
              <label class="form-label">Recipients</label>

              <!-- Selected recipients display -->
              <div id="selected-recipients-list" class="flex flex-wrap gap-1 mb-2" style="min-height: 28px;">
                <span class="text-sm text-muted">No recipients selected</span>
              </div>

              <!-- Search input for recipients -->
              <div style="position: relative;">
                <input
                  type="text"
                  id="recipient-search-input"
                  class="form-input w-full"
                  placeholder="Type to search recipients..."
                  autocomplete="off"
                  oninput="filterRecipients(this.value)"
                  onfocus="showRecipientDropdown()"
                  style="padding-right: 32px;"
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted);">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>

                <!-- Dropdown menu -->
                <div id="recipient-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: 8px; margin-top: 4px; max-height: 250px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  <!-- Content will be rendered by renderRecipientDropdown() -->
                </div>
              </div>

              ${subscribedChats.length === 0 ? `
                <p class="text-xs text-muted mt-2">
                  No subscribed chats found.
                  <button class="text-accent" style="background: none; border: none; cursor: pointer; text-decoration: underline;" onclick="AzureVMAPI.refreshSubscribedChats()">Refresh chats</button>
                </p>
              ` : `
                <p class="text-xs text-muted mt-2">${subscribedChats.length} chat(s) available</p>
              `}
            </div>

            <!-- Message Content -->
            <div class="form-group">
              <label class="form-label">Message</label>
              <textarea
                id="message-content"
                class="form-input"
                rows="8"
                placeholder="Type your message here..."
                style="resize: vertical; min-height: 150px;"
                oninput="updateCharCount()"
              ></textarea>
              <div class="flex justify-between mt-2">
                <span class="text-xs text-muted">Supports basic text formatting</span>
                <span class="text-xs text-muted"><span id="char-count">0</span> characters</span>
              </div>
            </div>

            <!-- File Attachments -->
            <div class="form-group">
              <label class="form-label">Attachments</label>

              <!-- Two attachment options side by side -->
              <div class="grid grid-cols-2 gap-4 mb-4">
                <!-- Local file upload -->
                <div
                  id="file-drop-zone"
                  class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary"
                  style="border-color: var(--border-default); background: var(--bg-tertiary);"
                  onclick="document.getElementById('file-input').click()"
                >
                  <input type="file" id="file-input" multiple style="display: none;" onchange="handleLocalFileSelect(event)">
                  <div style="width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 12px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p class="text-sm font-medium" style="color: var(--text-primary);">Local Files</p>
                  <p class="text-xs text-muted mt-1">Drop or click to browse</p>
                </div>

                <!-- Cloud storage button -->
                <div
                  class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary"
                  style="border-color: var(--border-default); background: var(--bg-tertiary);"
                  onclick="goToDocumentsForSelection()"
                >
                  <div style="width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 12px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    </svg>
                  </div>
                  <p class="text-sm font-medium" style="color: var(--text-primary);">Cloud Storage</p>
                  <p class="text-xs text-muted mt-1">Select from Documents</p>
                </div>
              </div>

              <!-- Selected Files List -->
              <div id="file-list" class="flex flex-col gap-2"></div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="flex flex-col gap-6">
          <!-- Schedule Options -->
          <div class="card">
            <h4 class="font-semibold mb-4">Schedule</h4>

            <div class="form-group mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <label class="form-label">Selected days</label>
                  <div class="text-xs text-muted">These days will all be scheduled at the same time.</div>
                </div>

                <button class="btn btn-secondary btn-sm" onclick="openCalendarDayPicker()">
                  Schedule days
                </button>
              </div>
              ${_renderSelectedDaysChips()}
              <div class="form-group mb-4" style="margin-top: 14px;">
                <label class="form-label">Time</label>
                <input type="time" id="message-time" class="form-input">
              </div>
            </div>

            <div class="flex flex-col gap-2 mb-4">
              <button class="btn btn-ghost btn-sm justify-start" onclick="setQuickSchedule('now')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Send Immediately
              </button>
              <button class="btn btn-ghost btn-sm justify-start" onclick="setQuickSchedule('1h')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                In 1 Hour
              </button>
              <button class="btn btn-ghost btn-sm justify-start" onclick="setQuickSchedule('tomorrow')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Tomorrow 9 AM
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="card">
            <h4 class="font-semibold mb-4">Actions</h4>
            <div class="flex flex-col gap-3">
              <button class="btn btn-primary w-full" onclick="submitScheduledMessage()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Schedule Message
              </button>
              <button class="btn btn-secondary w-full" onclick="saveDraft()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Draft
              </button>
              <button class="btn btn-ghost w-full" onclick="clearForm()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear Form
              </button>
            </div>
          </div>

          <!-- Tips -->
          <div class="card" style="background: var(--accent-primary-soft); border-color: var(--border-accent);">
            <h4 class="font-semibold mb-2" style="color: var(--accent-primary);">Tips</h4>
            <ul class="text-sm text-muted" style="list-style: disc; padding-left: 20px;">
              <li class="mb-1">Schedule messages during active hours for better engagement</li>
              <li class="mb-1">Keep messages concise and clear</li>
              <li>Attach relevant documents to provide context</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

 // Default time: next hour
 const timeInput = document.getElementById('message-time');
 if (timeInput) {
   const now = new Date();
   now.setHours(now.getHours() + 1);
   now.setMinutes(0);
   timeInput.value = now.toISOString().slice(11, 16); // HH:MM
 }

 // If old single-date prefill exists, convert it into selected day + time
 if (AppState.composePrefillDateTimeLocal) {
   const v = AppState.composePrefillDateTimeLocal; // "YYYY-MM-DDTHH:MM"
   const parts = String(v).split('T');
   if (parts.length === 2) {
     AppState.selectedScheduleDays = [parts[0]];
     const t = parts[1].slice(0, 5);
     const ti = document.getElementById('message-time');
     if (ti) ti.value = t;
   }
   AppState.composePrefillDateTimeLocal = null;
 }

 // Ensure selected days exist (and dedup/sort)
 _getSelectedDays();


  // Setup drag and drop
  setupDragAndDrop();

  // Render any previously selected files (e.g., when returning from documents selection)
  renderFileList();
  // ==========================================================
  // ✅ APPLY PREFILL FROM DRAFTS (recipient + message)
  // AppState.scheduleMessagePrefill = { target_user_id, message_content }
  // ==========================================================
  try {
    const prefill = AppState.scheduleMessagePrefill;
    if (prefill && (prefill.target_user_id || prefill.message_content)) {
      const recipientSelect = document.getElementById('message-recipient');
      const messageBox = document.getElementById('message-content');

      // Recipient: match by option dataset userId
      if (recipientSelect && prefill.target_user_id) {
        const options = Array.from(recipientSelect.options || []);
        const match = options.find(opt => String(opt.dataset.userId || '') === String(prefill.target_user_id));
        if (match) recipientSelect.value = match.value;
      }

      // Message text
      if (messageBox && typeof prefill.message_content === 'string') {
        messageBox.value = prefill.message_content;
      }

      updateCharCount();

      // Clear so it doesn't keep reapplying
      AppState.scheduleMessagePrefill = null;
    }
  } catch (e) {
    console.warn('Draft prefill failed:', e);
  }

  // ==========================================================
  // ✅ RESTORE FORM STATE (when returning from document selection)
  // ==========================================================
  try {
    const savedState = AppState.schedulerFormState;
    if (savedState) {
      const messageBox = document.getElementById('message-content');
      const timeInput = document.getElementById('message-time');

      // Restore message content
      if (messageBox && savedState.messageContent) {
        messageBox.value = savedState.messageContent;
      }

      // Restore time
      if (timeInput && savedState.time) {
        timeInput.value = savedState.time;
      }

      // Render the restored recipients list
      renderRecipientsList();

      updateCharCount();

      // Clear saved state so it doesn't persist forever
      AppState.schedulerFormState = null;
    }
  } catch (e) {
    console.warn('Form state restore failed:', e);
  }
}

// Character counter
function updateCharCount() {
  const textarea = document.getElementById('message-content');
  const counter = document.getElementById('char-count');
  if (textarea && counter) {
    counter.textContent = textarea.value.length;
  }
}

// Local file handling
function handleLocalFileSelect(event) {
  const files = event.target.files;
  if (files) {
    Array.from(files).forEach(file => {
      if (!selectedLocalFiles.find(f => f.name === file.name && f.size === file.size)) {
        selectedLocalFiles.push(file);
      }
    });
    renderFileList();
  }
}

function removeLocalFile(index) {
  selectedLocalFiles.splice(index, 1);
  renderFileList();
}

// Navigate to documents page for cloud file selection
function goToDocumentsForSelection() {
  // Save current form state before navigating away
  const messageContent = document.getElementById('message-content')?.value || '';
  const time = document.getElementById('message-time')?.value || '';

  AppState.schedulerFormState = {
    messageContent,
    time,
    recipients: [...selectedRecipients],
    localFiles: [...selectedLocalFiles],
    selectedDays: [...(AppState.selectedScheduleDays || [])]
  };

  // Enable file selection mode
  AppState.fileSelectionMode = true;
  AppState.fileSelectionStartedFromDocuments = false; // Coming from scheduler
  // Navigate to documents
  navigateTo('documents');
}

// Remove a cloud file from selection
function removeCloudFileFromScheduler(fileId) {
  AppState.selectedCloudFilesForScheduler = (AppState.selectedCloudFilesForScheduler || []).filter(f => f.id !== fileId);
  renderFileList();
}

// Render combined file list (local + cloud from AppState)
function renderFileList() {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;

  const cloudFiles = AppState.selectedCloudFilesForScheduler || [];
  const allFiles = [];

  // Add local files
  selectedLocalFiles.forEach((file, index) => {
    allFiles.push({ type: 'local', index, name: file.name, size: file.size, source: 'Local', sourceRaw: 'local' });
  });

  // Add cloud files from AppState
  cloudFiles.forEach((file) => {
    const isOneDrive = file.source === 'onedrive';
    allFiles.push({
      type: 'cloud',
      id: file.id,
      name: file.name || file.title,
      size: file.size,
      source: isOneDrive ? 'OneDrive' : 'Google Drive',
      sourceRaw: file.source,
      mimeType: file.mimeType
    });
  });

  if (allFiles.length === 0) {
    fileList.innerHTML = '';
    return;
  }

  fileList.innerHTML = allFiles.map(file => {
    const isOneDrive = file.sourceRaw === 'onedrive';
    const isGoogleDrive = file.sourceRaw === 'googledrive';
    const sourceColor = isOneDrive ? '#0078d4' : (isGoogleDrive ? '#4285f4' : 'var(--text-muted)');

    return `
    <div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-subtle);">
      <!-- Icon -->
      <div style="width: 40px; height: 40px; border-radius: 10px; background: ${file.type === 'cloud' ? (isOneDrive ? 'rgba(0,120,212,0.1)' : 'rgba(66,133,244,0.1)') : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${file.type === 'cloud' ? sourceColor : 'var(--text-muted)'}" stroke-width="2">
          ${file.type === 'cloud'
            ? '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'
            : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
          }
        </svg>
      </div>

      <!-- File info -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${file.name}</p>
        <div class="flex items-center gap-2 mt-0.5">
          ${file.type === 'cloud' ? `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${sourceColor};"></span>` : ''}
          <span class="text-xs" style="color: ${file.type === 'cloud' ? sourceColor : 'var(--text-muted)'};">${file.source}</span>
          ${file.size ? `<span class="text-xs text-muted">•</span><span class="text-xs text-muted">${formatFileSize(file.size)}</span>` : ''}
        </div>
      </div>

      <!-- Remove button -->
      <button class="btn-icon" onclick="${file.type === 'local' ? `removeLocalFile(${file.index})` : `removeCloudFileFromScheduler('${file.id}')`}" style="width: 32px; height: 32px; border-radius: 8px; background: var(--bg-tertiary); color: var(--text-muted);" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--text-muted)'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `}).join('');
}

// Drag and drop
function setupDragAndDrop() {
  const dropZone = document.getElementById('file-drop-zone');
  if (!dropZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = 'var(--accent-primary)';
      dropZone.style.background = 'var(--accent-primary-soft)';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = 'var(--border-default)';
      dropZone.style.background = 'var(--bg-tertiary)';
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (!selectedLocalFiles.find(f => f.name === file.name && f.size === file.size)) {
          selectedLocalFiles.push(file);
        }
      });
      renderFileList();
    }
  });
}

// Quick schedule
function setQuickSchedule(option) {
  const datetimeInput = document.getElementById('message-datetime');
  if (!datetimeInput) return;

  const now = new Date();
  switch (option) {
    case 'now': now.setMinutes(now.getMinutes() + 1); break;
    case '1h': now.setHours(now.getHours() + 1); break;
    case 'tomorrow': now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); break;
  }
  datetimeInput.value = now.toISOString().slice(0, 16);
  showNotification('Schedule time updated', 'info');
}

// Submit message
async function submitScheduledMessage() {
  const content = document.getElementById('message-content')?.value || '';

  // ✅ NEW: time-only input (keep quick schedule alone; this is just the main composer)
  const time = document.getElementById('message-time')?.value || '';

  // ✅ NEW: selected days from calendar
  const selectedDays = Array.from(new Set(AppState.selectedScheduleDays || [])).sort();

  const normalizeSource = (src) => String(src || '').trim().toLowerCase();

  // Validate recipients
  if (selectedRecipients.length === 0) { showNotification('Please select at least one recipient', 'warning'); return; }
  if (!content.trim()) { showNotification('Please enter a message', 'warning'); return; }

  // ✅ NEW: validate time + days
  if (!time) { showNotification('Please select a time', 'warning'); return; }
  if (selectedDays.length === 0) { showNotification('Please select at least one day', 'warning'); return; }

  try {
    showNotification('Preparing message...', 'info');

    const cloudFilesToSend = AppState.selectedCloudFilesForScheduler || [];

    console.log('=== FILE PREP (SCHEDULE PAGE) ===');
    console.log('Local files:', selectedLocalFiles.length, selectedLocalFiles.map(f => f.name));
    console.log('Cloud selections:', cloudFilesToSend.length, cloudFilesToSend);

    const downloadedCloudFiles = [];
    if (cloudFilesToSend.length > 0) {
      showNotification(`Downloading ${cloudFilesToSend.length} cloud file(s)...`, 'info');
      for (const cloudFile of cloudFilesToSend) {
        const source = normalizeSource(cloudFile.source);

        console.log('--- Cloud file ---');
        console.log('name:', cloudFile.name);
        console.log('id:', cloudFile.id);
        console.log('source(raw):', cloudFile.source);
        console.log('source(norm):', source);

        try {
          let downloadedFile = null;

          if (source === 'onedrive') {
            downloadedFile = await downloadFileFromOneDrive(cloudFile.id, cloudFile.name);
          } else if (source === 'googledrive') {
            downloadedFile = await downloadFileFromGoogleDriveFixed(
              cloudFile.id,
              cloudFile.name,
              cloudFile.mimeType || ''
            );
          } else {
            throw new Error(`Unknown cloud source: "${cloudFile.source}"`);
          }

          if (downloadedFile) {
            downloadedCloudFiles.push(downloadedFile);
            console.log('✓ Downloaded:', downloadedFile.name, downloadedFile.size, downloadedFile.type);
          } else {
            console.warn('✗ Download returned null/undefined for:', cloudFile.name);
          }
        } catch (error) {
          console.error(`Failed to download ${cloudFile.name}:`, error);
          showNotification(`Failed to download ${cloudFile.name}`, 'error');
        }
      }
    }

    const allFiles = [...selectedLocalFiles, ...downloadedCloudFiles];

    console.log('=== FINAL FILES TO SEND ===');
    console.log('Downloaded cloud files:', downloadedCloudFiles.length, downloadedCloudFiles.map(f => f.name));
    console.log('Total files:', allFiles.length, allFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

    // ✅ NEW: build timestamps for EACH selected day using LOCAL time
    const [hh, mm] = String(time).split(':').map(n => parseInt(n, 10));
    const scheduledTimestamps = selectedDays.map(dateISO => {
      const [y, m, d] = String(dateISO).split('-').map(n => parseInt(n, 10));
      const local = new Date(y, (m - 1), d, hh, mm, 0, 0);
      return local.toISOString();
    });

    showNotification(
      `Scheduling message to ${selectedRecipients.length} recipient(s) on ${selectedDays.length} day(s)...`,
      'info'
    );

   // Send to all selected recipients × all selected days (BUNDLED PER DAY)
let successCount = 0;
let failCount = 0;

const attempted = selectedRecipients.length * scheduledTimestamps.length;

for (const scheduledTimestamp of scheduledTimestamps) {
  const successfulRecipientsForThisDay = [];

  for (const recipient of selectedRecipients) {
    try {
      await AzureVMAPI.scheduleMessage(recipient.userId, content, scheduledTimestamp, allFiles);

      successfulRecipientsForThisDay.push(recipient);
      successCount++;
    } catch (err) {
      console.error(`Failed to schedule for ${recipient.chatName} at ${scheduledTimestamp}:`, err);
      failCount++;
    }
  }

  // Add ONE bundled message entry for this day, containing all successful recipients
  if (successfulRecipientsForThisDay.length > 0) {
    AppState.scheduledMessages = AppState.scheduledMessages || [];
    AppState.scheduledMessages.push({
      id: generateId(),

      // bundled recipients
      recipients: successfulRecipientsForThisDay.map(r => r.chatName),
      target_user_ids: successfulRecipientsForThisDay.map(r => r.userId),

      message_content: content,
      scheduled_time: scheduledTimestamp,
      status: 'pending',

      files: allFiles.map(f => ({ name: f.name, size: f.size }))
    });
  }
}

    const fileCountMsg = allFiles.length > 0 ? ` with ${allFiles.length} file(s)` : '';

    if (failCount === 0) {
      showNotification(`Scheduled ${successCount}/${attempted}${fileCountMsg}!`, 'success');
    } else {
      showNotification(`Scheduled ${successCount}/${attempted}, failed ${failCount}${fileCountMsg}`, 'warning');
    }

    navigateTo('scheduling');
  } catch (error) {
    console.error('Error scheduling message:', error);
    showNotification('Failed to schedule message: ' + (error?.message || error), 'error');
  }
}


// ✅ Draft saving for "Recurring Message Drafts"
function _draftStorageKey() {
  return AppState.userId ? `message_drafts_${AppState.userId}` : 'message_drafts_guest';
}

function _loadDrafts() {
  try {
    const raw = localStorage.getItem(_draftStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _saveDrafts(drafts) {
  try {
    localStorage.setItem(_draftStorageKey(), JSON.stringify(drafts || []));
  } catch (e) {
    console.warn('Failed to save drafts:', e);
  }
}

function saveDraft() {
  const message = document.getElementById('message-content')?.value || '';

  if (selectedRecipients.length === 0) { showNotification('Please select at least one recipient', 'warning'); return; }
  if (!message.trim()) { showNotification('Please enter a message to save', 'warning'); return; }

  const drafts = _loadDrafts();

  // Save a draft for each selected recipient
  selectedRecipients.forEach(recipient => {
    drafts.unshift({
      id: generateId(),
      target_user_id: recipient.userId,
      message_content: message,
      created_at: new Date().toISOString()
    });
  });

  _saveDrafts(drafts);
  showNotification(`Draft saved for ${selectedRecipients.length} recipient(s)`, 'success');
}

function clearForm() {
  const contentTextarea = document.getElementById('message-content');
  if (contentTextarea) contentTextarea.value = '';
  selectedLocalFiles = [];
  selectedRecipients = [];
  AppState.selectedCloudFilesForScheduler = [];
  renderFileList();
  renderRecipientsList();
  // Re-render dropdown to update checkboxes
  const searchInput = document.getElementById('recipient-search-input');
  if (searchInput) {
    searchInput.value = '';
    filterRecipients('');
  }
  updateCharCount();
  showNotification('Form cleared', 'info');
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.renderScheduleMessagePage = renderScheduleMessagePage;
  window.updateCharCount = updateCharCount;
  window.handleLocalFileSelect = handleLocalFileSelect;
  window.removeLocalFile = removeLocalFile;
  window.goToDocumentsForSelection = goToDocumentsForSelection;
  window.removeCloudFileFromScheduler = removeCloudFileFromScheduler;
  window.renderFileList = renderFileList;
  window.setQuickSchedule = setQuickSchedule;
  window.submitScheduledMessage = submitScheduledMessage;
  window.saveDraft = saveDraft;
  window.clearForm = clearForm;
  // Multi-recipient functions
  window.toggleRecipient = toggleRecipient;
  window.removeRecipient = removeRecipient;
  window.selectAllRecipients = selectAllRecipients;
  window.clearAllRecipients = clearAllRecipients;
  window.renderRecipientsList = renderRecipientsList;
  window.filterRecipients = filterRecipients;
  window.renderRecipientDropdown = renderRecipientDropdown;
  window.hideRecipientDropdown = hideRecipientDropdown;
  window.showRecipientDropdown = showRecipientDropdown;
  window.removeSelectedDay = removeSelectedDay;
  window.openCalendarDayPicker = openCalendarDayPicker;


}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const searchInput = document.getElementById('recipient-search-input');
  const dropdown = document.getElementById('recipient-dropdown');

  if (searchInput && dropdown &&
      !searchInput.contains(e.target) &&
      !dropdown.contains(e.target)) {
    hideRecipientDropdown();
  }
});
