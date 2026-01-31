// ============================================
// CALENDAR VIEW (DAY PICKER + DAY DETAILS MODAL)
// - Calendar page is now its own thing
// - Supports "Select days" mode (like Documents select)
// - Normal mode: click a day -> popup showing that day's messages + delete + schedule button
// - Done (select mode) -> goes to Scheduling with selected days prefilled
// ============================================

function ensureCalendarStyles() {
  if (document.getElementById('calendar-view-styles')) return;

  const style = document.createElement('style');
  style.id = 'calendar-view-styles';
  style.textContent = `
    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .cal-title {
      font-weight: 600;
      font-size: 16px;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
    }

    .cal-dow {
      font-size: 12px;
      color: var(--text-muted);
      padding: 0 6px;
      font-weight: 600;
    }

    .cal-cell {
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 10px;
      min-height: 84px;
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      user-select: none;
    }

    .cal-cell:hover {
      transform: translateY(-1px);
      border-color: var(--border-default);
      background: var(--bg-secondary);
    }

    .cal-cell.is-outside { opacity: 0.55; }

    .cal-cell.is-today {
      border-color: var(--accent-primary);
      background: var(--accent-primary-soft);
    }

    .cal-cell.is-selected {
      border-color: var(--accent-primary);
      background: var(--accent-primary-soft);
      box-shadow: 0 0 0 3px var(--accent-primary-soft);
    }

    .cal-daynum {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .cal-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(0,0,0,0.06);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .cal-chip {
      display: block;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: rgba(0,0,0,0.03);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    .cal-chip.sent { opacity: 0.8; }

    .cal-chip.pending {
      border-color: rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.10);
    }

    .cal-footer-note {
      margin-top: 14px;
      font-size: 12px;
      color: var(--text-muted);
    }

    /* ---- Day Details Modal ---- */
    .cal-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    }

    .cal-modal {
      width: min(720px, 96vw);
      max-height: 86vh;
      overflow: auto;
      background: var(--bg-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      padding: 16px;
    }

    .cal-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .cal-modal-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
    }

    .cal-modal-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .cal-modal-close {
      border: none;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      cursor: pointer;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-primary);
    }

    .cal-modal-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }

    .cal-msg-row {
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .cal-msg-left {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cal-msg-topline {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .cal-pill {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      color: var(--text-muted);
      text-transform: lowercase;
    }

    .cal-pill.sent {
      border-color: rgba(34,197,94,0.35);
      background: rgba(34,197,94,0.10);
      color: var(--success);
    }

    .cal-pill.pending {
      border-color: rgba(245,158,11,0.35);
      background: rgba(245,158,11,0.10);
      color: var(--warning);
    }

    .cal-msg-text {
      font-size: 13px;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .cal-msg-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .cal-modal-footer {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .cal-msg-actions {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .cal-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.12s ease, border-color 0.12s ease;
    }

    .cal-icon-btn:hover {
      transform: translateY(-1px);
      border-color: var(--border-default);
    }

    .cal-icon-btn.danger {
      color: var(--error);
      border-color: rgba(239,68,68,0.35);
      background: rgba(239,68,68,0.08);
    }
  `;
  document.head.appendChild(style);
}

function _calStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function _calEndOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function _calISODateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function _calSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function _calAddDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function _calendarGetCurrentMonth() {
  if (!AppState.calendarMonthISO) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    AppState.calendarMonthISO = _calISODateOnly(first);
  }
  const [y, m] = AppState.calendarMonthISO.split('-').map(Number);
  return new Date(y, (m - 1), 1);
}

function _calendarSetMonth(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  AppState.calendarMonthISO = _calISODateOnly(first);
}

function _calendarGetMessagesByDay() {
  const map = new Map();
  const msgs = AppState.scheduledMessages || [];

  msgs.forEach(m => {
    const ts = m.scheduled_time || m.scheduled_timestamp;
    if (!ts) return;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    const key = _calISODateOnly(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  });

  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => {
      const ta = Date.parse(a.scheduled_time || a.scheduled_timestamp || 0) || 0;
      const tb = Date.parse(b.scheduled_time || b.scheduled_timestamp || 0) || 0;
      return ta - tb;
    });
    map.set(k, arr);
  }

  return map;
}

