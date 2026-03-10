// ============================================
// CALENDAR VIEW (DAY PICKER + DAY DETAILS MODAL)
// - Calendar page is now its own thing
// - Supports "Select days" mode (like Documents select)
// - Normal mode: click a day -> popup showing that day's messages + delete + schedule button
// - Done (select mode) -> goes to Scheduling with selected days prefilled
// ============================================


function _calStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function _calEndOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function _calSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function _calendarGetCurrentMonth() {
  if (!AppState.calendarMonthISO) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    AppState.calendarMonthISO = dateToLocalISO(first);
  }
  const [y, m] = AppState.calendarMonthISO.split('-').map(Number);
  return new Date(y, (m - 1), 1);
}

function _calendarSetMonth(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  AppState.calendarMonthISO = dateToLocalISO(first);
}

function _calendarGetAllMessages() {
  const msgs = (AppState.scheduledMessages || []).map(m => {
    if (!m._platform) m._platform = m.platform || 'whatsapp';
    return m;
  });
  const emails = (AppState.scheduledEmails || []).map(m => {
    if (!m._platform) m._platform = 'email';
    return m;
  });
  return msgs.concat(emails);
}

function _calendarGetMessagesByDay() {
  const map = new Map();
  const all = _calendarGetAllMessages();

  all.forEach(m => {
    const ts = m.scheduled_time || m.scheduled_timestamp;
    if (!ts) return;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    const key = dateToLocalISO(d);
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
      const key = dateToLocalISO(cur);
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
  AppState.selectedScheduleDays = [];
  AppState.calendarHighlightProjectId = null;
  renderCalendar();
}

function cancelDaySelection() {
  AppState.daySelectionMode = false;
  AppState.calendarPrefillRecipients = null;
  AppState.calendarPrefillProjectName = null;
  AppState.calendarHighlightProjectId = null;
  AppState.selectedScheduleDays = [];
  renderCalendar();
}

function confirmDaySelectionAndGo() {
  const selected = Array.isArray(AppState.selectedScheduleDays) ? AppState.selectedScheduleDays : [];
  if (selected.length === 0) {
    showNotification('Select a day first', 'warning');
    return;
  }
  AppState.daySelectionMode = false;
  AppState.calendarHighlightProjectId = null;

  // If we have prefilled recipients from a project "Send Message" flow,
  // pass them through schedulerFormState so the composer picks them up
  if (AppState.calendarPrefillRecipients && AppState.calendarPrefillRecipients.length > 0) {
    AppState.schedulerFormState = {
      recipients: AppState.calendarPrefillRecipients,
      selectedDays: selected,
      localFiles: [],
      messageContent: '',
      channel: AppState.composeChannel || 'email'
    };
    AppState.calendarPrefillRecipients = null;
    AppState.calendarPrefillProjectName = null;
  }

  navigateTo('scheduling');
}

// -------------------------------
// Day details modal helpers
// -------------------------------
function _calGetMessagesForDate(dateISO) {
  const all = _calendarGetAllMessages();
  return all
    .filter(m => {
      const ts = m.scheduled_time || m.scheduled_timestamp;
      if (!ts) return false;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return false;
      return dateToLocalISO(d) === dateISO;
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
  // Check in regular messages first, then emails
  const messages = AppState.scheduledMessages || [];
  let idx = messages.findIndex(m =>
    String(m.id) === String(messageId) || String(m.server_id) === String(messageId)
  );
  let isEmail = false;
  let list = messages;

  if (idx < 0) {
    const emails = AppState.scheduledEmails || [];
    idx = emails.findIndex(m =>
      String(m.id) === String(messageId) || String(m.server_id) === String(messageId)
    );
    if (idx < 0) {
      showNotification('Message not found', 'warning');
      return;
    }
    isEmail = true;
    list = emails;
  }

  const msg = list[idx];
  const serverMessageId = msg.server_id || msg.id;

  try {
    if (isEmail) {
      if (window.AzureVMAPI && typeof AzureVMAPI.deleteEmail === 'function') {
        await AzureVMAPI.deleteEmail(serverMessageId);
      }
    } else {
      if (window.AzureVMAPI && typeof AzureVMAPI.deleteMessage === 'function') {
        await AzureVMAPI.deleteMessage(serverMessageId);
      }
    }

    list.splice(idx, 1);
    if (isEmail) {
      AppState.scheduledEmails = list;
    } else {
      AppState.scheduledMessages = list;
    }

    showNotification('Message deleted', 'success');

    const ts = msg.scheduled_time || msg.scheduled_timestamp;
    const dayISO = ts ? dateToLocalISO(new Date(ts)) : null;
    if (dayISO) openDayDetailsModal(dayISO);

    renderCalendar();
  } catch (error) {
    console.error('Delete failed:', error);

    const msgText = String(error?.message || error || '');
    if (msgText.includes('404') || msgText.toLowerCase().includes('not found')) {
      list.splice(idx, 1);
      if (isEmail) {
        AppState.scheduledEmails = list;
      } else {
        AppState.scheduledMessages = list;
      }
      showNotification('Removed locally (already deleted on server).', 'info');

      const ts = msg.scheduled_time || msg.scheduled_timestamp;
      const dayISO = ts ? dateToLocalISO(new Date(ts)) : null;
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
          const projName = proj ? escapeHtml(proj.name) : '';
          const assigneeIds = t.assignee_id ? t.assignee_id.split(',').filter(Boolean) : [];
          const assigneeNames = assigneeIds.map(id => {
            const m = members.find(mm => mm.id === id);
            return m ? escapeHtml(m.name) : null;
          }).filter(Boolean);

          const statusMap = { done: { label: 'Done', bg: 'rgba(16,185,129,0.15)', color: '#10b981' }, in_progress: { label: 'In Progress', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' } };
          const st = statusMap[t.status] || { label: t.status || 'Planned', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };

          return `
            <div class="cal-task-row">
              <div class="cal-task-row-color" style="background:${color};"></div>
              <div class="cal-task-row-info">
                <div class="cal-task-row-title">${escapeHtml(t.title)}</div>
                <div class="cal-task-row-meta">
                  ${projName ? `<span style="color:${color};font-weight:600;">${projName}</span>` : ''}
                  <span>${escapeHtml(t.start_date)} → ${escapeHtml(t.end_date)}</span>
                  <span>${t.hours_per_week || 0}h/wk</span>
                  ${assigneeNames.length > 0 ? `<span>${assigneeNames.join(', ')}</span>` : ''}
                </div>
                ${t.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${escapeHtml(t.description.length > 150 ? t.description.substring(0,150) + '...' : t.description)}</div>` : ''}
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
          const platform = m._platform || m.platform || 'whatsapp';
          const platformLabel = platform === 'email' ? '✉ Email' : '💬 Telegram';
          const text = (m.message_content || m.message || '').trim() || '(no text)';
          const subjectLine = m.subject ? `<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">Subject: ${escapeHtml(m.subject)}</div>` : '';
          const filesCount = Array.isArray(m.files) ? m.files.length : (Array.isArray(m.file_paths) ? m.file_paths.length : (Array.isArray(m.attachments) ? m.attachments.length : 0));
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
                  <span class="cal-pill" style="background:${platform === 'email' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)'};color:${platform === 'email' ? '#3b82f6' : '#10b981'};">${platformLabel}</span>
                  ${timeLabel ? `<span class="cal-msg-meta">${escapeHtml(timeLabel)}</span>` : ''}
                  <span class="cal-msg-meta">• ${filesCount} file${filesCount === 1 ? '' : 's'}</span>
                </div>
                ${subjectLine}
                <div class="cal-msg-text">${escapeHtml(text)}</div>
              </div>
              <div class="cal-msg-actions">
                <button class="cal-icon-btn danger" title="Delete message" onclick="deleteCalendarMessage('${escapeHtml(deleteId)}')">
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
    <div class="cal-modal" role="dialog" aria-modal="true" aria-label="Day details for ${escapeHtml(dateISO)}">
      <div class="cal-modal-header">
        <div>
          <div class="cal-modal-title">${escapeHtml(title)}</div>
          <div class="cal-modal-subtitle">${escapeHtml(subtitle)}</div>
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
        <button class="btn btn-primary" onclick="scheduleMessageForDay('${escapeHtml(dateISO)}')">
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
    // Single-day selection: replace any previous selection
    AppState.selectedScheduleDays = [dateISO];
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
  const gridStart = addDays(monthStart, -startDow);

  const days = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

  const byDay = _calendarGetMessagesByDay();
  const tasksByDay = _calendarGetTasksByDay();
  const monthLabel = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isSelectionMode = AppState.daySelectionMode === true;
  const selectedSet = _calendarGetSelectedDaysSet();

  // Build set of days to highlight when a project is targeted for messaging
  const highlightDays = new Set();
  let highlightColor = '#6366f1';
  if (AppState.calendarHighlightProjectId) {
    const hlProject = (AppState.timelineProjects || []).find(p => p.id === AppState.calendarHighlightProjectId);
    if (hlProject) highlightColor = hlProject.color || '#6366f1';
    const hlTasks = (AppState.timelineTasks || []).filter(t => t.project_id === AppState.calendarHighlightProjectId);
    for (const t of hlTasks) {
      if (!t.start_date || !t.end_date) continue;
      const s = new Date(t.start_date + 'T00:00:00');
      const e = new Date(t.end_date + 'T00:00:00');
      const c = new Date(s);
      while (c <= e) { highlightDays.add(dateToLocalISO(c)); c.setDate(c.getDate() + 1); }
    }
  }

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
            <p class="font-semibold" style="color: var(--accent-primary);">Pick a Day${AppState.calendarPrefillProjectName ? ` for "${escapeHtml(AppState.calendarPrefillProjectName)}"` : ''}</p>
            <p class="text-xs text-muted">${AppState.calendarPrefillRecipients && AppState.calendarPrefillRecipients.length > 0
              ? `Recipients: ${AppState.calendarPrefillRecipients.map(r => escapeHtml(r.chatName)).join(', ')}. Pick the day to send on.${AppState.calendarHighlightProjectId ? ' Highlighted days show when the task is active.' : ''}`
              : `Click a day to select it.${AppState.calendarHighlightProjectId ? ' Highlighted days show when the task is active.' : ''}`
            }</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          ${selectedSet.size > 0 ? `<span class="text-sm" style="color: var(--accent-primary); font-weight: 600;">${Array.from(selectedSet)[0]}</span>` : '<span class="text-sm text-muted">No day selected</span>'}
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
            Confirm
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
              <button class="btn btn-secondary btn-sm" onclick="startDaySelectionMode()" title="Select a day to schedule a message on">
                Select day
              </button>
            ` : ``}
          </div>
        </div>

        <div class="cal-grid" style="margin-bottom: 10px;">
          ${dow.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        </div>

        <div class="cal-grid">
          ${days.map(d => {
            const dateISO = dateToLocalISO(d);
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
                    onmouseenter="_calShowTaskTooltip(event, '${escapeHtml(t.id)}')"
                    onmouseleave="_calHideTaskTooltip()"
                    onclick="event.stopPropagation();"></div>`;
                }).join('')}
                ${dayTasks.length > maxDots ? `<span class="cal-task-dots-overflow">+${dayTasks.length - maxDots}</span>` : ''}
              </div>
            ` : '';

            const preview = msgs.slice(0, 2).map(m => {
              const status = (m.status === 'sent') ? 'sent' : 'pending';
              const plat = m._platform || m.platform || 'whatsapp';
              const icon = plat === 'email' ? '\u2709' : '\ud83d\udcac';
              const txt = (m.message_content || m.message || '').trim();
              const safeTitle = escapeHtml(txt);
              return `<span class="cal-chip ${status}" title="${safeTitle}">${icon} ${escapeHtml(txt || '(no text)')}</span>`;
            }).join('');

            const more = (count > 2) ? `<span class="cal-chip" style="opacity:0.75;">+${count - 2} more</span>` : '';

            const isHighlighted = highlightDays.has(dateISO);
            const hint = isSelectionMode
              ? `Click to select ${dateISO}`
              : `Click to view details for ${dateISO}`;

            return `
              <div
                class="cal-cell ${isOutside ? 'is-outside' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-task-highlight' : ''}"
                onclick="calendarDayClicked('${dateISO}')"
                title="${escapeHtml(hint)}"
                ${isHighlighted ? `style="--cal-highlight-color: ${highlightColor}55; --cal-highlight-bg: ${highlightColor}14; --cal-highlight-bg-hover: ${highlightColor}22;"` : ''}
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
            ? `Click a day to select it, then hit Confirm to open Scheduling.`
            : `Tip: Use “Select day” to pick a date for scheduling.`
          }
        </div>
      </div>
      ${_calBuildProjectsSection(isSelectionMode)}    </div>
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
  window.sendMessageForProject = sendMessageForProject;
  window._calShowTaskTooltip = _calShowTaskTooltip;
  window._calHideTaskTooltip = _calHideTaskTooltip;
}