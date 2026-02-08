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

    /* ---- Task Dots on Calendar ---- */
    .cal-task-dots {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
      position: absolute;
      top: 6px;
      right: 8px;
    }
    .cal-task-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      position: relative;
    }
    .cal-task-dot:hover {
      transform: scale(1.5);
      box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
      z-index: 5;
    }
    .cal-task-dot.is-done {
      opacity: 0.4;
    }
    .cal-task-dots-overflow {
      font-size: 9px;
      color: var(--text-muted);
      font-weight: 600;
      line-height: 1;
    }

    /* ---- Task Tooltip ---- */
    .cal-task-tooltip {
      position: fixed;
      z-index: 99999;
      background: var(--bg-primary);
      border: 1px solid var(--border-default);
      border-radius: 10px;
      padding: 10px 12px;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      pointer-events: none;
      animation: calTooltipIn 0.12s ease;
    }
    @keyframes calTooltipIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .cal-task-tooltip-title {
      font-weight: 700;
      font-size: 13px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .cal-task-tooltip-project {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .cal-task-tooltip-meta {
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .cal-task-tooltip-meta span {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* ---- Task rows in day modal ---- */
    .cal-task-row {
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cal-task-row-color {
      width: 4px;
      height: 36px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .cal-task-row-info {
      flex: 1;
      min-width: 0;
    }
    .cal-task-row-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .cal-task-row-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cal-task-row-status {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      flex-shrink: 0;
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

function _calendarGetTasksByDay() {
  const map = new Map();
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  for (const task of tasks) {
    if (!task.start_date || !task.end_date) continue;
    const project = projects.find(p => p.id === task.project_id);
    const color = project ? project.color : '#6b7280';
    const projectName = project ? project.name : '';

    const assigneeIds = task.assignee_id ? task.assignee_id.split(',').filter(Boolean) : [];
    const assigneeNames = assigneeIds.map(id => {
      const m = members.find(mm => mm.id === id);
      return m ? m.name : null;
    }).filter(Boolean);

    // Iterate each day the task spans
    const start = new Date(task.start_date + 'T00:00:00');
    const end = new Date(task.end_date + 'T00:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const key = _calISODateOnly(cur);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        id: task.id,
        title: task.title,
        color,
        projectName,
        startDate: task.start_date,
        endDate: task.end_date,
        status: task.status,
        hoursPerWeek: task.hours_per_week,
        assignees: assigneeNames,
        description: task.description || ''
      });
      cur.setDate(cur.getDate() + 1);
    }
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
  AppState.calendarPrefillRecipients = null;
  AppState.calendarPrefillProjectName = null;
  renderCalendar();
}

function confirmDaySelectionAndGo() {
  const selected = Array.isArray(AppState.selectedScheduleDays) ? AppState.selectedScheduleDays : [];
  if (selected.length === 0) {
    showNotification('Select at least one day first', 'warning');
    return;
  }
  AppState.daySelectionMode = false;

  // If we have prefilled recipients from a project "Send Message" flow,
  // pass them through schedulerFormState so the composer picks them up
  if (AppState.calendarPrefillRecipients && AppState.calendarPrefillRecipients.length > 0) {
    AppState.schedulerFormState = {
      recipients: AppState.calendarPrefillRecipients,
      selectedDays: selected,
      localFiles: [],
      messageContent: ''
    };
    AppState.calendarPrefillRecipients = null;
    AppState.calendarPrefillProjectName = null;
  }

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

  // Get tasks for this day
  const allTasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const dayTasks = allTasks.filter(t => {
    if (!t.start_date || !t.end_date) return false;
    return t.start_date <= dateISO && t.end_date >= dateISO;
  });

  const title = `${dateISO}`;
  const subtitle = [
    msgs.length ? `${msgs.length} message${msgs.length === 1 ? '' : 's'}` : null,
    dayTasks.length ? `${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : null
  ].filter(Boolean).join(' · ') || 'Nothing scheduled';

  // Build task rows HTML
  const taskRowsHtml = dayTasks.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        Tasks
      </div>
      <div class="cal-modal-list" style="gap:8px;">
        ${dayTasks.map(t => {
          const proj = projects.find(p => p.id === t.project_id);
          const color = proj ? proj.color : '#6b7280';
          const projName = proj ? _calEscapeHtml(proj.name) : '';
          const assigneeIds = t.assignee_id ? t.assignee_id.split(',').filter(Boolean) : [];
          const assigneeNames = assigneeIds.map(id => {
            const m = members.find(mm => mm.id === id);
            return m ? _calEscapeHtml(m.name) : null;
          }).filter(Boolean);

          const statusMap = { done: { label: 'Done', bg: 'rgba(16,185,129,0.15)', color: '#10b981' }, in_progress: { label: 'In Progress', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' } };
          const st = statusMap[t.status] || { label: t.status || 'Planned', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };

          return `
            <div class="cal-task-row">
              <div class="cal-task-row-color" style="background:${color};"></div>
              <div class="cal-task-row-info">
                <div class="cal-task-row-title">${_calEscapeHtml(t.title)}</div>
                <div class="cal-task-row-meta">
                  ${projName ? `<span style="color:${color};font-weight:600;">${projName}</span>` : ''}
                  <span>${_calEscapeHtml(t.start_date)} → ${_calEscapeHtml(t.end_date)}</span>
                  <span>${t.hours_per_week || 0}h/wk</span>
                  ${assigneeNames.length > 0 ? `<span>${assigneeNames.join(', ')}</span>` : ''}
                </div>
                ${t.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${_calEscapeHtml(t.description.length > 150 ? t.description.substring(0,150) + '...' : t.description)}</div>` : ''}
              </div>
              <div class="cal-task-row-status" style="background:${st.bg};color:${st.color};">${st.label}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  // Build message rows HTML  
  const msgSectionHtml = `
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Messages
      </div>
      <div class="cal-modal-list">
        ${msgs.length ? msgs.map(m => {
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
                <button class="cal-icon-btn danger" title="Delete message" onclick="deleteCalendarMessage('${_calEscapeHtml(deleteId)}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="text-center py-4 text-muted" style="font-size:13px;"><p>No messages scheduled.</p></div>
        `}
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'cal-day-modal';
  modal.className = 'cal-modal-backdrop';
  modal.innerHTML = `
    <div class="cal-modal" role="dialog" aria-modal="true" aria-label="Day details for ${_calEscapeHtml(dateISO)}">
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

      ${taskRowsHtml}
      ${msgSectionHtml}

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
  const tasksByDay = _calendarGetTasksByDay();
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
            <p class="font-semibold" style="color: var(--accent-primary);">Select Days${AppState.calendarPrefillProjectName ? ` for "${_calEscapeHtml(AppState.calendarPrefillProjectName)}"` : ''}</p>
            <p class="text-xs text-muted">${AppState.calendarPrefillRecipients && AppState.calendarPrefillRecipients.length > 0
              ? `Recipients: ${AppState.calendarPrefillRecipients.map(r => _calEscapeHtml(r.chatName)).join(', ')}. Pick the days to send on.`
              : `Click days to highlight them. You can change months too.`
            }</p>
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
            const dayTasks = tasksByDay.get(dateISO) || [];

            // Render task dots (max 5 visible, then overflow count)
            const maxDots = 5;
            const dotsHTML = dayTasks.length > 0 ? `
              <div class="cal-task-dots">
                ${dayTasks.slice(0, maxDots).map(t => {
                  const doneClass = t.status === 'done' ? ' is-done' : '';
                  return `<div class="cal-task-dot${doneClass}" style="background:${t.color};" 
                    onmouseenter="_calShowTaskTooltip(event, '${_calEscapeHtml(t.id)}')"
                    onmouseleave="_calHideTaskTooltip()"
                    onclick="event.stopPropagation();"></div>`;
                }).join('')}
                ${dayTasks.length > maxDots ? `<span class="cal-task-dots-overflow">+${dayTasks.length - maxDots}</span>` : ''}
              </div>
            ` : '';

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
                ${dotsHTML}
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
      ${_calBuildProjectsSection(isSelectionMode)}    </div>
  `;
}

// -----------------------------------------------
// Projects & Tasks Section (from Timeline data)
// -----------------------------------------------
function _calBuildProjectsSection(isSelectionMode) {
  const workspaces = (typeof AppState !== 'undefined' && AppState.timelineWorkspaces) || [];
  const projects = (typeof AppState !== 'undefined' && AppState.timelineProjects) || [];
  const tasks = (typeof AppState !== 'undefined' && AppState.timelineTasks) || [];
  const members = (typeof AppState !== 'undefined' && AppState.timelineTeamMembers) || [];

  if (workspaces.length === 0 && projects.length === 0) return '';

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const groupedHTML = workspaces.map(ws => {
    const wsProjects = projects.filter(p => p.workspace_id === ws.id);
    if (wsProjects.length === 0) return '';

    const projectRows = wsProjects.map(proj => {
      const subtasks = tasks.filter(t => t.project_id === proj.id);
      const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
      const assigneeNames = assigneeIds.map(id => {
        const m = members.find(mm => mm.id === id);
        return m ? _calEscapeHtml(m.name) : null;
      }).filter(Boolean);

      let dateRange = 'No subtasks';
      if (subtasks.length > 0) {
        let minS = subtasks[0].start_date, maxE = subtasks[0].end_date;
        for (const t of subtasks) {
          if (t.start_date < minS) minS = t.start_date;
          if (t.end_date > maxE) maxE = t.end_date;
        }
        const s = new Date(minS + 'T00:00:00');
        const e = new Date(maxE + 'T00:00:00');
        dateRange = `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      }

      const doneCount = subtasks.filter(t => t.status === 'done').length;
      const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

      let statusLabel = 'Empty';
      let statusColor = '#5a6480';
      if (subtasks.length > 0) {
        const ipCount = subtasks.filter(t => t.status === 'in_progress').length;
        if (doneCount === subtasks.length) { statusLabel = 'Completed'; statusColor = '#10b981'; }
        else if (ipCount > 0 || doneCount > 0) { statusLabel = 'In Progress'; statusColor = '#3b82f6'; }
        else { statusLabel = 'Planned'; statusColor = '#f59e0b'; }
      }

      return `
        <div class="cal-project-row" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-secondary);border-radius:12px;">
          <div style="width:6px;height:40px;border-radius:3px;background:${proj.color || ws.color};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:600;font-size:14px;color:var(--text-primary);">${_calEscapeHtml(proj.name)}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">${statusLabel}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:4px;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--text-muted);">${dateRange}</span>
              ${subtasks.length > 0 ? `<span style="font-size:12px;color:var(--text-muted);">${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}</span>` : ''}
              ${assigneeNames.length > 0 ? `<span style="font-size:12px;color:var(--text-muted);">${assigneeNames.join(', ')}</span>` : ''}
            </div>
            ${subtasks.length > 0 ? `
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <div style="flex:1;height:4px;border-radius:2px;background:var(--bg-tertiary);overflow:hidden;"><div style="width:${progress}%;height:100%;border-radius:2px;background:${proj.color || ws.color};"></div></div>
                <span style="font-size:11px;color:var(--text-muted);">${progress}%</span>
              </div>
            ` : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="flex-shrink:0;display:flex;align-items:center;gap:6px;" onclick="sendMessageForProject('${proj.id}')" title="Send message to people assigned to this task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Message
          </button>
        </div>
      `;
    }).join('');

    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${ws.color};"></div>
          <h4 style="font-weight:600;font-size:14px;color:var(--text-primary);margin:0;">${_calEscapeHtml(ws.name)}</h4>
          <span style="font-size:12px;color:var(--text-muted);">${wsProjects.length} task${wsProjects.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${projectRows}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  // Also include orphan projects (not assigned to any workspace)
  const orphanProjects = projects.filter(p => !workspaces.find(ws => ws.id === p.workspace_id));
  let orphanHTML = '';
  if (orphanProjects.length > 0) {
    const orphanRows = orphanProjects.map(proj => {
      const subtasks = tasks.filter(t => t.project_id === proj.id);
      const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
      const assigneeNames = assigneeIds.map(id => {
        const m = members.find(mm => mm.id === id);
        return m ? _calEscapeHtml(m.name) : null;
      }).filter(Boolean);

      let dateRange = 'No subtasks';
      if (subtasks.length > 0) {
        let minS = subtasks[0].start_date, maxE = subtasks[0].end_date;
        for (const t of subtasks) {
          if (t.start_date < minS) minS = t.start_date;
          if (t.end_date > maxE) maxE = t.end_date;
        }
        const s = new Date(minS + 'T00:00:00');
        const e = new Date(maxE + 'T00:00:00');
        dateRange = `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      }

      return `
        <div class="cal-project-row" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-secondary);border-radius:12px;">
          <div style="width:6px;height:40px;border-radius:3px;background:${proj.color || '#6b7280'};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <span style="font-weight:600;font-size:14px;color:var(--text-primary);">${_calEscapeHtml(proj.name)}</span>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${dateRange}${assigneeNames.length > 0 ? ' \u00b7 ' + assigneeNames.join(', ') : ''}</div>
          </div>
          <button class="btn btn-primary btn-sm" style="flex-shrink:0;display:flex;align-items:center;gap:6px;" onclick="sendMessageForProject('${proj.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Message
          </button>
        </div>
      `;
    }).join('');

    orphanHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:3px;background:#6b7280;"></div>
          <h4 style="font-weight:600;font-size:14px;color:var(--text-primary);margin:0;">Unassigned</h4>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">${orphanRows}</div>
      </div>
    `;
  }

  if (!groupedHTML && !orphanHTML) return '';

  return `
    <div class="card" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h3 class="font-semibold" style="margin:0;">Tasks</h3>
          <p class="text-sm text-muted" style="margin:2px 0 0;">Tasks from your workspaces. Click \u201cSend Message\u201d to message the assigned people.</p>
        </div>
      </div>
      ${groupedHTML}
      ${orphanHTML}
    </div>
  `;
}

// -----------------------------------------------
// Send Message for a Project (Task)
// -----------------------------------------------
function sendMessageForProject(projectId) {
  const projects = AppState.timelineProjects || [];
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const subscribedChats = AppState.subscribedChats || [];

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    if (typeof showNotification === 'function') showNotification('Project not found', 'error');
    return;
  }

  // Collect all assignee IDs from subtasks of this project
  const subtasks = tasks.filter(t => t.project_id === projectId);
  const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
  const assigneeMembers = assigneeIds.map(id => members.find(m => m.id === id)).filter(Boolean);

  // Match team members to subscribed chats by name (case-insensitive)
  const matchedRecipients = [];
  for (const member of assigneeMembers) {
    const memberNameLower = member.name.toLowerCase().trim();
    const chat = subscribedChats.find(c => {
      const chatName = (c.name || c.chat_name || '').toLowerCase().trim();
      return chatName === memberNameLower || chatName.includes(memberNameLower) || memberNameLower.includes(chatName);
    });
    if (chat) {
      matchedRecipients.push({
        userId: chat.user_id || '',
        chatId: chat.id || chat.chat_id || '',
        chatName: chat.name || chat.chat_name || chat.id || '',
        platform: chat.type || chat.platform || 'Group'
      });
    }
  }

  // Store the prefill recipients in AppState for the scheduling page to pick up
  AppState.calendarPrefillRecipients = matchedRecipients;
  AppState.calendarPrefillProjectName = project.name;

  if (matchedRecipients.length === 0 && assigneeMembers.length > 0) {
    if (typeof showNotification === 'function') {
      showNotification(
        `No matching chats found for: ${assigneeMembers.map(m => m.name).join(', ')}. Recipients can be selected manually after choosing days.`,
        'info'
      );
    }
  } else if (matchedRecipients.length > 0) {
    if (typeof showNotification === 'function') {
      showNotification(
        `${matchedRecipients.length} recipient${matchedRecipients.length !== 1 ? 's' : ''} matched: ${matchedRecipients.map(r => r.chatName).join(', ')}`,
        'success'
      );
    }
  }

  // Enter day selection mode on the calendar
  AppState.daySelectionMode = true;
  if (!Array.isArray(AppState.selectedScheduleDays)) AppState.selectedScheduleDays = [];

  // Navigate to calendar if we're not already there
  if (AppState.currentView !== 'calendar') {
    navigateTo('calendar');
  } else {
    renderCalendar();
  }
}

// -----------------------------------------------
// Task Tooltip (hover on calendar task bars)
// -----------------------------------------------
function _calShowTaskTooltip(event, taskId) {
  _calHideTaskTooltip();
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const project = projects.find(p => p.id === task.project_id);
  const assigneeIds = task.assignee_id ? task.assignee_id.split(',').filter(Boolean) : [];
  const assigneeNames = assigneeIds.map(id => {
    const m = members.find(mm => mm.id === id);
    return m ? _calEscapeHtml(m.name) : null;
  }).filter(Boolean);

  const statusMap = { done: 'Completed', in_progress: 'In Progress', planned: 'Planned' };
  const statusLabel = statusMap[task.status] || task.status || 'Unknown';

  const tooltip = document.createElement('div');
  tooltip.id = 'cal-task-tooltip';
  tooltip.className = 'cal-task-tooltip';
  tooltip.innerHTML = `
    <div class="cal-task-tooltip-title">${_calEscapeHtml(task.title)}</div>
    ${project ? `<div class="cal-task-tooltip-project" style="color:${project.color};">${_calEscapeHtml(project.name)}</div>` : ''}
    <div class="cal-task-tooltip-meta">
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${_calEscapeHtml(task.start_date)} → ${_calEscapeHtml(task.end_date)}
      </span>
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${task.hours_per_week || 0}h/week · ${statusLabel}
      </span>
      ${assigneeNames.length > 0 ? `<span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/></svg>
        ${assigneeNames.join(', ')}
      </span>` : ''}
      ${task.description ? `<span style="margin-top:2px;opacity:0.8;">${_calEscapeHtml(task.description.length > 120 ? task.description.substring(0,120) + '...' : task.description)}</span>` : ''}
    </div>
  `;

  document.body.appendChild(tooltip);

  // Position near cursor
  const rect = tooltip.getBoundingClientRect();
  const x = Math.min(event.clientX + 12, window.innerWidth - rect.width - 16);
  const y = Math.min(event.clientY - 8, window.innerHeight - rect.height - 16);
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = Math.max(8, y) + 'px';
}

function _calHideTaskTooltip() {
  const existing = document.getElementById('cal-task-tooltip');
  if (existing) existing.remove();
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
  window.sendMessageForProject = sendMessageForProject;
  window._calShowTaskTooltip = _calShowTaskTooltip;
  window._calHideTaskTooltip = _calHideTaskTooltip;
}