// -------------------------------
// Day Selection Mode (like Documents select)
// -------------------------------
function _calendarGetSelectedDaysSet() {
  if (!Array.isArray(AppState.selectedScheduleDays)) AppState.selectedScheduleDays = [];
  return new Set(AppState.selectedScheduleDays);
}

function _calendarSetSelectedDaysFromSet(set) {
  AppState.selectedScheduleDays = Array.from(set).sort();
}

function startDaySelectionMode() {
  AppState.daySelectionMode = true;
  if (!Array.isArray(AppState.selectedScheduleDays)) AppState.selectedScheduleDays = [];
  renderCalendar();
}

function cancelDaySelection() {
  AppState.daySelectionMode = false;
  renderCalendar();
}

function confirmDaySelectionAndGo() {
  const selected = Array.isArray(AppState.selectedScheduleDays) ? AppState.selectedScheduleDays : [];
  if (selected.length === 0) {
    showNotification('Select at least one day first', 'warning');
    return;
  }
  AppState.daySelectionMode = false;
  navigateTo('scheduling');
}

// -------------------------------
// Day details modal helpers
// -------------------------------
function _calEscapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _calGetMessagesForDate(dateISO) {
  const msgs = AppState.scheduledMessages || [];
  return msgs
    .filter(m => {
      const ts = m.scheduled_time || m.scheduled_timestamp;
      if (!ts) return false;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return false;
      return _calISODateOnly(d) === dateISO;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.scheduled_time || a.scheduled_timestamp || 0) || 0;
      const tb = Date.parse(b.scheduled_time || b.scheduled_timestamp || 0) || 0;
      return ta - tb;
    });
}

function closeDayDetailsModal() {
  const el = document.getElementById('cal-day-modal');
  if (el) el.remove();
}

function scheduleMessageForDay(dateISO) {
  AppState.daySelectionMode = false;
  AppState.selectedScheduleDays = [dateISO];
  closeDayDetailsModal();
  navigateTo('scheduling');
}

async function deleteCalendarMessage(messageId) {
  const messages = AppState.scheduledMessages || [];
  const idx = messages.findIndex(m =>
    String(m.id) === String(messageId) || String(m.server_id) === String(messageId)
  );

  if (idx < 0) {
    showNotification('Message not found', 'warning');
    return;
  }

  const msg = messages[idx];
  const serverMessageId = msg.server_id || msg.id;

  try {
    if (window.AzureVMAPI && typeof AzureVMAPI.deleteMessage === 'function') {
      await AzureVMAPI.deleteMessage(serverMessageId);
    }

    messages.splice(idx, 1);
    AppState.scheduledMessages = messages;

    showNotification('Message deleted', 'success');

    const ts = msg.scheduled_time || msg.scheduled_timestamp;
    const dayISO = ts ? _calISODateOnly(new Date(ts)) : null;
    if (dayISO) openDayDetailsModal(dayISO);

    renderCalendar();
  } catch (error) {
    console.error('Delete failed:', error);

    const msgText = String(error?.message || error || '');
    if (msgText.includes('404') || msgText.toLowerCase().includes('not found')) {
      messages.splice(idx, 1);
      AppState.scheduledMessages = messages;
      showNotification('Removed locally (already deleted on server).', 'info');

      const ts = msg.scheduled_time || msg.scheduled_timestamp;
      const dayISO = ts ? _calISODateOnly(new Date(ts)) : null;
      if (dayISO) openDayDetailsModal(dayISO);

      renderCalendar();
      return;
    }

    showNotification('Failed to delete message', 'error');
  }
}

