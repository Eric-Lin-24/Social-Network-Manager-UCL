// ============================================
// SCHEDULE MESSAGE - Core
// Day picker, message composer render,
// submission, drafts, and email user modal
// ============================================

// Attribute escaping: uses shared escapeAttr from utils.js
function _saveCurrentFormState() {
  AppState.schedulerFormState = {
    messageContent: document.getElementById('message-content')?.value || '',
    time: document.getElementById('message-time')?.value || '',
    emailSubject: document.getElementById('email-subject')?.value || '',
    channel: _getComposeChannel(),
    recipients: [...selectedRecipients],
    localFiles: [...selectedLocalFiles],
    selectedDays: [...(AppState.selectedScheduleDays || [])]
  };
}

function openCalendarDayPicker() {
  // enter selection mode + keep whatever is already selected
  _saveCurrentFormState();
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
  _saveCurrentFormState();
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
          <button onclick="removeSelectedDay('${escapeAttr(d)}')" style="border:none;background:none;cursor:pointer;color:var(--text-muted);display:flex;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </span>
      `).join('')}
    </div>
  `;
}

// Channel toggle (Telegram vs Email)

function renderScheduleMessagePage() {
  const content = document.getElementById('content');

  // Restore form state if returning from document selection or project message flow
  const savedState = AppState.schedulerFormState;
  if (savedState) {
    selectedLocalFiles = savedState.localFiles || [];
    selectedRecipients = savedState.recipients || [];
    // Restore channel BEFORE reading it for the render
    if (savedState.channel) {
      AppState.composeChannel = savedState.channel;
    }
    // Restore selected days
    if (savedState.selectedDays && savedState.selectedDays.length > 0) {
      AppState.selectedScheduleDays = savedState.selectedDays;
    }
  } else if (Array.isArray(AppState.messagePrefillRecipients) && AppState.messagePrefillRecipients.length > 0) {
    // Pre-fill recipients from People page (member / team message button)
    selectedLocalFiles = [];
    selectedRecipients = AppState.messagePrefillRecipients.slice();
    AppState.messagePrefillRecipients = null;
  } else {
    selectedLocalFiles = [];
    selectedRecipients = [];
  }

  const channel = _getComposeChannel();
  const subscribedChats = channel === 'email' ? _getRecipientSource() : (AppState.subscribedChats || []);

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

          <!-- Channel Toggle -->
          <div class="flex gap-2 mb-6">
            <button
              class="btn ${channel === 'telegram' ? 'btn-primary' : 'btn-secondary'} btn-sm"
              onclick="setComposeChannel('telegram')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              Telegram
            </button>
            <button
              class="btn ${channel === 'email' ? 'btn-primary' : 'btn-secondary'} btn-sm"
              onclick="setComposeChannel('email')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Email
            </button>
          </div>

          <div class="flex flex-col gap-6">
            <!-- Recipient Selection (Multi-select) -->
            <div class="form-group">
              <label class="form-label">${channel === 'email' ? 'Email Recipients' : 'Recipients'}</label>

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
                  ${channel === 'email' ? 'No subscribed email users found.' : 'No subscribed chats found.'}
                  <button class="text-accent" style="background: none; border: none; cursor: pointer; text-decoration: underline;" onclick="${channel === 'email' ? 'AzureVMAPI.refreshSubscribedEmailUsers()' : 'AzureVMAPI.refreshSubscribedChats()'}">Refresh</button>
                  ${channel === 'email' ? `
                    &nbsp;or&nbsp;
                    <button class="text-accent" style="background: none; border: none; cursor: pointer; text-decoration: underline;" onclick="showAddEmailUserModal()">Add email recipient</button>
                  ` : ''}
                </p>
              ` : `
                <div class="flex items-center gap-2 mt-2">
                  <p class="text-xs text-muted">${subscribedChats.length} ${channel === 'email' ? 'email user(s)' : 'chat(s)'} available</p>
                  ${channel === 'email' ? `
                    <button class="text-accent text-xs" style="background: none; border: none; cursor: pointer; text-decoration: underline;" onclick="showAddEmailUserModal()">+ Add new</button>
                  ` : ''}
                </div>
              `}
            </div>

            ${channel === 'email' ? `
            <!-- Email Subject -->
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input
                type="text"
                id="email-subject"
                class="form-input w-full"
                placeholder="Enter email subject..."
              />
            </div>
            ` : ''}

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
                  ${channel === 'email'
                    ? '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'
                    : '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'}
                </svg>
                ${channel === 'email' ? 'Schedule Email' : 'Schedule Message'}
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
      const subjectInput = document.getElementById('email-subject');

      // Restore message content
      if (messageBox && savedState.messageContent) {
        messageBox.value = savedState.messageContent;
      }

      // Restore time
      if (timeInput && savedState.time) {
        timeInput.value = savedState.time;
      }

      // Restore email subject
      if (subjectInput && savedState.emailSubject) {
        subjectInput.value = savedState.emailSubject;
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

  // Always render recipients list (handles prefill from People page, etc.)
  if (selectedRecipients.length > 0) {
    renderRecipientsList();
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

function setQuickSchedule(option) {
  const timeInput = document.getElementById('message-time');
  const now = new Date();
  switch (option) {
    case 'now': now.setMinutes(now.getMinutes() + 1); break;
    case '1h': now.setHours(now.getHours() + 1); break;
    case 'tomorrow':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      // Update selected days to tomorrow
      AppState.selectedScheduleDays = [dateToLocalISO(now)];
      break;
  }
  if (timeInput) timeInput.value = now.toISOString().slice(11, 16);
  if (option === 'now' || option === '1h') {
    AppState.selectedScheduleDays = [dateToLocalISO(now)];
  }
  _saveCurrentFormState();
  showNotification('Schedule time updated', 'info');
  renderScheduleMessagePage();
}

// Submit message
async function submitScheduledMessage() {
  const channel = _getComposeChannel();
  const content = document.getElementById('message-content')?.value || '';
  const subject = document.getElementById('email-subject')?.value || '';

  const time = document.getElementById('message-time')?.value || '';

  const selectedDays = Array.from(new Set(AppState.selectedScheduleDays || [])).sort();

  const normalizeSource = (src) => String(src || '').trim().toLowerCase();

  // Validate recipients
  if (selectedRecipients.length === 0) { showNotification('Please select at least one recipient', 'warning'); return; }
  if (!content.trim()) { showNotification('Please enter a message', 'warning'); return; }

  // Validate email subject
  if (channel === 'email' && !subject.trim()) { showNotification('Please enter an email subject', 'warning'); return; }

  // Validate time + days
  if (!time) { showNotification('Please select a time', 'warning'); return; }
  if (selectedDays.length === 0) { showNotification('Please select at least one day', 'warning'); return; }

  try {
    showNotification('Preparing message...', 'info');

    const cloudFilesToSend = AppState.selectedCloudFilesForScheduler || [];

    const downloadedCloudFiles = [];
    if (cloudFilesToSend.length > 0) {
      showNotification(`Downloading ${cloudFilesToSend.length} cloud file(s)...`, 'info');
      for (const cloudFile of cloudFilesToSend) {
        const source = normalizeSource(cloudFile.source);

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
          }
        } catch (error) {
          console.error(`Failed to download ${cloudFile.name}:`, error);
          showNotification(`Failed to download ${cloudFile.name}`, 'error');
        }
      }
    }

    const allFiles = [...selectedLocalFiles, ...downloadedCloudFiles];

    // Build timestamps for EACH selected day using LOCAL time
    const [hh, mm] = String(time).split(':').map(n => parseInt(n, 10));
    const scheduledTimestamps = selectedDays.map(dateISO => {
      const [y, m, d] = String(dateISO).split('-').map(n => parseInt(n, 10));
      const local = new Date(y, (m - 1), d, hh, mm, 0, 0);
      return local.toISOString();
    });

    showNotification(
      `Scheduling ${channel === 'email' ? 'email' : 'message'} to ${selectedRecipients.length} recipient(s) on ${selectedDays.length} day(s)...`,
      'info'
    );

   // Send to all selected recipients x all selected days (BUNDLED PER DAY)
let successCount = 0;
let failCount = 0;

const attempted = selectedRecipients.length * scheduledTimestamps.length;

for (const scheduledTimestamp of scheduledTimestamps) {
  const successfulRecipientsForThisDay = [];

  for (const recipient of selectedRecipients) {
    try {
      if (channel === 'email') {
        await AzureVMAPI.scheduleEmail(recipient.userId, subject, content, scheduledTimestamp, allFiles);
      } else {
        await AzureVMAPI.scheduleMessage(recipient.userId, content, scheduledTimestamp, allFiles);
      }

      successfulRecipientsForThisDay.push(recipient);
      successCount++;
    } catch (err) {
      console.error(`Failed to schedule for ${recipient.chatName} at ${scheduledTimestamp}:`, err);
      failCount++;
    }
  }

  // Add ONE bundled entry for this day, containing all successful recipients
  if (successfulRecipientsForThisDay.length > 0) {
    const entry = {
      id: generateId(),
      recipients: successfulRecipientsForThisDay.map(r => r.chatName),
      target_user_ids: successfulRecipientsForThisDay.map(r => r.userId),
      message_content: content,
      scheduled_time: scheduledTimestamp,
      status: 'pending',
      platform: channel,
      files: allFiles.map(f => ({ name: f.name, size: f.size }))
    };

    if (channel === 'email') {
      entry.subject = subject;
      AppState.scheduledEmails = AppState.scheduledEmails || [];
      AppState.scheduledEmails.push(entry);
    } else {
      AppState.scheduledMessages = AppState.scheduledMessages || [];
      AppState.scheduledMessages.push(entry);
    }
  }
}

    const fileCountMsg = allFiles.length > 0 ? ` with ${allFiles.length} file(s)` : '';
    const typeLabel = channel === 'email' ? 'email(s)' : 'message(s)';

    if (failCount === 0) {
      showNotification(`Scheduled ${successCount}/${attempted} ${typeLabel}${fileCountMsg}!`, 'success');
    } else {
      showNotification(`Scheduled ${successCount}/${attempted} ${typeLabel}, failed ${failCount}${fileCountMsg}`, 'warning');
    }

    navigateTo('scheduling');
  } catch (error) {
    console.error('Error scheduling message:', error);
    showNotification('Failed to schedule message: ' + (error?.message || error), 'error');
  }
}


// Draft storage: uses shared loadDrafts/saveDrafts from utils.js

function saveDraft() {
  const message = document.getElementById('message-content')?.value || '';

  if (selectedRecipients.length === 0) { showNotification('Please select at least one recipient', 'warning'); return; }
  if (!message.trim()) { showNotification('Please enter a message to save', 'warning'); return; }

  const drafts = loadDrafts();

  // Save a draft for each selected recipient
  selectedRecipients.forEach(recipient => {
    drafts.unshift({
      id: generateId(),
      target_user_id: recipient.userId,
      message_content: message,
      created_at: new Date().toISOString()
    });
  });

  saveDrafts(drafts);
  showNotification(`Draft saved for ${selectedRecipients.length} recipient(s)`, 'success');
}

function clearForm() {
  const contentTextarea = document.getElementById('message-content');
  if (contentTextarea) contentTextarea.value = '';
  const subjectInput = document.getElementById('email-subject');
  if (subjectInput) subjectInput.value = '';
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

// Modal for adding a new email recipient
function showAddEmailUserModal() {
  // Remove existing modal if present
  const existing = document.getElementById('add-email-user-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'add-email-user-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'width:400px;max-width:90vw;';
  card.addEventListener('click', function(e) { e.stopPropagation(); });

  card.innerHTML =
    '<h3 class="font-semibold mb-4">Add Email Recipient</h3>' +
    '<div class="flex flex-col gap-4">' +
    '  <div class="form-group">' +
    '    <label class="form-label">Name</label>' +
    '    <input type="text" id="new-email-user-name" class="form-input w-full" placeholder="Recipient name..." />' +
    '  </div>' +
    '  <div class="form-group">' +
    '    <label class="form-label">Email Address</label>' +
    '    <input type="email" id="new-email-user-address" class="form-input w-full" placeholder="email@example.com" />' +
    '  </div>' +
    '  <div id="add-email-modal-error" class="text-sm" style="color:var(--error);display:none;"></div>' +
    '  <div class="flex gap-2 justify-end">' +
    '    <button class="btn btn-ghost btn-sm" id="add-email-cancel-btn">Cancel</button>' +
    '    <button class="btn btn-primary btn-sm" id="add-email-submit-btn">Add Recipient</button>' +
    '  </div>' +
    '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Wire up buttons via addEventListener
  card.querySelector('#add-email-cancel-btn').addEventListener('click', function() {
    overlay.remove();
  });
  card.querySelector('#add-email-submit-btn').addEventListener('click', function() {
    submitAddEmailUser();
  });

  // Focus the name input
  setTimeout(function() {
    var nameInput = document.getElementById('new-email-user-name');
    if (nameInput) nameInput.focus();
  }, 100);
}

async function submitAddEmailUser() {
  const userName = document.getElementById('new-email-user-name')?.value?.trim() || '';
  const emailAddress = document.getElementById('new-email-user-address')?.value?.trim() || '';
  const errorDiv = document.getElementById('add-email-modal-error');
  const submitBtn = document.getElementById('add-email-submit-btn');

  // Reset error
  if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }

  if (!userName) {
    if (errorDiv) { errorDiv.textContent = 'Please enter a name'; errorDiv.style.display = 'block'; }
    return;
  }
  if (!emailAddress) {
    if (errorDiv) { errorDiv.textContent = 'Please enter an email address'; errorDiv.style.display = 'block'; }
    return;
  }

  // Show loading state
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding...'; }

  try {
    await AzureVMAPI.subscribeEmailUser(emailAddress, userName);
    showNotification('Added ' + userName + ' (' + emailAddress + ')', 'success');

    // Remove modal
    const modal = document.getElementById('add-email-user-modal');
    if (modal) modal.remove();

    // Refresh email users and re-render
    await AzureVMAPI.fetchSubscribedEmailUsers();
    if (typeof renderScheduling === 'function' && AppState.currentView === 'scheduling') {
      renderScheduling();
    } else {
      renderScheduleMessagePage();
    }
  } catch (error) {
    const msg = error?.message || String(error);
    if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add Recipient'; }
  }
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
  // Email / channel functions
  window.setComposeChannel = setComposeChannel;
  window.showAddEmailUserModal = showAddEmailUserModal;
  window.submitAddEmailUser = submitAddEmailUser;
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