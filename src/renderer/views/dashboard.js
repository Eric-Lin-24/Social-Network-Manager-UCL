// ============================================
// DASHBOARD VIEW
//  - 3 metrics (sent last 30d, pending, next message)
//  - Compact month calendar (dots only)  ✅ DASHBOARD ONLY
//  - Quick Schedule moved onto dashboard ✅ DASHBOARD ONLY
// ============================================

function _dashSafe(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _dashPad2(n) {
  return String(n).padStart(2, '0');
}

function _dashStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function _dashEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function _dashLocalDateKey(dateObj) {
  // YYYY-MM-DD in LOCAL time
  const y = dateObj.getFullYear();
  const m = _dashPad2(dateObj.getMonth() + 1);
  const d = _dashPad2(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function _dashGetCalendarMonth() {
  // Persist month selection in AppState so navigation doesn't reset it.
  const now = new Date();
  if (!AppState.dashboardCalendar) AppState.dashboardCalendar = { year: null, month: null };
  if (typeof AppState.dashboardCalendar.year !== 'number' || typeof AppState.dashboardCalendar.month !== 'number') {
    AppState.dashboardCalendar.year = now.getFullYear();
    AppState.dashboardCalendar.month = now.getMonth();
  }
  return { year: AppState.dashboardCalendar.year, month: AppState.dashboardCalendar.month };
}

function _dashSetCalendarMonth(year, month /* 0-11 */) {
  const d = new Date(year, month, 1);
  AppState.dashboardCalendar.year = d.getFullYear();
  AppState.dashboardCalendar.month = d.getMonth();
  renderDashboard();
}

function _dashMoveCalendarMonth(delta) {
  const { year, month } = _dashGetCalendarMonth();
  const d = new Date(year, month + delta, 1);
  _dashSetCalendarMonth(d.getFullYear(), d.getMonth());
}

function _dashGetSentLast30Days(messages) {
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  return (messages || []).filter(m => {
    if (!m) return false;
    if (m.status !== 'sent') return false;
    if (!m.scheduled_time) return false;
    const t = new Date(m.scheduled_time).getTime();
    return Number.isFinite(t) && t >= cutoff && t <= now;
  }).length;
}

function _dashGetPending(messages) {
  return (messages || []).filter(m => m && m.status !== 'sent').length;
}

function _dashGetNextPending(messages) {
  const now = Date.now();
  const pendingFuture = (messages || [])
    .filter(m => m && m.status !== 'sent' && m.scheduled_time)
    .map(m => ({ m, t: new Date(m.scheduled_time).getTime() }))
    .filter(x => Number.isFinite(x.t) && x.t >= now)
    .sort((a, b) => a.t - b.t);
  return pendingFuture[0]?.m || null;
}

function _dashStatCard({ title, value, meta, tone = 'teal', icon }) {
  return `
    <div class="card stat-card">
      <div class="stat-icon ${tone}">
        ${icon}
      </div>
      <div class="stat-value">${_dashSafe(value)}</div>
      <div class="stat-label">${_dashSafe(title)}</div>
      <div class="text-xs text-muted">${_dashSafe(meta || '')}</div>
    </div>
  `;
}

// ------------------------------
// Draft storage (shared with Scheduling page behavior)
// ------------------------------
function _dashDraftStorageKey() {
  // user-scoped drafts (same pattern as scheduling.js)
  return AppState.userId ? `message_drafts_${AppState.userId}` : 'message_drafts_guest';
}

function _dashLoadMessageDrafts() {
  try {
    const raw = localStorage.getItem(_dashDraftStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    AppState.messageDrafts = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load drafts:', e);
    AppState.messageDrafts = [];
  }
}

function _dashSaveMessageDrafts() {
  try {
    localStorage.setItem(_dashDraftStorageKey(), JSON.stringify(AppState.messageDrafts || []));
  } catch (e) {
    console.warn('Failed to save drafts:', e);
  }
}

// ------------------------------
// Dashboard compact calendar (dots only)
// ------------------------------
function _dashMiniCalendarStylesOnce() {
  if (document.getElementById('cc-dashboard-mini-calendar-styles')) return;
  const style = document.createElement('style');
  style.id = 'cc-dashboard-mini-calendar-styles';
  style.textContent = `
    .cc-mini-wrap { display: flex; flex-direction: column; gap: 12px; }
    .cc-mini-header { display: flex; justify-content: space-between; align-items: center; }
    .cc-mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
    .cc-mini-dow { font-size: 11px; color: var(--text-muted); text-align: center; padding: 2px 0; }

    .cc-mini-cell {
      min-height: 44px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 6px;
      cursor: pointer;
      transition: transform .08s ease, border-color .08s ease;
    }
    .cc-mini-cell:hover { transform: translateY(-1px); border-color: var(--accent-primary); }
    .cc-mini-cell.is-other-month { opacity: 0.45; }
    .cc-mini-cell.is-today { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--accent-primary-soft); }

    .cc-mini-top { display: flex; align-items: center; justify-content: space-between; }
    .cc-mini-daynum { font-size: 12px; font-weight: 600; }

    .cc-mini-dots { display: flex; gap: 4px; align-items: center; justify-content: flex-end; }
    .cc-mini-dot { width: 7px; height: 7px; border-radius: 999px; }
    .cc-mini-dot.sent { background: var(--success); }
    .cc-mini-dot.pending { background: var(--warning); }

    .cc-mini-legend { display: flex; gap: 10px; align-items: center; font-size: 11px; color: var(--text-muted); }
    .cc-mini-legend .item { display: flex; gap: 6px; align-items: center; }
    .cc-mini-legend .swatch { width: 8px; height: 8px; border-radius: 999px; }
  `;
  document.head.appendChild(style);
}

function _dashBuildMiniMonthCells(year, month, messagesByDayKey) {
  // Calendar grid: weeks start Sunday
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(year, month, 1 - startDow);

  const cells = [];
  for (let i = 0; i < 42; i++) { // 6 weeks
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = _dashLocalDateKey(d);
    const items = messagesByDayKey.get(key) || [];
    const isOtherMonth = d.getMonth() !== month;

    const todayKey = _dashLocalDateKey(new Date());
    const isToday = key === todayKey;

    const hasSent = items.some(m => m && m.status === 'sent');
    const hasPending = items.some(m => m && m.status !== 'sent');

    cells.push(`
      <div
        class="cc-mini-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}"
        onclick="dashboardOpenScheduleForDay('${key}')"
        title="${items.length ? `${items.length} message(s)` : 'No messages'} — click to schedule"
      >
        <div class="cc-mini-top">
          <div class="cc-mini-daynum">${d.getDate()}</div>
          <div class="cc-mini-dots">
            ${hasSent ? `<span class="cc-mini-dot sent" aria-label="sent"></span>` : ''}
            ${hasPending ? `<span class="cc-mini-dot pending" aria-label="pending"></span>` : ''}
          </div>
        </div>
      </div>
    `);
  }
  return cells.join('');
}

// ------------------------------
// Dashboard Quick Schedule (does NOT navigate away)
// ------------------------------
function _dashEnsureQuickScheduleDefaultDatetime() {
  const datetimeInput = document.getElementById('dash-quick-datetime');
  if (!datetimeInput) return;

  // Only set if empty (don’t fight the user)
  if (datetimeInput.value) return;

  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(0);
  now.setSeconds(0);
  now.setMilliseconds(0);

  datetimeInput.value = now.toISOString().slice(0, 16);
}

function dashboardSaveQuickDraft() {
  const recipient = document.getElementById('dash-quick-recipient')?.value || '';
  const message = document.getElementById('dash-quick-message')?.value || '';

  if (!recipient) { showNotification('Please select a recipient', 'warning'); return; }
  if (!message.trim()) { showNotification('Please enter a message to save', 'warning'); return; }

  _dashLoadMessageDrafts();

  const draft = {
    id: (typeof generateId === 'function') ? generateId() : String(Date.now()),
    target_user_id: recipient,
    message_content: message,
    created_at: new Date().toISOString()
  };

  AppState.messageDrafts.unshift(draft);
  _dashSaveMessageDrafts();

  showNotification('Draft saved', 'success');

  // optional: clear message box (keeps recipient)
  const msgEl = document.getElementById('dash-quick-message');
  if (msgEl) msgEl.value = '';

  renderDashboard();
}

async function dashboardQuickScheduleMessage() {
  const recipient = document.getElementById('dash-quick-recipient')?.value || '';
  const message = document.getElementById('dash-quick-message')?.value || '';
  const datetime = document.getElementById('dash-quick-datetime')?.value || '';

  if (!recipient) { showNotification('Please select a recipient', 'warning'); return; }
  if (!message.trim()) { showNotification('Please enter a message', 'warning'); return; }
  if (!datetime) { showNotification('Please select a date and time', 'warning'); return; }

  try {
    showNotification('Scheduling message.', 'info');

    const selectedChat = (AppState.subscribedChats || []).find(c => String(c.user_id) === String(recipient));
    const scheduledTimestamp = new Date(datetime).toISOString();

    const serverResponse = await AzureVMAPI.scheduleMessage(recipient, message, scheduledTimestamp, []);

    const serverId = serverResponse?.id || ((typeof generateId === 'function') ? generateId() : String(Date.now()));

    if (!Array.isArray(AppState.scheduledMessages)) AppState.scheduledMessages = [];
    AppState.scheduledMessages.push({
      id: serverId,
      server_id: serverId,
      recipient: selectedChat?.name || recipient,
      message_content: message,
      scheduled_time: scheduledTimestamp,
      status: 'pending',
      target_user_id: recipient
    });

    showNotification('Message scheduled successfully!', 'success');

    const rEl = document.getElementById('dash-quick-recipient');
    const mEl = document.getElementById('dash-quick-message');
    if (rEl) rEl.value = '';
    if (mEl) mEl.value = '';

    renderDashboard();
  } catch (error) {
    console.error('Error scheduling message:', error);
    showNotification('Failed to schedule message: ' + (error?.message || error), 'error');
  }
}

// ------------------------------
// Existing behavior: clicking a day opens full editor prefilled
// ------------------------------
function dashboardOpenScheduleForDay(localDateKey /* YYYY-MM-DD */) {
  // Prefill schedule message page with this day at 09:00 local time.
  const [y, m, d] = String(localDateKey).split('-').map(x => parseInt(x, 10));
  if (!y || !m || !d) return;

  const local = new Date(y, (m - 1), d, 9, 0, 0, 0);
  AppState.scheduleMessagePrefillISO = local.toISOString();
  navigateTo('scheduleMessage');
}

function renderDashboard() {
  _dashMiniCalendarStylesOnce();

  const content = document.getElementById('content');

  const messages = AppState.scheduledMessages || [];
  const sent30 = _dashGetSentLast30Days(messages);
  const pendingCount = _dashGetPending(messages);
  const nextPending = _dashGetNextPending(messages);

  const nextMeta = nextPending
    ? `${new Date(nextPending.scheduled_time).toLocaleString()}`
    : 'No upcoming scheduled messages';

  // Build compact calendar data for selected month
  const { year, month } = _dashGetCalendarMonth();
  const monthStart = _dashStartOfDay(new Date(year, month, 1));
  const monthEnd = _dashEndOfDay(new Date(year, month + 1, 0));

  const messagesThisMonth = (messages || [])
    .filter(m => m && m.scheduled_time)
    .map(m => ({ m, t: new Date(m.scheduled_time).getTime() }))
    .filter(x => Number.isFinite(x.t))
    .filter(x => x.t >= monthStart.getTime() && x.t <= monthEnd.getTime())
    .map(x => x.m);

  const byDay = new Map();
  for (const m of messagesThisMonth) {
    const k = _dashLocalDateKey(new Date(m.scheduled_time));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(m);
  }

  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const calendarCells = _dashBuildMiniMonthCells(year, month, byDay);

  const subscribedChats = AppState.subscribedChats || [];

  content.innerHTML = `
    <div class="animate-in">
      <div class="grid grid-cols-3 gap-6 mb-6">
        ${_dashStatCard({
          tone: 'teal',
          title: 'Messages Sent (30d)',
          value: String(sent30),
          meta: 'Delivered in the last 30 days',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M20 6L9 17l-5-5"/>
                 </svg>`
        })}
        ${_dashStatCard({
          tone: pendingCount > 0 ? 'blue' : 'teal',
          title: 'Messages Pending',
          value: String(pendingCount),
          meta: pendingCount ? 'Queued to send' : 'No pending messages',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                 </svg>`
        })}
        ${_dashStatCard({
          tone: nextPending ? 'purple' : 'blue',
          title: 'Next Message',
          value: nextPending
            ? (nextPending.recipients && Array.isArray(nextPending.recipients) 
                ? nextPending.recipients.join(', ') 
                : (nextPending.recipient || (nextPending.target_user_id ? (typeof getRecipientName === 'function' ? getRecipientName(nextPending.target_user_id) : nextPending.target_user_id) : 'Scheduled')))
            : '—',
          meta: nextMeta,
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <circle cx="12" cy="12" r="10"/>
                   <path d="M12 6v6l4 2"/>
                 </svg>`
        })}
      </div>

      <div class="grid grid-cols-2 gap-6">
        <!-- LEFT: Quick Schedule -->
        <div class="card">
          <div class="flex items-center gap-3 mb-5">
            <div class="stat-icon teal" style="width: 40px; height: 40px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold">Quick Schedule</h3>
              <p class="text-xs text-muted">Schedule a message without leaving the dashboard</p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="form-group">
              <label class="form-label">Recipient</label>
              <select id="dash-quick-recipient">
                <option value="">Select a chat.</option>
                ${(subscribedChats || []).map(chat =>
                  `<option value="${chat.user_id}" data-chat-id="${chat.chat_id}" data-platform="${chat.platform || 'whatsapp'}">
                    ${_dashSafe(chat.name || chat.id)}
                  </option>`
                ).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Message</label>
              <textarea id="dash-quick-message" rows="4" placeholder="Type your message."></textarea>
              <div class="flex justify-between mt-2">
                <span class="text-xs text-muted">Tip: save drafts for recurring messages</span>
                <button class="btn btn-ghost btn-sm" onclick="dashboardSaveQuickDraft()" title="Save to Recurring Message Drafts">
                  Save Draft
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Schedule For</label>
              <input type="datetime-local" id="dash-quick-datetime">
            </div>

            <button class="btn btn-primary w-full" onclick="dashboardQuickScheduleMessage()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Schedule Message
            </button>

            <div class="divider"></div>

            <button class="btn btn-secondary w-full" onclick="navigateTo('scheduleMessage')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Open Full Editor
            </button>
          </div>
        </div>

        <!-- RIGHT: Mini Month Calendar -->
        <div class="card">
          <div class="cc-mini-wrap">
            <div class="cc-mini-header">
              <div>
                <h3 class="font-semibold">Calendar</h3>
                <p class="text-xs text-muted">Green = sent • Orange = pending</p>
              </div>
              <div class="flex gap-2 items-center">
                <button class="btn btn-secondary btn-sm" onclick="_dashMoveCalendarMonth(-1)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Prev
                </button>
                <div class="text-sm" style="min-width: 160px; text-align:center;">${_dashSafe(monthLabel)}</div>
                <button class="btn btn-secondary btn-sm" onclick="_dashMoveCalendarMonth(1)">
                  Next
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="_dashSetCalendarMonth(new Date().getFullYear(), new Date().getMonth())">Today</button>
              </div>
            </div>

            <div class="cc-mini-grid" style="margin-bottom: 4px;">
              ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cc-mini-dow">${d}</div>`).join('')}
            </div>

            <div class="cc-mini-grid">
              ${calendarCells}
            </div>

            <div class="cc-mini-legend">
              <div class="item"><span class="swatch" style="background: var(--success);"></span> Sent</div>
              <div class="item"><span class="swatch" style="background: var(--warning);"></span> Pending</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  _dashEnsureQuickScheduleDefaultDatetime();
}

// Export + global handlers used by inline onclick
if (typeof window !== 'undefined') {
  window.renderDashboard = renderDashboard;
  window.dashboardOpenScheduleForDay = dashboardOpenScheduleForDay;
  window._dashMoveCalendarMonth = _dashMoveCalendarMonth;
  window._dashSetCalendarMonth = _dashSetCalendarMonth;

  // dashboard-only quick schedule
  window.dashboardSaveQuickDraft = dashboardSaveQuickDraft;
  window.dashboardQuickScheduleMessage = dashboardQuickScheduleMessage;
}
