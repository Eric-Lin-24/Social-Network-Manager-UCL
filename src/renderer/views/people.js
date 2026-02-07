// ============================================
// CLASSES VIEW - Class & Student Dashboard
// Teacher-focused: attendance, grades, workload,
// class roster, and student management
// ============================================

// ===== People State =====

if (!AppState.peopleTab) AppState.peopleTab = 'overview'; // 'overview' | 'roster' | 'attendance' | 'grades' | 'activities'
if (!AppState.peopleWeeks) AppState.peopleWeeks = 4;
if (!AppState.peopleFilterMember) AppState.peopleFilterMember = '';
if (!AppState.peopleFilter) AppState.peopleFilter = ''; // '' | 'missing' | 'overtime'
if (!AppState.peopleSearchQuery) AppState.peopleSearchQuery = '';
if (!AppState._peopleInitialLoad) AppState._peopleInitialLoad = false;

// Attendance state
if (!AppState._attendanceData) AppState._attendanceData = {}; // { 'memberId_YYYY-MM-DD': 'present'|'absent'|'late' }
if (!AppState._attendanceWeekOffset) AppState._attendanceWeekOffset = 0;

// Grade state
if (!AppState._gradesData) AppState._gradesData = {}; // { 'memberId_assignmentId': score }
if (!AppState._gradeAssignments) AppState._gradeAssignments = []; // [{id, name, maxScore, date}]

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
  let planned = 0;
  let logged = 0;

  for (const task of tasks) {
    if (task.assignee_id !== memberId) continue;
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
      if (!week.isFuture && logged === 0 && planned === 0 && capacity > 0) hasMissing = true;

      totalLogged += logged;
      totalPlanned += planned;
      totalCapacity += capacity;

      weeklyData.push({ week, logged, planned, capacity, overtime, capacityLeft });
    }

    memberData.push({
      member, weeklyData, totalLogged, totalPlanned, totalCapacity, hasOvertime, hasMissing,
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

// ===== Avatar Color =====

function _pplAvatarColor(name) {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ===== Overview Stats Cards =====

function _pplBuildOverviewStats() {
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const todayISO = _pplDateToISO(new Date());

  const totalStudents = members.length;
  const activeLessons = tasks.filter(t => t.status === 'in_progress').length;
  const completedLessons = tasks.filter(t => t.status === 'done').length;
  const plannedLessons = tasks.filter(t => t.status === 'planned').length;
  const totalLessons = completedLessons + activeLessons + plannedLessons;

  // Upcoming deadlines (lessons ending within next 7 days)
  const nextWeekISO = _pplDateToISO(_pplAddDays(new Date(), 7));
  const upcomingDeadlines = tasks.filter(t => t.end_date >= todayISO && t.end_date <= nextWeekISO && t.status !== 'done').length;

  // Overdue lessons
  const overdueLessons = tasks.filter(t => t.end_date < todayISO && t.status !== 'done').length;

  // Attendance rate
  const attendanceEntries = Object.values(AppState._attendanceData || {});
  const totalEntries = attendanceEntries.length;
  const presentCount = attendanceEntries.filter(v => v === 'present').length;
  const attendanceRate = totalEntries > 0 ? Math.round((presentCount / totalEntries) * 100) : null;

  return `
    <div class="cls-stats-grid">
      <div class="cls-stat-card">
        <div class="cls-stat-icon cls-stat-icon--students">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/>
          </svg>
        </div>
        <div class="cls-stat-info">
          <span class="cls-stat-value">${totalStudents}</span>
          <span class="cls-stat-label">Total Students</span>
        </div>
      </div>

      <div class="cls-stat-card">
        <div class="cls-stat-icon cls-stat-icon--active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div class="cls-stat-info">
          <span class="cls-stat-value">${activeLessons}</span>
          <span class="cls-stat-label">Active Lessons</span>
        </div>
      </div>

      <div class="cls-stat-card">
        <div class="cls-stat-icon cls-stat-icon--done">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <div class="cls-stat-info">
          <span class="cls-stat-value">${completedLessons}<span class="cls-stat-sub">/${totalLessons}</span></span>
          <span class="cls-stat-label">Completed</span>
        </div>
      </div>

      <div class="cls-stat-card ${overdueLessons > 0 ? 'cls-stat-card--alert' : ''}">
        <div class="cls-stat-icon ${overdueLessons > 0 ? 'cls-stat-icon--overdue' : 'cls-stat-icon--upcoming'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="cls-stat-info">
          <span class="cls-stat-value">${overdueLessons > 0 ? overdueLessons : upcomingDeadlines}</span>
          <span class="cls-stat-label">${overdueLessons > 0 ? 'Overdue' : 'Due This Week'}</span>
        </div>
      </div>

      ${attendanceRate !== null ? `
      <div class="cls-stat-card">
        <div class="cls-stat-icon cls-stat-icon--attendance">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
          </svg>
        </div>
        <div class="cls-stat-info">
          <span class="cls-stat-value">${attendanceRate}%</span>
          <span class="cls-stat-label">Attendance Rate</span>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

// ===== Teaching Load Chart =====

function _pplBuildChart(allData) {
  const { memberData, weeks } = allData;

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
  const yMax = Math.ceil(maxVal / 30) * 30;
  const ySteps = [];
  for (let v = 0; v <= yMax; v += Math.max(30, Math.floor(yMax / 4 / 10) * 10)) {
    ySteps.push(v);
  }
  if (ySteps[ySteps.length - 1] < yMax) ySteps.push(yMax);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const barsHTML = weekAggregates.map((agg) => {
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
          <div class="ppl-bar-segment ppl-bar-cap-left ${isFuture ? 'ppl-bar-hatched' : ''}" style="height: ${capLeftH}px;" title="Available: ${agg.capacityLeft}h"></div>
          <div class="ppl-bar-segment ppl-bar-overtime" style="height: ${overtimeH}px;" title="Overloaded: ${agg.overtime}h"></div>
          <div class="ppl-bar-segment ppl-bar-planned ${isFuture ? 'ppl-bar-hatched' : ''}" style="height: ${plannedH}px;" title="Planned: ${agg.planned}h"></div>
          <div class="ppl-bar-segment ppl-bar-logged" style="height: ${loggedH}px;" title="Taught: ${agg.logged}h"></div>
        </div>
        <div class="ppl-bar-label">${label1}<br>${label2}</div>
      </div>
    `;
  }).join('');

  const yLabelsHTML = ySteps.map(v => {
    const bottom = (v / yMax) * 200;
    return `<span class="ppl-y-label" style="bottom: ${bottom}px;">${v}</span>`;
  }).join('');

  const gridLinesHTML = ySteps.map(v => {
    const bottom = (v / yMax) * 200;
    return `<div class="ppl-grid-line" style="bottom: ${bottom}px;"></div>`;
  }).join('');

  return `
    <div class="ppl-chart-card">
      <div class="ppl-chart-header">
        <h3 class="ppl-chart-title">Teaching Load per Week</h3>
        <div class="ppl-legend">
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-logged"></span> Taught</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-planned"></span> Planned</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-capacity"></span> Available</span>
          <span class="ppl-legend-item"><span class="ppl-legend-dot ppl-legend-overtime"></span> Overloaded</span>
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
        Behind schedule <span class="ppl-filter-emoji">\u{1F634}</span>
        ${missingCount > 0 ? `<span class="ppl-filter-count">${missingCount}</span>` : ''}
      </button>
      <button class="ppl-filter-badge ${active === 'overtime' ? 'ppl-filter-badge--active' : ''}" onclick="_pplSetFilter('overtime')">
        Overloaded <span class="ppl-filter-emoji">\u{1F525}</span>
        ${overtimeCount > 0 ? `<span class="ppl-filter-count">${overtimeCount}</span>` : ''}
      </button>
    </div>
  `;
}

// ===== Student Table (Teaching Load) =====

function _pplBuildTable(allData) {
  const { memberData, weeks } = allData;
  const filter = AppState.peopleFilter || '';
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();

  let filtered = memberData;
  if (filter === 'missing') filtered = filtered.filter(m => m.hasMissing);
  if (filter === 'overtime') filtered = filtered.filter(m => m.hasOvertime);
  if (searchQ) filtered = filtered.filter(m => m.member.name.toLowerCase().includes(searchQ));

  if (filtered.length === 0) {
    return `<div class="ppl-table-empty"><p>No students match the current filter.</p></div>`;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
        <div class="ppl-cell-bar" title="Taught: ${wd.logged}h, Planned: ${wd.planned}h, Overloaded: ${wd.overtime}h">
          <div class="ppl-cell-bar-seg ppl-cell-logged" style="width: ${loggedPct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-overtime" style="width: ${overtimePct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-planned ${isFuture ? 'ppl-cell-hatched' : ''}" style="width: ${plannedPct}%"></div>
          <div class="ppl-cell-bar-seg ppl-cell-capleft ${isFuture ? 'ppl-cell-hatched-light' : ''}" style="width: ${capPct}%"></div>
        </div>
      </td>`;
    }).join('');

    const totalH = Math.floor(md.totalLogged);
    const totalM = Math.round((md.totalLogged - totalH) * 60);
    const loggedDisplay = totalM > 0 ? `${totalH}h${String(totalM).padStart(2, '0')}m` : `${totalH}h`;
    const loggedTotalPct = md.totalCapacity > 0 ? Math.min(100, (md.totalLogged / md.totalCapacity) * 100) : 0;
    const overtimeTotalPct = md.totalCapacity > 0 ? Math.min(100, (Math.max(0, md.totalLogged + md.totalPlanned - md.totalCapacity) / md.totalCapacity) * 100) : 0;

    return `
      <tr>
        <td class="ppl-name-cell">
          <div class="ppl-avatar" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
          <div class="ppl-name-info">
            <span class="ppl-name">${_pplEscape(m.name)}</span>
            <span class="ppl-role">${_pplEscape(m.role) || 'Student'}, ${capacity}h/wk</span>
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
            <th class="ppl-th-name">Student</th>
            ${weekHeaders}
            <th class="ppl-th-icon"></th>
            <th class="ppl-th-logged">Hours</th>
            <th class="ppl-th-capacity">Load</th>
            <th class="ppl-th-actions"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
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
      Edit Student
    </button>
    <button onclick="_pplViewMemberTasks('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      View Lessons
    </button>
    <button onclick="_pplViewStudentReport('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Student Report
    </button>
    <button class="ppl-menu-danger" onclick="_pplDeleteMember('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Remove Student
    </button>
  `;

  const rect = event.target.closest('button').getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;

  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', _pplHideMemberMenu, { once: true }); }, 0);
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
    _pplShowEditMemberModal(memberId);
  }
}

function _pplViewMemberTasks(memberId) {
  _pplHideMemberMenu();
  AppState.timelineFilterPerson = memberId;
  navigateTo('timeline');
}

// ===== Student Report Modal =====

function _pplViewStudentReport(memberId) {
  _pplHideMemberMenu();
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const tasks = (AppState.timelineTasks || []).filter(t => t.assignee_id === memberId);
  const projects = AppState.timelineProjects || [];
  const activeTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const todayISO = _pplDateToISO(new Date());
  const overdueTasks = tasks.filter(t => t.end_date < todayISO && t.status !== 'done');

  // Attendance summary
  const attendanceKeys = Object.keys(AppState._attendanceData || {}).filter(k => k.startsWith(memberId + '_'));
  const totalAttendance = attendanceKeys.length;
  const presentDays = attendanceKeys.filter(k => AppState._attendanceData[k] === 'present').length;
  const lateDays = attendanceKeys.filter(k => AppState._attendanceData[k] === 'late').length;
  const absentDays = attendanceKeys.filter(k => AppState._attendanceData[k] === 'absent').length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentDays / totalAttendance) * 100) : 'N/A';

  const taskListHTML = tasks.slice(0, 10).map(task => {
    const project = projects.find(p => p.id === task.project_id);
    const statusIcon = task.status === 'done' ? '<span style="color: var(--success);">\u2713</span>'
      : task.status === 'in_progress' ? '<span style="color: var(--info);">\u25B6</span>'
      : '<span style="color: var(--text-muted);">\u25CB</span>';
    const isOverdue = task.end_date < todayISO && task.status !== 'done';
    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
        ${statusIcon}
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--text-primary);">${_pplEscape(task.title)}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">${project ? _pplEscape(project.name) : ''} &middot; ${task.start_date} \u2192 ${task.end_date}</div>
        </div>
        ${isOverdue ? '<span style="font-size: 0.625rem; padding: 2px 8px; background: var(--error-soft); color: var(--error); border-radius: 100px; font-weight: 600;">OVERDUE</span>' : ''}
      </div>
    `;
  }).join('');

  const body = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
      <div style="background: var(--accent-primary-soft); border-radius: 10px; padding: 14px; text-align: center;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-primary);">${activeTasks.length}</div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">Active</div>
      </div>
      <div style="background: var(--success-soft); border-radius: 10px; padding: 14px; text-align: center;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--success);">${doneTasks.length}</div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">Done</div>
      </div>
      <div style="background: var(--info-soft); border-radius: 10px; padding: 14px; text-align: center;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--info);">${typeof attendanceRate === 'number' ? attendanceRate + '%' : attendanceRate}</div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">Attendance</div>
      </div>
      <div style="background: ${overdueTasks.length > 0 ? 'var(--error-soft)' : 'var(--warning-soft)'}; border-radius: 10px; padding: 14px; text-align: center;">
        <div style="font-size: 1.5rem; font-weight: 800; color: ${overdueTasks.length > 0 ? 'var(--error)' : 'var(--warning)'};">${overdueTasks.length}</div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">Overdue</div>
      </div>
    </div>
    ${totalAttendance > 0 ? `
    <div style="margin-bottom: 16px;">
      <h4 style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Attendance Breakdown</h4>
      <div style="display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-secondary);">
        <span>\u2713 Present: <strong>${presentDays}</strong></span>
        <span>\u23F0 Late: <strong>${lateDays}</strong></span>
        <span>\u2717 Absent: <strong>${absentDays}</strong></span>
      </div>
    </div>
    ` : ''}
    <div>
      <h4 style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Assigned Lessons</h4>
      ${taskListHTML || '<p style="color: var(--text-muted); font-size: 0.8125rem;">No lessons assigned.</p>'}
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Close</button>
    <button class="btn btn-primary" onclick="closeTimelineModal(); _pplViewMemberTasks('${memberId}')">View in Planner</button>
  `;

  _tlShowModal(_tlModalShell(`Report: ${_pplEscape(member.name)}`, body, footer));
}

async function _pplDeleteMember(memberId) {
  _pplHideMemberMenu();
  if (!confirm('Remove this student?')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete team member');
    showNotification('Student removed', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Edit Student Modal =====

function _pplShowEditMemberModal(memberId) {
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="ppl-edit-name" class="form-input" value="${_pplEscape(member.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Year Group / Class</label>
      <input type="text" id="ppl-edit-role" class="form-input" value="${_pplEscape(member.role)}">
    </div>
    <div class="form-group">
      <label class="form-label">Weekly Hours</label>
      <input type="number" id="ppl-edit-capacity" class="form-input" value="${member.weekly_capacity_hours}" min="1" max="80">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitEditMember('${member.id}')">Save</button>
  `;
  _tlShowModal(_tlModalShell('Edit Student', body, footer));
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
    showNotification('Student updated', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== ATTENDANCE VIEW =====

function _pplBuildAttendance() {
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();
  const filtered = searchQ ? members.filter(m => m.name.toLowerCase().includes(searchQ)) : members;

  if (members.length === 0) {
    return `<div class="ppl-table-empty"><p>No students added yet. Add students to track attendance.</p></div>`;
  }

  const offset = AppState._attendanceWeekOffset || 0;
  const now = new Date();
  const baseStart = _pplWeekStart(now);
  const weekStart = _pplAddDays(baseStart, offset * 7);
  const days = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayISO = _pplDateToISO(new Date());

  for (let i = 0; i < 5; i++) {
    const d = _pplAddDays(weekStart, i);
    days.push({
      date: d,
      iso: _pplDateToISO(d),
      day: dayNames[i],
      dayNum: d.getDate(),
      month: months[d.getMonth()],
      isToday: _pplDateToISO(d) === todayISO,
      isFuture: _pplDateToISO(d) > todayISO
    });
  }

  const weekLabel = `${months[weekStart.getMonth()]} ${weekStart.getDate()} \u2013 ${months[_pplAddDays(weekStart, 4).getMonth()]} ${_pplAddDays(weekStart, 4).getDate()}`;

  const dayHeaders = days.map(d => `
    <th class="att-day-header ${d.isToday ? 'att-day-today' : ''} ${d.isFuture ? 'att-day-future' : ''}">
      <span class="att-day-name">${d.day}</span>
      <span class="att-day-num">${d.month} ${d.dayNum}</span>
    </th>
  `).join('');

  const dayStatsHTML = days.map(d => {
    let present = 0, total = 0;
    for (const m of filtered) {
      const key = `${m.id}_${d.iso}`;
      const val = AppState._attendanceData[key];
      if (val) {
        total++;
        if (val === 'present') present++;
      }
    }
    const rate = total > 0 ? Math.round((present / total) * 100) : null;
    return `<td class="att-day-stat ${d.isToday ? 'att-stat-today' : ''}">
      ${rate !== null ? `<span class="att-stat-rate">${rate}%</span>` : '<span class="att-stat-empty">&mdash;</span>'}
    </td>`;
  }).join('');

  const rows = filtered.map(m => {
    const initials = m.avatar_initials || '??';
    const cells = days.map(d => {
      const key = `${m.id}_${d.iso}`;
      const val = AppState._attendanceData[key] || '';

      const presentActive = val === 'present' ? 'att-btn-active att-btn-present' : '';
      const lateActive = val === 'late' ? 'att-btn-active att-btn-late' : '';
      const absentActive = val === 'absent' ? 'att-btn-active att-btn-absent' : '';

      return `<td class="${d.isToday ? 'att-cell-today' : ''} ${d.isFuture ? 'att-cell-future' : ''}">
        <div class="att-btn-group">
          <button class="att-mark-btn ${presentActive}" onclick="_pplMarkAttendance('${m.id}', '${d.iso}', 'present')" title="Present">\u2713</button>
          <button class="att-mark-btn ${lateActive}" onclick="_pplMarkAttendance('${m.id}', '${d.iso}', 'late')" title="Late">\u23F0</button>
          <button class="att-mark-btn ${absentActive}" onclick="_pplMarkAttendance('${m.id}', '${d.iso}', 'absent')" title="Absent">\u2717</button>
        </div>
      </td>`;
    }).join('');

    const memberKeys = Object.keys(AppState._attendanceData).filter(k => k.startsWith(m.id + '_'));
    const memberTotal = memberKeys.length;
    const memberPresent = memberKeys.filter(k => AppState._attendanceData[k] === 'present').length;
    const memberRate = memberTotal > 0 ? Math.round((memberPresent / memberTotal) * 100) : null;

    return `<tr>
      <td class="ppl-name-cell">
        <div class="ppl-avatar ppl-avatar--sm" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
        <div class="ppl-name-info">
          <span class="ppl-name">${_pplEscape(m.name)}</span>
          <span class="ppl-role">${_pplEscape(m.role) || 'Student'}</span>
        </div>
      </td>
      ${cells}
      <td class="att-rate-cell">
        ${memberRate !== null ? `
          <span class="att-rate-badge ${memberRate >= 90 ? 'att-rate-good' : memberRate >= 70 ? 'att-rate-warn' : 'att-rate-bad'}">${memberRate}%</span>
        ` : '<span class="att-rate-badge att-rate-na">N/A</span>'}
      </td>
    </tr>`;
  }).join('');

  const quickMarkHTML = days.map(d => `
    <td class="${d.isToday ? 'att-cell-today' : ''}">
      <button class="att-mark-all-btn" onclick="_pplMarkAllAttendance('${d.iso}', 'present')" title="Mark all present">\u2713 All</button>
    </td>
  `).join('');

  return `
    <div class="att-controls">
      <button class="tl-nav-btn" onclick="_pplAttendanceNav(-1)" title="Previous week">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="att-week-label">${weekLabel}</span>
      <button class="tl-nav-btn" onclick="_pplAttendanceNav(1)" title="Next week">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button class="tl-today-btn" onclick="AppState._attendanceWeekOffset = 0; renderPeople();">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
        This Week
      </button>
    </div>
    <div class="ppl-table-wrap">
      <table class="ppl-table att-table">
        <thead>
          <tr>
            <th class="ppl-th-name">Student</th>
            ${dayHeaders}
            <th class="att-th-rate">Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr class="att-stats-row">
            <td style="font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);">DAILY RATE</td>
            ${dayStatsHTML}
            <td></td>
          </tr>
          <tr class="att-quick-row">
            <td style="font-size: 0.6875rem; font-weight: 600; color: var(--text-muted);">QUICK MARK</td>
            ${quickMarkHTML}
            <td></td>
          </tr>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function _pplMarkAttendance(memberId, dateISO, status) {
  const key = `${memberId}_${dateISO}`;
  if (AppState._attendanceData[key] === status) {
    delete AppState._attendanceData[key];
  } else {
    AppState._attendanceData[key] = status;
  }
  renderPeople();
}

function _pplMarkAllAttendance(dateISO, status) {
  const members = AppState.timelineTeamMembers || [];
  for (const m of members) {
    AppState._attendanceData[`${m.id}_${dateISO}`] = status;
  }
  renderPeople();
}

function _pplAttendanceNav(direction) {
  AppState._attendanceWeekOffset = (AppState._attendanceWeekOffset || 0) + direction;
  renderPeople();
}

// ===== GRADE TRACKER VIEW =====

function _pplBuildGrades() {
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();
  const filtered = searchQ ? members.filter(m => m.name.toLowerCase().includes(searchQ)) : members;
  const assignments = AppState._gradeAssignments || [];

  if (members.length === 0) {
    return `<div class="ppl-table-empty"><p>No students added yet. Add students to track grades.</p></div>`;
  }

  const addAssignmentBtn = `
    <button class="tl-action-btn tl-action-btn--secondary" onclick="_pplAddAssignment()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Assignment
    </button>
  `;

  if (assignments.length === 0) {
    return `
      <div class="ppl-table-empty" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p>No assignments created yet. Create one to start tracking grades.</p>
        ${addAssignmentBtn}
      </div>
    `;
  }

  const assignmentHeaders = assignments.map(a => `
    <th class="grade-assign-header" title="${_pplEscape(a.name)}">
      <div class="grade-assign-name">${_pplEscape(a.name)}</div>
      <div class="grade-assign-max">/ ${a.maxScore}</div>
      <button class="grade-remove-btn" onclick="event.stopPropagation(); _pplRemoveAssignment('${a.id}')" title="Remove">&times;</button>
    </th>
  `).join('');

  const rows = filtered.map(m => {
    const initials = m.avatar_initials || '??';
    const cells = assignments.map(a => {
      const key = `${m.id}_${a.id}`;
      const score = AppState._gradesData[key];
      const hasScore = score !== undefined && score !== null && score !== '';
      const pct = hasScore ? Math.round((score / a.maxScore) * 100) : null;
      const gradeClass = pct !== null ? (pct >= 80 ? 'grade-high' : pct >= 60 ? 'grade-mid' : pct >= 40 ? 'grade-low' : 'grade-fail') : '';

      return `<td class="grade-cell">
        <div class="grade-input-wrap ${gradeClass}">
          <input type="number" class="grade-input" value="${hasScore ? score : ''}"
            min="0" max="${a.maxScore}" placeholder="\u2014"
            onchange="_pplSetGrade('${m.id}', '${a.id}', this.value, ${a.maxScore})">
          ${pct !== null ? `<span class="grade-pct">${pct}%</span>` : ''}
        </div>
      </td>`;
    }).join('');

    // Student average
    const studentScores = assignments.map(a => {
      const key = `${m.id}_${a.id}`;
      const score = AppState._gradesData[key];
      return score !== undefined && score !== null && score !== '' ? { score: Number(score), max: a.maxScore } : null;
    }).filter(Boolean);

    const avgPct = studentScores.length > 0
      ? Math.round(studentScores.reduce((sum, s) => sum + (s.score / s.max) * 100, 0) / studentScores.length)
      : null;

    const avgClass = avgPct !== null ? (avgPct >= 80 ? 'grade-high' : avgPct >= 60 ? 'grade-mid' : avgPct >= 40 ? 'grade-low' : 'grade-fail') : '';

    return `<tr>
      <td class="ppl-name-cell">
        <div class="ppl-avatar ppl-avatar--sm" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
        <div class="ppl-name-info">
          <span class="ppl-name">${_pplEscape(m.name)}</span>
          <span class="ppl-role">${_pplEscape(m.role) || 'Student'}</span>
        </div>
      </td>
      ${cells}
      <td class="grade-avg-cell">
        ${avgPct !== null ? `<span class="grade-avg-badge ${avgClass}">${avgPct}%</span>` : '<span class="att-rate-badge att-rate-na">N/A</span>'}
      </td>
    </tr>`;
  }).join('');

  // Class averages row
  const classAvgsHTML = assignments.map(a => {
    const scores = filtered.map(m => {
      const key = `${m.id}_${a.id}`;
      const s = AppState._gradesData[key];
      return s !== undefined && s !== null && s !== '' ? Number(s) : null;
    }).filter(v => v !== null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;
    const pct = avg !== null ? Math.round((avg / a.maxScore) * 100) : null;
    return `<td class="grade-class-avg">
      ${avg !== null ? `<span>${avg}/${a.maxScore} (${pct}%)</span>` : '<span style="color:var(--text-muted);">&mdash;</span>'}
    </td>`;
  }).join('');

  return `
    <div class="grade-toolbar">
      ${addAssignmentBtn}
      <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="ppl-table-wrap">
      <table class="ppl-table grade-table">
        <thead>
          <tr>
            <th class="ppl-th-name">Student</th>
            ${assignmentHeaders}
            <th class="grade-th-avg">Average</th>
          </tr>
        </thead>
        <tbody>
          <tr class="grade-class-avg-row">
            <td style="font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);">CLASS AVG</td>
            ${classAvgsHTML}
            <td></td>
          </tr>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function _pplSetGrade(memberId, assignmentId, value, maxScore) {
  const key = `${memberId}_${assignmentId}`;
  if (value === '' || value === null || value === undefined) {
    delete AppState._gradesData[key];
  } else {
    AppState._gradesData[key] = Math.min(Math.max(0, Number(value)), maxScore);
  }
  renderPeople();
}

function _pplAddAssignment() {
  const body = `
    <div class="form-group">
      <label class="form-label">Assignment Name</label>
      <input type="text" id="grade-new-name" class="form-input" placeholder="e.g. Homework 3, Quiz 1, Final Exam">
    </div>
    <div class="form-group">
      <label class="form-label">Maximum Score</label>
      <input type="number" id="grade-new-max" class="form-input" value="100" min="1" max="1000">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitAssignment()">Add Assignment</button>
  `;
  _tlShowModal(_tlModalShell('New Assignment', body, footer));
}

function _pplSubmitAssignment() {
  const name = document.getElementById('grade-new-name')?.value?.trim();
  const maxScore = parseInt(document.getElementById('grade-new-max')?.value) || 100;
  if (!name) { showNotification('Please enter an assignment name', 'warning'); return; }

  const id = 'assign_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  AppState._gradeAssignments.push({ id, name, maxScore, date: _pplDateToISO(new Date()) });
  closeTimelineModal();
  showNotification('Assignment added', 'success');
  renderPeople();
}

function _pplRemoveAssignment(assignmentId) {
  if (!confirm('Remove this assignment and all its grades?')) return;
  AppState._gradeAssignments = AppState._gradeAssignments.filter(a => a.id !== assignmentId);
  const keysToDelete = Object.keys(AppState._gradesData).filter(k => k.endsWith('_' + assignmentId));
  keysToDelete.forEach(k => delete AppState._gradesData[k]);
  showNotification('Assignment removed', 'success');
  renderPeople();
}

// ===== Class Roster View =====

function _pplBuildRoster() {
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();
  const filtered = searchQ ? members.filter(m => m.name.toLowerCase().includes(searchQ)) : members;

  if (filtered.length === 0) {
    return `<div class="ppl-table-empty"><p>No students found.</p></div>`;
  }

  // Group by role
  const groups = {};
  filtered.forEach(m => {
    const group = m.role || 'Unassigned';
    if (!groups[group]) groups[group] = [];
    groups[group].push(m);
  });

  const groupsHTML = Object.entries(groups).map(([groupName, groupMembers]) => {
    const cardsHTML = groupMembers.map(m => {
      const initials = m.avatar_initials || '??';
      const tasks = (AppState.timelineTasks || []).filter(t => t.assignee_id === m.id);
      const activeTasks = tasks.filter(t => t.status !== 'done').length;
      const doneTasks = tasks.filter(t => t.status === 'done').length;
      const todayISO = _pplDateToISO(new Date());
      const overdue = tasks.filter(t => t.end_date < todayISO && t.status !== 'done').length;

      const attKeys = Object.keys(AppState._attendanceData || {}).filter(k => k.startsWith(m.id + '_'));
      const attTotal = attKeys.length;
      const attPresent = attKeys.filter(k => AppState._attendanceData[k] === 'present').length;
      const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

      return `
        <div class="cls-roster-card" onclick="_pplViewStudentReport('${m.id}')">
          <div class="cls-roster-card-top">
            <div class="ppl-avatar ppl-avatar--lg" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
            <button class="ppl-more-btn" onclick="event.stopPropagation(); _pplShowMemberMenu('${m.id}', event)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
          <div class="cls-roster-info">
            <span class="cls-roster-name">${_pplEscape(m.name)}</span>
            <span class="cls-roster-role">${_pplEscape(m.role) || 'Student'}</span>
          </div>
          <div class="cls-roster-stats">
            <div class="cls-roster-stat">
              <span class="cls-roster-stat-val">${activeTasks}</span>
              <span class="cls-roster-stat-label">Active</span>
            </div>
            <div class="cls-roster-stat">
              <span class="cls-roster-stat-val">${doneTasks}</span>
              <span class="cls-roster-stat-label">Done</span>
            </div>
            <div class="cls-roster-stat">
              <span class="cls-roster-stat-val ${overdue > 0 ? 'cls-roster-overdue' : ''}">${overdue}</span>
              <span class="cls-roster-stat-label">Overdue</span>
            </div>
            ${attRate !== null ? `
            <div class="cls-roster-stat">
              <span class="cls-roster-stat-val">${attRate}%</span>
              <span class="cls-roster-stat-label">Attend.</span>
            </div>` : ''}
          </div>
          <div class="cls-roster-capacity">
            <div class="cls-roster-cap-label">${m.weekly_capacity_hours || 40}h/wk capacity</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="cls-roster-group">
        <div class="cls-roster-group-header">
          <span class="cls-roster-group-name">${_pplEscape(groupName)}</span>
          <span class="cls-roster-group-count">${groupMembers.length} student${groupMembers.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="cls-roster-grid">${cardsHTML}</div>
      </div>
    `;
  }).join('');

  return groupsHTML;
}

// ===== Activities View =====

function _pplBuildActivities() {
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const projects = AppState.timelineProjects || [];

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
  const tab = AppState.peopleTab || 'overview';
  const weeks = _pplGetWeeks();
  const rangeLabel = _pplFormatRangeLabel(weeks);
  const numWeeks = AppState.peopleWeeks || 4;
  const members = AppState.timelineTeamMembers || [];

  const memberFilterOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.peopleFilterMember === m.id ? 'selected' : ''}>${_pplEscape(m.name)}</option>`
  ).join('');

  const tabNames = ['overview', 'roster', 'attendance', 'grades', 'activities'];
  const pillIndex = Math.max(0, tabNames.indexOf(tab));

  return `
    <div class="ppl-header">
      <div class="ppl-header-top">
        <h2 class="ppl-page-title">Classes</h2>
        <div class="ppl-header-actions">
          <div class="ppl-search-wrap">
            <svg class="ppl-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="ppl-search-input" placeholder="Search students..." value="${_pplEscape(AppState.peopleSearchQuery || '')}" oninput="_pplSearchMembers(this.value)">
          </div>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal(); AppState._peopleReturnAfterModal = true;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            New Student
          </button>
        </div>
      </div>

      <div class="ppl-header-tabs">
        <div class="tl-pill-group" data-count="5">
          <div class="tl-pill-slider" style="--pill-index: ${pillIndex}; --pill-count: 5;"></div>
          <button class="tl-pill-btn ${tab === 'overview' ? 'active' : ''}" onclick="_pplSetTab('overview')">Overview</button>
          <button class="tl-pill-btn ${tab === 'roster' ? 'active' : ''}" onclick="_pplSetTab('roster')">Class Roster</button>
          <button class="tl-pill-btn ${tab === 'attendance' ? 'active' : ''}" onclick="_pplSetTab('attendance')">Attendance</button>
          <button class="tl-pill-btn ${tab === 'grades' ? 'active' : ''}" onclick="_pplSetTab('grades')">Grades</button>
          <button class="tl-pill-btn ${tab === 'activities' ? 'active' : ''}" onclick="_pplSetTab('activities')">Activities</button>
        </div>
      </div>

      ${tab === 'overview' ? `
      <div class="ppl-controls">
        <div class="tl-filter-wrap">
          <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
          <select class="tl-filter-v2" onchange="_pplSetFilterMember(this.value)">
            <option value="">All Students</option>
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

  if (!AppState._peopleInitialLoad) {
    AppState._peopleInitialLoad = true;
    content.innerHTML = `<div class="animate-slide-up" style="padding: 48px; text-align: center;"><p style="color: var(--text-muted);">Loading class data...</p></div>`;
    await timelineRefreshData();
  }

  const prevTasks = AppState.timelineTasks;
  const filterMember = AppState.peopleFilterMember;
  if (filterMember) {
    AppState.timelineTasks = (prevTasks || []).filter(t => t.assignee_id === filterMember);
    const allMembers = AppState.timelineTeamMembers;
    AppState.timelineTeamMembers = (allMembers || []).filter(m => m.id === filterMember);

    var allData = _pplComputeAllData();

    AppState.timelineTasks = prevTasks;
    AppState.timelineTeamMembers = allMembers;
  } else {
    var allData = _pplComputeAllData();
  }

  const tab = AppState.peopleTab || 'overview';
  const toolbar = _pplBuildToolbar();

  let body = '';
  if (tab === 'overview') {
    body = _pplBuildOverviewStats() + _pplBuildChart(allData) + _pplBuildFilters(allData) + _pplBuildTable(allData);
  } else if (tab === 'roster') {
    body = _pplBuildRoster();
  } else if (tab === 'attendance') {
    body = _pplBuildAttendance();
  } else if (tab === 'grades') {
    body = _pplBuildGrades();
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
  window._pplViewStudentReport = _pplViewStudentReport;
  window._pplDeleteMember = _pplDeleteMember;
  window._pplSubmitEditMember = _pplSubmitEditMember;
  window._pplMarkAttendance = _pplMarkAttendance;
  window._pplMarkAllAttendance = _pplMarkAllAttendance;
  window._pplAttendanceNav = _pplAttendanceNav;
  window._pplSetGrade = _pplSetGrade;
  window._pplAddAssignment = _pplAddAssignment;
  window._pplSubmitAssignment = _pplSubmitAssignment;
  window._pplRemoveAssignment = _pplRemoveAssignment;
}
