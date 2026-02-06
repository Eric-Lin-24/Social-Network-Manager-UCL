// ============================================
// PEOPLE VIEW - Team Capacity Dashboard
// Aggregated metrics: capacity bars, utilization
// chart, filter badges, and member rows
// ============================================

// ===== People State =====

if (!AppState.peopleTab) AppState.peopleTab = 'dashboard'; // 'dashboard' | 'allUsers' | 'activities'
if (!AppState.peopleWeeks) AppState.peopleWeeks = 4;
if (!AppState.peopleFilterMember) AppState.peopleFilterMember = '';
if (!AppState.peopleFilter) AppState.peopleFilter = ''; // '' | 'missing' | 'overtime'
if (!AppState.peopleSearchQuery) AppState.peopleSearchQuery = '';
if (!AppState._peopleInitialLoad) AppState._peopleInitialLoad = false;

// Reuse timeline data fetchers — they set AppState.timelineTeamMembers, timelineTasks, timelineProjects
// We just need to make sure data is loaded.

// ===== Date Helpers (scoped to people view) =====

function _pplDateToISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _pplParseDate(str) {
  const parts = str.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function _pplWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday as start
  d.setHours(0, 0, 0, 0);
  return d;
}

function _pplAddDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function _pplEscape(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Week Column Generation =====

function _pplGetWeeks() {
  const numWeeks = AppState.peopleWeeks || 4;
  const offset = AppState._peopleWeekOffset || 0;

  // Start from the beginning of the current week, shifted by offset
  const now = new Date();
  const baseStart = _pplWeekStart(now);
  const start = _pplAddDays(baseStart, offset * 7);

  const weeks = [];
  const todayISO = _pplDateToISO(new Date());

  for (let i = 0; i < numWeeks; i++) {
    const weekStart = _pplAddDays(start, i * 7);
    const weekEnd = _pplAddDays(weekStart, 6);
    const isCurrent = todayISO >= _pplDateToISO(weekStart) && todayISO <= _pplDateToISO(weekEnd);
    const isFuture = _pplDateToISO(weekStart) > todayISO;

    weeks.push({
      start: weekStart,
      end: weekEnd,
      startISO: _pplDateToISO(weekStart),
      endISO: _pplDateToISO(weekEnd),
      isCurrent,
      isFuture,
    });
  }
  return weeks;
}

function _pplFormatWeekLabel(week) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = week.start;
  const e = week.end;
  const sMonth = months[s.getMonth()];
  const eMonth = months[e.getMonth()];

  if (s.getMonth() === e.getMonth()) {
    return `${sMonth}\n${_pplOrdinal(s.getDate())} - ${_pplOrdinal(e.getDate())}`;
  }
  return `${sMonth} ${_pplOrdinal(s.getDate())} -\n${eMonth} ${_pplOrdinal(e.getDate())}`;
}

function _pplOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function _pplFormatRangeLabel(weeks) {
  if (weeks.length === 0) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = weeks[0].start;
  const e = weeks[weeks.length - 1].end;
  return `${months[s.getMonth()]} ${s.getDate()} - ${months[e.getMonth()]} ${e.getDate()}`;
}

// ===== Capacity Computation =====

function _pplComputeMemberWeekHours(memberId, weekStartISO, weekEndISO, tasks) {
  // Get all tasks assigned to this member that overlap this week
  let planned = 0;
  let logged = 0;

  for (const task of tasks) {
    if (task.assignee_id !== memberId) continue;

    // Check overlap: task date range intersects week range
    if (task.end_date < weekStartISO || task.start_date > weekEndISO) continue;

    const hpw = task.hours_per_week || 0;

    if (task.status === 'done') {
      logged += hpw;
    } else if (task.status === 'in_progress') {
      logged += Math.round(hpw * 0.6);
      planned += Math.round(hpw * 0.4);
    } else {
      planned += hpw;
    }
  }

  return { planned, logged };
}