function openDayDetailsModal(dateISO) {
  closeDayDetailsModal();

  const msgs = _calGetMessagesForDate(dateISO);
  const title = `Messages for ${dateISO}`;
  const subtitle = msgs.length
    ? `${msgs.length} message${msgs.length === 1 ? '' : 's'} scheduled`
    : `No messages scheduled`;

  const rowsHtml = msgs.length
    ? msgs.map(m => {
        const status = (m.status === 'sent') ? 'sent' : 'pending';
        const text = (m.message_content || m.message || '').trim() || '(no text)';
        const filesCount = Array.isArray(m.files) ? m.files.length : (Array.isArray(m.attachments) ? m.attachments.length : 0);

        const timeLabel = (() => {
          const ts = m.scheduled_time || m.scheduled_timestamp;
          if (!ts) return '';
          const dt = new Date(ts);
          if (isNaN(dt.getTime())) return '';
          return dt.toLocaleString();
        })();

        const deleteId = String(m.server_id || m.id);

        return `
          <div class="cal-msg-row">
            <div class="cal-msg-left">
              <div class="cal-msg-topline">
                <span class="cal-pill ${status}">${status}</span>
                ${timeLabel ? `<span class="cal-msg-meta">${_calEscapeHtml(timeLabel)}</span>` : ''}
                <span class="cal-msg-meta">• ${filesCount} file${filesCount === 1 ? '' : 's'}</span>
              </div>
              <div class="cal-msg-text">${_calEscapeHtml(text)}</div>
            </div>

            <div class="cal-msg-actions">
              <button
                class="cal-icon-btn danger"
                title="Delete message"
                onclick="deleteCalendarMessage('${_calEscapeHtml(deleteId)}')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="text-center py-8 text-muted">
        <p>No messages found.</p>
      </div>
    `;

  const modal = document.createElement('div');
  modal.id = 'cal-day-modal';
  modal.className = 'cal-modal-backdrop';
  modal.innerHTML = `
    <div class="cal-modal" role="dialog" aria-modal="true" aria-label="${_calEscapeHtml(title)}">
      <div class="cal-modal-header">
        <div>
          <div class="cal-modal-title">${_calEscapeHtml(title)}</div>
          <div class="cal-modal-subtitle">${_calEscapeHtml(subtitle)}</div>
        </div>
        <button class="cal-modal-close" onclick="closeDayDetailsModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
      </div>

      <div class="cal-modal-list">
        ${rowsHtml}
      </div>

      <div class="cal-modal-footer">
        <button class="btn btn-secondary" onclick="closeDayDetailsModal()">Done</button>
        <button class="btn btn-primary" onclick="scheduleMessageForDay('${_calEscapeHtml(dateISO)}')">
          Schedule message for this day
        </button>
      </div>
    </div>
  `;

  // click outside closes
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDayDetailsModal();
  });

  // escape closes
  const onKey = (e) => {
    if (e.key === 'Escape') {
      closeDayDetailsModal();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(modal);
}

// -------------------------------
// Calendar navigation + click handler
// -------------------------------
function calendarDayClicked(dateISO) {
  if (AppState.daySelectionMode) {
    const set = _calendarGetSelectedDaysSet();
    if (set.has(dateISO)) set.delete(dateISO);
    else set.add(dateISO);
    _calendarSetSelectedDaysFromSet(set);
    renderCalendar();
    return;
  }

  // Not selecting: open the day details popup
  openDayDetailsModal(dateISO);
}

function calendarGoPrevMonth() {
  const cur = _calendarGetCurrentMonth();
  _calendarSetMonth(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
  renderCalendar();
}

function calendarGoNextMonth() {
  const cur = _calendarGetCurrentMonth();
  _calendarSetMonth(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
  renderCalendar();
}

function calendarGoToday() {
  const now = new Date();
  _calendarSetMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  renderCalendar();
}

// -------------------------------
// Render
// -------------------------------
function renderCalendar() {
  ensureCalendarStyles();

  const content = document.getElementById('content');
  if (!content) return;

  const month = _calendarGetCurrentMonth();
  const monthStart = _calStartOfMonth(month);

  const now = new Date();

  // Monday-start grid
  const startDow = (monthStart.getDay() + 6) % 7;
  const gridStart = _calAddDays(monthStart, -startDow);

  const days = [];
  for (let i = 0; i < 42; i++) days.push(_calAddDays(gridStart, i));

  const byDay = _calendarGetMessagesByDay();
  const monthLabel = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isSelectionMode = AppState.daySelectionMode === true;
  const selectedSet = _calendarGetSelectedDaysSet();

  const selectionHeader = isSelectionMode ? `
    <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-primary-soft); border: 1px solid var(--accent-primary);">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--accent-primary); display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
            </svg>
          </div>
          <div>
            <p class="font-semibold" style="color: var(--accent-primary);">Select Days</p>
            <p class="text-xs text-muted">Click days to highlight them. You can change months too.</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2" style="padding: 6px 12px; border-radius: 8px; background: var(--bg-secondary);">
            <div style="width: 24px; height: 24px; border-radius: 6px; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">
              ${selectedSet.size}
            </div>
            <span class="text-sm">${selectedSet.size === 1 ? 'day selected' : 'days selected'}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="cancelDaySelection()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
          </button>
          <button class="btn btn-primary btn-sm" onclick="confirmDaySelectionAndGo()" ${selectedSet.size === 0 ? 'disabled style="opacity:0.5;"' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Done
          </button>
        </div>
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="animate-slide-up">
      ${selectionHeader}

      <div class="card">
        <div class="cal-header">
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-sm" onclick="calendarGoPrevMonth()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Prev
            </button>

            <button class="btn btn-ghost btn-sm" onclick="calendarGoToday()">Today</button>

            <button class="btn btn-ghost btn-sm" onclick="calendarGoNextMonth()">
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div class="cal-title">${monthLabel}</div>

          <div class="flex items-center gap-2">
            ${!isSelectionMode ? `
              <button class="btn btn-secondary btn-sm" onclick="startDaySelectionMode()" title="Select multiple days to schedule messages on">
                Select days
              </button>
            ` : ``}
          </div>
        </div>

        <div class="cal-grid" style="margin-bottom: 10px;">
          ${dow.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        </div>

        <div class="cal-grid">
          ${days.map(d => {
            const dateISO = _calISODateOnly(d);
            const isOutside = d.getMonth() !== month.getMonth();
            const isToday = _calSameDay(d, now);
            const isSelected = selectedSet.has(dateISO);

            const msgs = byDay.get(dateISO) || [];
            const count = msgs.length;

            const preview = msgs.slice(0, 2).map(m => {
              const status = (m.status === 'sent') ? 'sent' : 'pending';
              const txt = (m.message_content || m.message || '').trim();
              const safeTitle = _calEscapeHtml(txt);
              return `<span class="cal-chip ${status}" title="${safeTitle}">${_calEscapeHtml(txt || '(no text)')}</span>`;
            }).join('');

            const more = (count > 2) ? `<span class="cal-chip" style="opacity:0.75;">+${count - 2} more</span>` : '';

            const hint = isSelectionMode
              ? `Click to ${isSelected ? 'unselect' : 'select'} ${dateISO}`
              : `Click to view messages for ${dateISO}`;

            return `
              <div
                class="cal-cell ${isOutside ? 'is-outside' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}"
                onclick="calendarDayClicked('${dateISO}')"
                title="${_calEscapeHtml(hint)}"
              >
                <div class="cal-daynum">
                  <span>${d.getDate()}</span>
                  ${count > 0 ? `<span class="cal-badge">${count}</span>` : ``}
                </div>

                ${count > 0 ? `<div class="flex flex-col gap-2">${preview}${more}</div>` : `
                  <div class="text-xs text-muted" style="margin-top: 6px;">No messages</div>
                `}
              </div>
            `;
          }).join('')}
        </div>

        <div class="cal-footer-note">
          ${isSelectionMode
            ? `Select multiple days, then hit Done to open Scheduling with those days preloaded.`
            : `Tip: Use “Select days” to schedule across multiple dates at once.`
          }
        </div>
      </div>
    </div>
  `;
}

// Export
if (typeof window !== 'undefined') {
  window.renderCalendar = renderCalendar;
  window.calendarGoPrevMonth = calendarGoPrevMonth;
  window.calendarGoNextMonth = calendarGoNextMonth;
  window.calendarGoToday = calendarGoToday;

  window.startDaySelectionMode = startDaySelectionMode;
  window.cancelDaySelection = cancelDaySelection;
  window.confirmDaySelectionAndGo = confirmDaySelectionAndGo;

  window.openDayDetailsModal = openDayDetailsModal;
  window.closeDayDetailsModal = closeDayDetailsModal;
  window.scheduleMessageForDay = scheduleMessageForDay;
  window.deleteCalendarMessage = deleteCalendarMessage;

  window.calendarDayClicked = calendarDayClicked;
}
