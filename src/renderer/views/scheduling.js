// ============================================
// SCHEDULING VIEW (MIGRATED)
// Scheduling page now IS the full composer (formerly scheduleMessage page),
// with Message Queue + Drafts underneath, then Subscribed Chats.
// ============================================

function schedulingDraftStorageKey() {
  return AppState.userId ? `message_drafts_${AppState.userId}` : 'message_drafts_guest';
}

function schedulingLoadDrafts() {
  try {
    const raw = localStorage.getItem(schedulingDraftStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load drafts:', e);
    return [];
  }
}

function schedulingSaveDrafts(drafts) {
  try {
    localStorage.setItem(schedulingDraftStorageKey(), JSON.stringify(drafts || []));
  } catch (e) {
    console.warn('Failed to save drafts:', e);
  }
}

function setSchedulingTab(tab) {
  AppState.schedulingActiveTab = tab;
  renderScheduling();
}

function getRecipientNameByUserId(userId) {
  // Check Telegram chats first, then email users
  const chat = (AppState.subscribedChats || []).find(c => String(c.user_id) === String(userId));
  if (chat) return chat.name || userId || 'Unknown';
  const emailUser = (AppState.subscribedEmailUsers || []).find(u => String(u.user_id) === String(userId));
  if (emailUser) return emailUser.user_name || emailUser.email_address || userId || 'Unknown';
  return userId || 'Unknown';
}

// Draft actions (same storage key as composer)
function deleteDraft(draftId) {
  const drafts = schedulingLoadDrafts().filter(d => d.id !== draftId);
  schedulingSaveDrafts(drafts);
  showNotification('Draft deleted', 'success');
  renderScheduling();
}

function openDraft(draftId) {
  const drafts = schedulingLoadDrafts();
  const draft = drafts.find(d => d.id === draftId);
  if (!draft) {
    showNotification('Draft not found', 'error');
    return;
  }

  // scheduleMessage.js already knows how to consume this
  AppState.scheduleMessagePrefill = {
    target_user_id: draft.target_user_id,
    message_content: draft.message_content
  };

  renderScheduling();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
}

function _safeText(str = '') {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _renderEmailQueueItems(emails) {
  if (emails.length === 0) {
    return '<div class="empty-state" style="padding: 48px 24px;">' +
      '<div class="empty-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
      '<polyline points="22,6 12,13 2,6"/>' +
      '</svg></div>' +
      '<h3>No emails scheduled</h3>' +
      '<p>Switch to the Email channel in the composer above to schedule an email.</p>' +
      '</div>';
  }

  return '<div class="flex flex-col">' +
    emails.map(function(email, index) {
      var recipientDisplay = '';
      if (email.recipients && Array.isArray(email.recipients)) {
        recipientDisplay = email.recipients.join(', ');
      } else if (email.target_user_id) {
        recipientDisplay = getRecipientNameByUserId(email.target_user_id);
      } else {
        recipientDisplay = email.recipient || 'Unknown';
      }

      var hasAttachments = (email.files && Array.isArray(email.files) && email.files.length > 0) ||
                           (email.file_paths && Array.isArray(email.file_paths) && email.file_paths.length > 0);

      var statusClass = email.status === 'sent' ? 'sent' : 'pending';
      var badgeClass = email.status === 'sent' ? 'badge-success' : 'badge-warning';
      var timeDisplay = typeof formatDateTime === 'function' ? formatDateTime(email.scheduled_time) : _safeText(email.scheduled_time || '');

      var html = '<div class="message-item" style="animation: slideUp 0.3s ease ' + (index * 0.05) + 's both;">' +
        '<div class="message-status ' + statusClass + '"></div>' +
        '<div class="message-content">' +
        '<div class="flex justify-between items-start mb-1">' +
        '<div class="flex items-center gap-2">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5; flex-shrink: 0;">' +
        '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
        '<polyline points="22,6 12,13 2,6"/>' +
        '</svg>' +
        '<span class="message-recipient">' + _safeText(recipientDisplay) + '</span>';

      if (hasAttachments) {
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Has attachments" style="opacity: 0.6;">' +
          '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>' +
          '</svg>';
      }

      html += '</div>' +
        '<span class="badge ' + badgeClass + '">' + _safeText(email.status || 'Pending') + '</span>' +
        '</div>';

      if (email.subject) {
        html += '<p class="text-sm font-medium" style="margin-bottom: 2px;">' + _safeText(email.subject) + '</p>';
      }

      html += '<p class="message-preview">' + _safeText(email.message_content || '') + '</p>' +
        '<span class="text-xs text-muted mt-2">' + timeDisplay + '</span>' +
        '</div>' +
        '<div class="flex gap-2">' +
        '<button class="btn-icon" onclick="deleteScheduledEmail(\'' + email.id + '\')" title="Delete" style="color: var(--error);">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<polyline points="3 6 5 6 21 6"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '</svg></button></div></div>';

      return html;
    }).join('') +
    '</div>';
}

function renderScheduling() {
  const content = document.getElementById('content');
  const messages = AppState.scheduledMessages || [];
  const emails = AppState.scheduledEmails || [];
  const subscribedChats = AppState.subscribedChats || [];
  const subscribedEmailUsers = AppState.subscribedEmailUsers || [];
  const drafts = schedulingLoadDrafts();
  const activeTab = AppState.schedulingActiveTab || 'queue';

  // 1) Composer at the top (reuse scheduleMessage.js)
  if (typeof renderScheduleMessagePage === 'function') {
    renderScheduleMessagePage();

    // Remove the "Back to Messages" button (we ARE messages now)
    try {
      const backBtn = content.querySelector('button.btn.btn-ghost.mb-6');
      if (backBtn) backBtn.remove();
    } catch {}
  } else {
    content.innerHTML = `
      <div class="card">
        <h3 class="font-semibold mb-2">Composer not loaded</h3>
        <p class="text-sm text-muted">
          scheduleMessage.js is not included/loaded, so the message composer can't render.
          Add it to your script includes and reload.
        </p>
      </div>
    `;
    return;
  }

  // 2) Messages box underneath (Queue + Email Queue + Drafts)
  const totalScheduled = messages.length + emails.length;
  content.insertAdjacentHTML('beforeend', `
    <div class="card mt-6">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="font-semibold">Messages</h3>
          <p class="text-sm text-muted">${totalScheduled} item${totalScheduled !== 1 ? 's' : ''} scheduled (${messages.length} Telegram, ${emails.length} Email)</p>
        </div>

        <button class="btn btn-ghost btn-sm" onclick="refreshCurrentView()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      <div class="flex gap-2 mb-6">
        <button
          class="btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'} btn-sm"
          onclick="setSchedulingTab('queue')"
        >
          Telegram Queue
        </button>

        <button
          class="btn ${activeTab === 'email-queue' ? 'btn-primary' : 'btn-secondary'} btn-sm"
          onclick="setSchedulingTab('email-queue')"
        >
          Email Queue
        </button>

        <button
          class="btn ${activeTab === 'drafts' ? 'btn-primary' : 'btn-secondary'} btn-sm"
          onclick="setSchedulingTab('drafts')"
        >
          Drafts
        </button>
      </div>

      ${activeTab === 'drafts' ? `
        ${drafts.length === 0 ? `
          <div class="empty-state" style="padding: 48px 24px;">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h3>No drafts yet</h3>
            <p>Write something in the composer and click <b>Save Draft</b>.</p>
          </div>
        ` : `
          <div class="flex flex-col">
            ${drafts.map((d, index) => {
              const recipientName = getRecipientNameByUserId(d.target_user_id);
              return `
                <div class="message-item" style="animation: slideUp 0.3s ease ${index * 0.05}s both;">
                  <div class="message-status pending"></div>
                  <div class="message-content">
                    <div class="flex justify-between items-start mb-1">
                      <span class="message-recipient">${_safeText(recipientName)}</span>
                      <span class="badge badge-info">draft</span>
                    </div>
                    <p class="message-preview">${_safeText(d.message_content || '')}</p>
                    <span class="text-xs text-muted mt-2">${typeof formatDateTime === 'function' ? formatDateTime(d.created_at) : _safeText(d.created_at || '')}</span>
                  </div>
                  <div class="flex gap-2">
                    <button class="btn btn-ghost btn-sm" onclick="openDraft('${d.id}')">Open</button>
                    <button class="btn-icon" onclick="deleteDraft('${d.id}')" title="Delete" style="color: var(--error);">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      ` : activeTab === 'email-queue' ? `
        ${_renderEmailQueueItems(emails)}
      ` : `
        ${messages.length === 0 ? `
          <div class="empty-state" style="padding: 48px 24px;">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>No messages scheduled</h3>
            <p>Use the composer above to schedule a message.</p>
          </div>
        ` : `
          <div class="flex flex-col">
            ${messages.map((msg, index) => {
              let recipientDisplay = '';
              if (msg.recipients && Array.isArray(msg.recipients)) {
                recipientDisplay = msg.recipients.join(', ');
              } else if (msg.target_user_id) {
                recipientDisplay = typeof getRecipientName === 'function'
                  ? getRecipientName(msg.target_user_id)
                  : getRecipientNameByUserId(msg.target_user_id);
              } else {
                recipientDisplay = msg.recipient || 'Unknown';
              }

              const hasAttachments = msg.files && Array.isArray(msg.files) && msg.files.length > 0;

              return `
                <div class="message-item" style="animation: slideUp 0.3s ease ${index * 0.05}s both;">
                  <div class="message-status ${msg.status === 'sent' ? 'sent' : 'pending'}"></div>
                  <div class="message-content">
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-center gap-2">
                        <span class="message-recipient">${_safeText(recipientDisplay)}</span>
                        ${hasAttachments ? `
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="${msg.files.length} attachment(s)" style="opacity: 0.6;">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        ` : ''}
                      </div>
                      <span class="badge ${msg.status === 'sent' ? 'badge-success' : 'badge-warning'}">${_safeText(msg.status || 'Pending')}</span>
                    </div>
                    <p class="message-preview">${_safeText(msg.message_content || '')}</p>
                    <span class="text-xs text-muted mt-2">${typeof formatDateTime === 'function' ? formatDateTime(msg.scheduled_time) : _safeText(msg.scheduled_time || '')}</span>
                  </div>
                  <div class="flex gap-2">
                    <button class="btn-icon" onclick="deleteMessage('${msg.id}')" title="Delete" style="color: var(--error);">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `}
    </div>
  `);

  // 3) Subscribed Telegram chats
  content.insertAdjacentHTML('beforeend', `
    <div class="card mt-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="font-semibold">Telegram Subscribers</h3>
          <p class="text-sm text-muted">${subscribedChats.length} active chat${subscribedChats.length !== 1 ? 's' : ''}</p>
        </div>

        <button class="btn btn-ghost btn-sm" onclick="refreshCurrentView()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      ${subscribedChats.length === 0 ? `
        <div class="text-center py-8 text-muted"><p>No subscribed chats found.</p></div>
      ` : `
        <div class="grid grid-cols-3 gap-4">
          ${subscribedChats.map((chat, index) => `
            <div class="connection-card" style="animation: slideUp 0.3s ease ${index * 0.05}s both;">
              <div class="connection-icon whatsapp">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </div>
              <div class="connection-info">
                <div class="connection-name">${_safeText(chat.name || chat.id)}</div>
                <div class="connection-status">${_safeText(chat.type || 'Group')} • ${_safeText(chat.platform || 'WhatsApp')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `);

  // 4) Subscribed Email users
  content.insertAdjacentHTML('beforeend', `
    <div class="card mt-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="font-semibold">Email Subscribers</h3>
          <p class="text-sm text-muted">${subscribedEmailUsers.length} email recipient${subscribedEmailUsers.length !== 1 ? 's' : ''}</p>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="showAddEmailUserModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
          <button class="btn btn-ghost btn-sm" onclick="AzureVMAPI.refreshSubscribedEmailUsers()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      ${subscribedEmailUsers.length === 0 ? `
        <div class="text-center py-8 text-muted">
          <p>No email subscribers found.</p>
          <button class="btn btn-secondary btn-sm mt-4" onclick="showAddEmailUserModal()">Add email recipient</button>
        </div>
      ` : `
        <div class="grid grid-cols-3 gap-4">
          ${subscribedEmailUsers.map((user, index) => `
            <div class="connection-card" style="animation: slideUp 0.3s ease ${index * 0.05}s both;">
              <div class="connection-icon" style="background: rgba(234, 67, 53, 0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ea4335" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div class="connection-info">
                <div class="connection-name">${_safeText(user.user_name || user.name)}</div>
                <div class="connection-status">${_safeText(user.email_address || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `);

  // Optional: dashboard day-click prefill (if you use it)
  try {
    if (AppState.scheduleMessagePrefillISO) {
      const dt = document.getElementById('message-datetime');
      if (dt) dt.value = String(AppState.scheduleMessagePrefillISO).slice(0, 16);
      AppState.scheduleMessagePrefillISO = null;
    }
  } catch {}
}

async function deleteMessage(messageId) {
  const idx = (AppState.scheduledMessages || []).findIndex(m => m.id === messageId);
  if (idx < 0) return;

  const message = AppState.scheduledMessages[idx];
  const serverMessageId = message.server_id || message.id;

  try {
    if (window.AzureVMAPI && typeof AzureVMAPI.deleteMessage === 'function') {
      await AzureVMAPI.deleteMessage(serverMessageId);
    }
    AppState.scheduledMessages.splice(idx, 1);
    showNotification('Message deleted', 'success');
    renderScheduling();
  } catch (error) {
    console.error('Error deleting message:', error);
    if (error?.message && (error.message.includes('404') || error.message.includes('not found'))) {
      AppState.scheduledMessages.splice(idx, 1);
      showNotification('Message removed locally (already deleted on server).', 'info');
      renderScheduling();
      return;
    }
    showNotification('Failed to delete message: ' + (error?.message || error), 'error');
  }
}

async function deleteScheduledEmail(emailId) {
  const idx = (AppState.scheduledEmails || []).findIndex(m => m.id === emailId);
  if (idx < 0) return;

  const email = AppState.scheduledEmails[idx];
  const serverEmailId = email.server_id || email.id;

  try {
    if (window.AzureVMAPI && typeof AzureVMAPI.deleteEmail === 'function') {
      await AzureVMAPI.deleteEmail(serverEmailId);
    }
    AppState.scheduledEmails.splice(idx, 1);
    showNotification('Email deleted', 'success');
    renderScheduling();
  } catch (error) {
    console.error('Error deleting email:', error);
    if (error?.message && (error.message.includes('404') || error.message.includes('not found'))) {
      AppState.scheduledEmails.splice(idx, 1);
      showNotification('Email removed locally (already deleted on server).', 'info');
      renderScheduling();
      return;
    }
    showNotification('Failed to delete email: ' + (error?.message || error), 'error');
  }
}

// Global for inline onclick
if (typeof window !== 'undefined') {
  window.renderScheduling = renderScheduling;
  window.setSchedulingTab = setSchedulingTab;
  window.openDraft = openDraft;
  window.deleteDraft = deleteDraft;
  window.deleteMessage = deleteMessage;
  window.deleteScheduledEmail = deleteScheduledEmail;
}