function _pplComputeAllData() {
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const weeks = _pplGetWeeks();

  const memberData = [];

  for (const member of members) {
    const weeklyData = [];
    let totalLogged = 0;
    let totalPlanned = 0;
    let totalCapacity = 0;
    let hasOvertime = false;
    let hasMissing = false;

    for (const week of weeks) {
      const { planned, logged } = _pplComputeMemberWeekHours(
        member.id, week.startISO, week.endISO, tasks
      );
      const capacity = member.weekly_capacity_hours || 40;
      const overtime = Math.max(0, (logged + planned) - capacity);
      const capacityLeft = Math.max(0, capacity - logged - planned);

      if (overtime > 0) hasOvertime = true;
      if (!week.isFuture && logged === 0 && planned > 0) hasMissing = true;
      // Also flag missing if no hours tracked/planned in a non-future week and they have capacity
      if (!week.isFuture && logged === 0 && planned === 0 && capacity > 0) hasMissing = true;

      totalLogged += logged;
      totalPlanned += planned;
      totalCapacity += capacity;

      weeklyData.push({
        week,
        logged,
        planned,
        capacity,
        overtime,
        capacityLeft,
      });
    }

    memberData.push({
      member,
      weeklyData,
      totalLogged,
      totalPlanned,
      totalCapacity,
      hasOvertime,
      hasMissing,
    });
  }

  return { memberData, weeks };
}

// ===== Navigation =====

function _pplNavigateWeeks(direction) {
  if (!AppState._peopleWeekOffset) AppState._peopleWeekOffset = 0;
  AppState._peopleWeekOffset += direction * (AppState.peopleWeeks || 4);
  renderPeople();
}

function _pplSetWeeks(n) {
  AppState.peopleWeeks = n;
  renderPeople();
}

function _pplSetTab(tab) {
  AppState.peopleTab = tab;
  renderPeople();
}

function _pplSetFilter(filter) {
  AppState.peopleFilter = AppState.peopleFilter === filter ? '' : filter;
  renderPeople();
}

function _pplSetFilterMember(id) {
  AppState.peopleFilterMember = id;
  renderPeople();
}

function _pplSearchMembers(query) {
  AppState.peopleSearchQuery = query;
  renderPeople();
}

// ===== Chart Builder =====

function _pplBuildChart(allData) {
  const { memberData, weeks } = allData;

  // Aggregate per week
  const weekAggregates = weeks.map((week, wi) => {
    let logged = 0, planned = 0, capacityLeft = 0, overtime = 0, totalCapacity = 0;
    for (const md of memberData) {
      const wd = md.weeklyData[wi];
      logged += wd.logged;
      planned += wd.planned;
      overtime += wd.overtime;
      capacityLeft += wd.capacityLeft;
      totalCapacity += wd.capacity;
    }
    return { week, logged, planned, capacityLeft, overtime, totalCapacity };
  });

  const maxVal = Math.max(1, ...weekAggregates.map(w => w.totalCapacity), ...weekAggregates.map(w => w.logged + w.planned + w.overtime));
  // Round up to nearest 30
  const yMax = Math.ceil(maxVal / 30) * 30;
  const ySteps = [];
  for (let v = 0; v <= yMax; v += Math.max(30, Math.floor(yMax / 4 / 10) * 10)) {
    ySteps.push(v);
  }
  // Ensure we have the max
  if (ySteps[ySteps.length - 1] < yMax) ySteps.push(yMax);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const barsHTML = weekAggregates.map((agg, i) => {
    const chartH = 200;
    const loggedH = (agg.logged / yMax) * chartH;
    const plannedH = (agg.planned / yMax) * chartH;
    const overtimeH = (agg.overtime / yMax) * chartH;
    const capLeftH = (agg.capacityLeft / yMax) * chartH;

    const s = agg.week.start;
    const e = agg.week.end;
    const label1 = `${months[s.getMonth()]} ${s.getDate()} -`;
    const label2 = `${months[e.getMonth()]} ${e.getDate()}`;
    const isFuture = agg.week.isFuture;
    const isCurrent = agg.week.isCurrent;

    return `
      <div class="ppl-bar-col ${isCurrent ? 'ppl-bar-col--current' : ''}">
        <div class="ppl-bar-stack" style="height: ${chartH}px;">
          <div class="ppl-bar-segment ppl-bar-cap-left ${isFuture ? 'ppl-bar-hatched' : ''}" style="height: ${capLeftH}px;" title="Capacity left: ${agg.capacityLeft}h"></div>
          <div class="ppl-bar-segment ppl-bar-overtime" style="height: ${overtimeH}px;" title="Overtime: ${agg.overtime}h"></div>
          <div class="ppl-bar-segment ppl-bar-planned ${isFuture ? 'ppl-bar-hatched' : ''}" style="height: ${plannedH}px;" title="Planned: ${agg.planned}h"></div>
          <div class="ppl-bar-segment ppl-bar-logged" style="height: ${loggedH}px;" title="Logged: ${agg.logged}h"></div>
        </div>
        <div class="ppl-bar-label">${label1}<br>${label2}</div>
      </div>
    `;
  }).join('');

  // Y-axis
  const yLabelsHTML = ySteps.map(v => {
    const bottom = (v / yMax) * 200;
    return `<span class="ppl-y-label" style="bottom: ${bottom}px;">${v}</span>`;
  }).join('');

  // Grid lines
  const gridLinesHTML = ySteps.map(v => {
    const bottom = (v / yMax) * 200;
    return `<div class="ppl-grid-line" style="bottom: ${bottom}px;"></div>`;
  }).join('');

  return `
    <div class="ppl-chart-card">
      <div class="ppl-chart-header">
        <h3 class="ppl-chart-title">Hours logged per week</h3>
        <div class="ppl-legend">
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-logged"></span> Logged time</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-planned"></span> Planned time</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-capacity"></span> Capacity left</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-overtime"></span> Overtime</span>
        </div>
      </div>
      <div class="ppl-chart-area">
        <div class="ppl-y-axis">${yLabelsHTML}</div>
        <div class="ppl-chart-inner">
          ${gridLinesHTML}
          <div class="ppl-bars-row">${barsHTML}</div>
        </div>
      </div>
    </div>
  `;
}

// ===== Filter Badges =====

function _pplBuildFilters(allData) {
  const active = AppState.peopleFilter || '';
  const missingCount = allData.memberData.filter(m => m.hasMissing).length;
  const overtimeCount = allData.memberData.filter(m => m.hasOvertime).length;

  return `
    <div class="ppl-filters">
      <span class="ppl-filter-label">Filter</span>
      <button class="ppl-filter-badge ${active === 'missing' ? 'ppl-filter-badge--active' : ''}" onclick="_pplSetFilter('missing')">
        Missing hours <span class="ppl-filter-emoji">\u{1F634}</span>
        ${missingCount > 0 ? `<span class="ppl-filter-count">${missingCount}</span>` : ''}
      </button>
      <button class="ppl-filter-badge ${active === 'overtime' ? 'ppl-filter-badge--active' : ''}" onclick="_pplSetFilter('overtime')">
        Overtime <span class="ppl-filter-emoji">\u{1F525}</span>
        ${overtimeCount > 0 ? `<span class="ppl-filter-count">${overtimeCount}</span>` : ''}
      </button>
    </div>
  `;
}

// ===== Member Table =====

function _pplBuildTable(allData) {
  const { memberData, weeks } = allData;
  const filter = AppState.peopleFilter || '';
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();

  let filtered = memberData;
  if (filter === 'missing') filtered = filtered.filter(m => m.hasMissing);
  if (filter === 'overtime') filtered = filtered.filter(m => m.hasOvertime);
  if (searchQ) filtered = filtered.filter(m => m.member.name.toLowerCase().includes(searchQ));

  if (filtered.length === 0) {
    return `
      <div class="ppl-table-empty">
        <p>No team members match the current filter.</p>
      </div>
    `;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Week column headers
  const weekHeaders = weeks.map(week => {
    const s = week.start;
    const e = week.end;
    const monthLabel = months[s.getMonth()];
    const isCurrent = week.isCurrent;
    return `<th class="${isCurrent ? 'ppl-th-current' : ''}">
      <span class="ppl-th-month">${isCurrent ? `<span class="ppl-th-current-tag">${monthLabel}</span>` : monthLabel}</span>
      <span class="ppl-th-range">${_pplOrdinal(s.getDate())} - ${_pplOrdinal(e.getDate())}</span>
    </th>`;
  }).join('');

  const rows = filtered.map(md => {
    const m = md.member;
    const initials = m.avatar_initials || '??';
    const capacity = m.weekly_capacity_hours || 40;

    // Weekly capacity bar cells
    const weekCells = md.weeklyData.map(wd => {
      const total = wd.logged + wd.planned + wd.overtime;
      const maxW = wd.capacity || 1;
      const barMax = Math.max(maxW, total);

      const loggedPct = (wd.logged / barMax) * 100;
      const plannedPct = (wd.planned / barMax) * 100;
      const overtimePct = (wd.overtime / barMax) * 100;
      const capPct = (wd.capacityLeft / barMax) * 100;
      const isFuture = wd.week.isFuture;

      return `<td>
        <div class="ppl-cell-bar" title="Logged: ${wd.logged}h, Planned: ${wd.planned}h, Overtime: ${wd.overtime}h">
          <div class="ppl-cell-bar-seg ppl-cell-logged" style="width: ${loggedPct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-overtime" style="width: ${overtimePct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-planned ${isFuture ? 'ppl-cell-hatched' : ''}" style="width: ${plannedPct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-capleft ${isFuture ? 'ppl-cell-hatched-light' : ''}" style="width: ${capPct}%"></div>
        </div>
      </td>`;
    }).join('');

    // Total capacity bar
    const totalUsed = md.totalLogged + md.totalPlanned;
    const totalUsedPct = md.totalCapacity > 0 ? Math.min(100, (totalUsed / md.totalCapacity) * 100) : 0;
    const overtimeTotalPct = md.totalCapacity > 0 ? Math.min(100, (Math.max(0, totalUsed - md.totalCapacity) / md.totalCapacity) * 100) : 0;
    const loggedTotalPct = md.totalCapacity > 0 ? Math.min(100, (md.totalLogged / md.totalCapacity) * 100) : 0;

    // Format totalLogged as Xh Ym
    const totalH = Math.floor(md.totalLogged);
    const totalM = Math.round((md.totalLogged - totalH) * 60);
    const loggedDisplay = totalM > 0 ? `${totalH}h${String(totalM).padStart(2, '0')}m` : `${totalH}h`;

    return `
      <tr>
        <td class="ppl-name-cell">
          <div class="ppl-avatar" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
          <div class="ppl-name-info">
            <span class="ppl-name">${_pplEscape(m.name)}</span>
            <span class="ppl-role">${_pplEscape(m.role) || 'Member'}, ${capacity}h/wk</span>
          </div>
        </td>
        ${weekCells}
        <td class="ppl-notify-cell">
          <button class="ppl-notify-btn" title="Notify ${_pplEscape(m.name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </td>
        <td class="ppl-logged-cell"><span class="ppl-logged-value">${loggedDisplay}</span></td>
        <td class="ppl-capacity-cell">
          <div class="ppl-cap-bar-wrap">
            <div class="ppl-cap-bar-bg">
              <div class="ppl-cap-bar-fill" style="width: ${loggedTotalPct}%"></div>
              ${overtimeTotalPct > 0 ? `<div class="ppl-cap-bar-overtime" style="width: ${overtimeTotalPct}%"></div>` : ''}
            </div>
          </div>
        </td>
        <td class="ppl-actions-cell">
          <button class="ppl-more-btn" onclick="event.stopPropagation(); _pplShowMemberMenu('${m.id}', event)" title="More actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="ppl-table-wrap">
      <table class="ppl-table">
        <thead>
          <tr>
            <th class="ppl-th-name">Name</th>
            ${weekHeaders}
            <th class="ppl-th-icon"></th>
            <th class="ppl-th-logged">Logged</th>
            <th class="ppl-th-capacity">Total capacity</th>
            <th class="ppl-th-actions"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ===== Avatar Color =====

function _pplAvatarColor(name) {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ===== Member Context Menu =====

function _pplShowMemberMenu(memberId, event) {
  _pplHideMemberMenu();
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const menu = document.createElement('div');
  menu.id = 'ppl-context-menu';
  menu.className = 'ppl-context-menu';
  menu.innerHTML = `
    <button onclick="_pplEditMember('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit member
    </button>
    <button onclick="_pplViewMemberTasks('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      View tasks
    </button>
    <button class="ppl-menu-danger" onclick="_pplDeleteMember('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Remove member
    </button>
  `;

  // Position near the button
  const rect = event.target.closest('button').getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;

  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _pplHideMemberMenu, { once: true });
  }, 0);
}

function _pplHideMemberMenu() {
  const existing = document.getElementById('ppl-context-menu');
  if (existing) existing.remove();
}

function _pplEditMember(memberId) {
  _pplHideMemberMenu();
  if (typeof openEditMemberModal === 'function') {
    openEditMemberModal(memberId);
  } else {
    // Fallback: use the timeline's member modal
    _pplShowEditMemberModal(memberId);
  }
}

function _pplViewMemberTasks(memberId) {
  _pplHideMemberMenu();
  // Switch to timeline view filtered by this person
  AppState.timelineFilterPerson = memberId;
  navigateTo('timeline');
}

async function _pplDeleteMember(memberId) {
  _pplHideMemberMenu();
  if (!confirm('Remove this team member?')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete team member');
    showNotification('Team member removed', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Edit Member Modal (fallback) =====

function _pplShowEditMemberModal(memberId) {
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="ppl-edit-name" class="form-input" value="${_pplEscape(member.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <input type="text" id="ppl-edit-role" class="form-input" value="${_pplEscape(member.role)}">
    </div>
    <div class="form-group">
      <label class="form-label">Weekly Capacity (hours)</label>
      <input type="number" id="ppl-edit-capacity" class="form-input" value="${member.weekly_capacity_hours}" min="1" max="80">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitEditMember('${member.id}')">Save</button>
  `;
  _tlShowModal(_tlModalShell('Edit Team Member', body, footer));
}

async function _pplSubmitEditMember(memberId) {
  const name = document.getElementById('ppl-edit-name')?.value?.trim();
  const role = document.getElementById('ppl-edit-role')?.value?.trim() || '';
  const capacity = parseInt(document.getElementById('ppl-edit-capacity')?.value) || 40;

  if (!name) { showNotification('Please enter a name', 'warning'); return; }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, weekly_capacity_hours: capacity })
    });
    if (!resp.ok) throw new Error('Failed to update');
    closeTimelineModal();
    showNotification('Member updated', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== All Users View =====

function _pplBuildAllUsers() {
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();
  const filtered = searchQ ? members.filter(m => m.name.toLowerCase().includes(searchQ)) : members;

  if (filtered.length === 0) {
    return `<div class="ppl-table-empty"><p>No team members found.</p></div>`;
  }

  const rows = filtered.map(m => {
    const initials = m.avatar_initials || '??';
    const tasks = (AppState.timelineTasks || []).filter(t => t.assignee_id === m.id);
    const activeTasks = tasks.filter(t => t.status !== 'done').length;
    const doneTasks = tasks.filter(t => t.status === 'done').length;

    return `
      <div class="ppl-user-card" onclick="_pplViewMemberTasks('${m.id}')">
        <div class="ppl-avatar ppl-avatar--lg" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
        <div class="ppl-user-card-info">
          <span class="ppl-user-card-name">${_pplEscape(m.name)}</span>
          <span class="ppl-user-card-role">${_pplEscape(m.role) || 'Member'}</span>
        </div>
        <div class="ppl-user-card-stats">
          <span class="ppl-user-stat"><strong>${activeTasks}</strong> active</span>
          <span class="ppl-user-stat"><strong>${doneTasks}</strong> done</span>
          <span class="ppl-user-stat"><strong>${m.weekly_capacity_hours || 40}</strong>h/wk</span>
        </div>
        <button class="ppl-more-btn" onclick="event.stopPropagation(); _pplShowMemberMenu('${m.id}', event)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  return `<div class="ppl-user-grid">${rows}</div>`;
}

// ===== Activities View =====

function _pplBuildActivities() {
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const projects = AppState.timelineProjects || [];

  // Sort by created_at descending
  const sorted = [...tasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);

  if (sorted.length === 0) {
    return `<div class="ppl-table-empty"><p>No recent activity.</p></div>`;
  }

  const items = sorted.map(task => {
    const member = members.find(m => m.id === task.assignee_id);
    const project = projects.find(p => p.id === task.project_id);
    const memberName = member ? _pplEscape(member.name) : 'Unknown';
    const initials = member ? (member.avatar_initials || '??') : '??';
    const projectName = project ? _pplEscape(project.name) : 'Unknown';
    const color = project?.color || '#14b8a6';

    const statusIcon = task.status === 'done' ? '\u2705'
      : task.status === 'in_progress' ? '\u{1F6A7}' : '\u{1F4CB}';

    const ago = _pplTimeAgo(task.created_at);

    return `
      <div class="ppl-activity-item">
        <div class="ppl-avatar ppl-avatar--sm" style="background: ${_pplAvatarColor(memberName)}">${_pplEscape(initials)}</div>
        <div class="ppl-activity-content">
          <span class="ppl-activity-text">
            <strong>${memberName}</strong> assigned to <span style="color: ${color}; font-weight: 600;">${projectName}</span>
            &mdash; ${_pplEscape(task.title)} ${statusIcon}
          </span>
          <span class="ppl-activity-time">${ago}</span>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="ppl-activity-list">${items}</div>`;
}

function _pplTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

// ===== Main Toolbar =====

function _pplBuildToolbar() {
  const tab = AppState.peopleTab || 'dashboard';
  const weeks = _pplGetWeeks();
  const rangeLabel = _pplFormatRangeLabel(weeks);
  const numWeeks = AppState.peopleWeeks || 4;
  const members = AppState.timelineTeamMembers || [];

  const memberFilterOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.peopleFilterMember === m.id ? 'selected' : ''}>${_pplEscape(m.name)}</option>`
  ).join('');

  // Tab index for sliding pill
  const tabIndex = tab === 'allUsers' ? 1 : tab === 'activities' ? 2 : 0;

  return `
    <div class="ppl-header">
      <div class="ppl-header-top">
        <h2 class="ppl-page-title">People</h2>
        <div class="ppl-header-actions">
          <div class="ppl-search-wrap">
            <svg class="ppl-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="ppl-search-input" placeholder="Name or role..." value="${_pplEscape(AppState.peopleSearchQuery || '')}" oninput="_pplSearchMembers(this.value)">
          </div>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal(); AppState._peopleReturnAfterModal = true;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            New member
          </button>
        </div>
      </div>

      <div class="ppl-header-tabs">
        <div class="tl-pill-group" data-count="3">
          <div class="tl-pill-slider" style="--pill-index: ${tabIndex}; --pill-count: 3;"></div>
          <button class="tl-pill-btn ${tab === 'dashboard' ? 'active' : ''}" onclick="_pplSetTab('dashboard')">Dashboard</button>
          <button class="tl-pill-btn ${tab === 'allUsers' ? 'active' : ''}" onclick="_pplSetTab('allUsers')">All Users</button>
          <button class="tl-pill-btn ${tab === 'activities' ? 'active' : ''}" onclick="_pplSetTab('activities')">Activities</button>
        </div>
      </div>

      ${tab === 'dashboard' ? `
      <div class="ppl-controls">
        <div class="tl-filter-wrap">
          <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
          <select class="tl-filter-v2" onchange="_pplSetFilterMember(this.value)">
            <option value="">All users</option>
            ${memberFilterOpts}
          </select>
        </div>

        <div class="ppl-nav-group">
          <button class="tl-nav-btn" onclick="_pplNavigateWeeks(-1)" title="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="ppl-weeks-select-wrap">
            <select class="ppl-weeks-select" onchange="_pplSetWeeks(parseInt(this.value))">
              <option value="2" ${numWeeks === 2 ? 'selected' : ''}>2 weeks</option>
              <option value="4" ${numWeeks === 4 ? 'selected' : ''}>4 weeks</option>
              <option value="6" ${numWeeks === 6 ? 'selected' : ''}>6 weeks</option>
              <option value="8" ${numWeeks === 8 ? 'selected' : ''}>8 weeks</option>
            </select>
          </div>
          <button class="tl-nav-btn" onclick="_pplNavigateWeeks(1)" title="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <span class="ppl-range-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${rangeLabel}
        </span>
      </div>` : ''}
    </div>
  `;
}

// ===== Main Render =====

async function renderPeople() {
  const content = document.getElementById('content');
  if (!content) return;

  // Ensure data is loaded (reuse timeline fetchers)
  if (!AppState._peopleInitialLoad) {
    AppState._peopleInitialLoad = true;
    content.innerHTML = `<div class="animate-slide-up" style="padding: 48px; text-align: center;"><p style="color: var(--text-muted);">Loading team data...</p></div>`;
    await timelineRefreshData();
  }

  // Filter by a specific member if set
  const prevTasks = AppState.timelineTasks;
  const filterMember = AppState.peopleFilterMember;
  if (filterMember) {
    // Temporarily filter tasks for computations
    AppState.timelineTasks = (prevTasks || []).filter(t => t.assignee_id === filterMember);
    // Also filter members shown
    const allMembers = AppState.timelineTeamMembers;
    AppState.timelineTeamMembers = (allMembers || []).filter(m => m.id === filterMember);

    var allData = _pplComputeAllData();

    // Restore
    AppState.timelineTasks = prevTasks;
    AppState.timelineTeamMembers = allMembers;
  } else {
    var allData = _pplComputeAllData();
  }

  const tab = AppState.peopleTab || 'dashboard';
  const toolbar = _pplBuildToolbar();

  let body = '';
  if (tab === 'dashboard') {
    body = _pplBuildChart(allData) + _pplBuildFilters(allData) + _pplBuildTable(allData);
  } else if (tab === 'allUsers') {
    body = _pplBuildAllUsers();
  } else if (tab === 'activities') {
    body = _pplBuildActivities();
  }

  content.innerHTML = `
    <div class="animate-slide-up ppl-view">
      ${toolbar}
      <div class="ppl-body">${body}</div>
    </div>
  `;
}

// ===== Global Exports =====

if (typeof window !== 'undefined') {
  window.renderPeople = renderPeople;
  window._pplSetTab = _pplSetTab;
  window._pplSetFilter = _pplSetFilter;
  window._pplSetFilterMember = _pplSetFilterMember;
  window._pplNavigateWeeks = _pplNavigateWeeks;
  window._pplSetWeeks = _pplSetWeeks;
  window._pplSearchMembers = _pplSearchMembers;
  window._pplShowMemberMenu = _pplShowMemberMenu;
  window._pplHideMemberMenu = _pplHideMemberMenu;
  window._pplEditMember = _pplEditMember;
  window._pplViewMemberTasks = _pplViewMemberTasks;
  window._pplDeleteMember = _pplDeleteMember;
  window._pplSubmitEditMember = _pplSubmitEditMember;
}
