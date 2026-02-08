// TIMELINE VIEW - Interactive Gantt Chart
// Drag-to-create task blocks, resize handles,
// auto-snap to day boundaries, project coloring,
// inline naming after drop.
// ============================================

// ===== Date Helpers =====

function _tlEscape(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _tlDateToISO(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _tlParseDate(str) {
  const parts = str.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function _tlAddDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function _tlWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _tlMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _tlFormatShortDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function _tlFormatMonthYear(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function _tlFormatWeekSpan(startDate, endDate) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${months[startDate.getMonth()]} ${startDate.getDate()}-${endDate.getDate()}`;
  } else {
    return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;
  }
}

const MONTH_NAMES_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

// ===== Gantt Column Generation =====

function _ganttGetColumns() {
  const zoom = AppState.timelineZoom || 'week';
  const startDate = AppState.timelineStartDate
    ? _tlParseDate(AppState.timelineStartDate)
    : _tlAddDays(new Date(), -3);

  const columns = [];
  const todayISO = _tlDateToISO(new Date());

  if (zoom === 'day') {
    for (let i = 0; i < 35; i++) {
      const d = _tlAddDays(startDate, i);
      columns.push({
        start: new Date(d),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        label: String(d.getDate()),
        iso: _tlDateToISO(d),
        isToday: _tlDateToISO(d) === todayISO,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        month: d.getMonth(),
        year: d.getFullYear()
      });
    }
  } else if (zoom === 'month') {
    const ms = _tlMonthStart(startDate);
    for (let i = 0; i < 12; i++) {
      const m = new Date(ms);
      m.setMonth(m.getMonth() + i);
      const mEnd = new Date(m);
      mEnd.setMonth(mEnd.getMonth() + 1);
      mEnd.setDate(mEnd.getDate() - 1);
      mEnd.setHours(23, 59, 59, 999);
      columns.push({
        start: new Date(m),
        end: mEnd,
        label: _tlFormatMonthYear(m),
        iso: _tlDateToISO(m),
        isToday: new Date().getMonth() === m.getMonth() && new Date().getFullYear() === m.getFullYear(),
        month: m.getMonth(),
        year: m.getFullYear()
      });
    }
  } else {
    const ws = _tlWeekStart(startDate);
    for (let i = 0; i < 16; i++) {
      const w = _tlAddDays(ws, i * 7);
      const wEnd = _tlAddDays(w, 6);
      wEnd.setHours(23, 59, 59, 999);
      columns.push({
        start: new Date(w),
        end: wEnd,
        label: _tlFormatWeekSpan(w, wEnd),
        iso: _tlDateToISO(w),
        isToday: todayISO >= _tlDateToISO(w) && todayISO <= _tlDateToISO(wEnd),
        month: w.getMonth(),
        year: w.getFullYear()
      });
    }
  }

  return columns;
}

function _ganttTaskSpan(task, columns) {
  const tStart = _tlParseDate(task.start_date);
  const tEnd = _tlParseDate(task.end_date);
  tEnd.setHours(23, 59, 59, 999);
  let startCol = -1, endCol = -1;
  for (let i = 0; i < columns.length; i++) {
    if (tStart <= columns[i].end && tEnd >= columns[i].start) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  return { startCol, endCol };
}

// Returns column span PLUS proportional pixel margins so bars
// accurately reflect the task's real duration within each column.
function _ganttTaskPosition(task, columns, colWidth) {
  const tStart = _tlParseDate(task.start_date);
  const tEnd   = _tlParseDate(task.end_date);
  tEnd.setHours(23, 59, 59, 999);

  let startCol = -1, endCol = -1;
  for (let i = 0; i < columns.length; i++) {
    if (tStart <= columns[i].end && tEnd >= columns[i].start) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  if (startCol < 0) return { startCol: -1, endCol: -1, marginLeft: 0, marginRight: 0 };

  const msPerDay = 86400000;
  const startColData = columns[startCol];
  const endColData   = columns[endCol];

  // Days in start / end columns
  const startColDays = Math.round((startColData.end - startColData.start) / msPerDay) + 1;
  const endColDays   = Math.round((endColData.end   - endColData.start)   / msPerDay) + 1;

  // Fraction into start column where task begins
  const clampedStart = new Date(Math.max(tStart.getTime(), startColData.start.getTime()));
  const daysIntoStart = Math.round((clampedStart - startColData.start) / msPerDay);
  const startFraction = daysIntoStart / startColDays;

  // Fraction into end column where task ends (inclusive day)
  const clampedEnd = new Date(Math.min(tEnd.getTime(), endColData.end.getTime()));
  const daysIntoEnd = Math.round((clampedEnd - endColData.start) / msPerDay) + 1;
  const endFraction = daysIntoEnd / endColDays;

  let marginLeft  = Math.round(startFraction * colWidth);
  let marginRight = Math.round((1 - endFraction) * colWidth);

  // Guarantee a minimum visible width (8 px)
  const totalSpan = (endCol - startCol + 1) * colWidth;
  const barWidth  = totalSpan - marginLeft - marginRight;
  if (barWidth < 8) {
    marginRight = Math.max(0, totalSpan - marginLeft - 8);
  }

  return { startCol, endCol, marginLeft, marginRight };
}

function _ganttMonthSpans(columns) {
  const spans = [];
  let cur = { month: -1, year: -1, start: 0, count: 0 };
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.month !== cur.month || col.year !== cur.year) {
      if (cur.count > 0) spans.push({ ...cur });
      cur = { month: col.month, year: col.year, start: i, count: 1 };
    } else {
      cur.count++;
    }
  }
  if (cur.count > 0) spans.push(cur);
  return spans;
}

// ===== Auto-Status Helper =====

function _tlAutoStatus(startDate, endDate) {
  const today = _tlDateToISO(new Date());
  if (today < startDate) return 'planned';
  if (today > endDate) return 'done';
  return 'in_progress';
}

// ===== Data Fetching =====

async function timelineFetchWorkspaces() {
  if (!AppState.userId) return;
  const resp = await fetch(`${AppState.authenticationUrl}/workspaces?user_uuid=${AppState.userId}`);
  if (!resp.ok) throw new Error('Failed to fetch workspaces');
  AppState.timelineWorkspaces = await resp.json();
}

async function timelineFetchProjects() {
  if (!AppState.userId) return;
  const resp = await fetch(`${AppState.authenticationUrl}/projects?user_uuid=${AppState.userId}`);
  if (!resp.ok) throw new Error('Failed to fetch projects');
  AppState.timelineProjects = await resp.json();
}

async function timelineFetchMembers() {
  if (!AppState.userId) return;
  const resp = await fetch(`${AppState.authenticationUrl}/team-members?user_uuid=${AppState.userId}`);
  if (!resp.ok) throw new Error('Failed to fetch team members');
  AppState.timelineTeamMembers = await resp.json();
}

async function timelineFetchTasks() {
  if (!AppState.userId) return;
  let url = `${AppState.authenticationUrl}/timeline-tasks?user_uuid=${AppState.userId}`;
  if (AppState.timelineFilterPerson) url += `&assignee_id=${encodeURIComponent(AppState.timelineFilterPerson)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch tasks');
  AppState.timelineTasks = await resp.json();
}

async function timelineRefreshData() {
  try {
    await Promise.all([
      timelineFetchWorkspaces(),
      timelineFetchProjects(),
      timelineFetchMembers(),
      timelineFetchTasks()
    ]);
  } catch (e) {
    console.error('Timeline data refresh failed:', e);
    if (typeof showNotification === 'function') {
      showNotification('Failed to load timeline data: ' + e.message, 'error');
    }
  }
}

// ===== Navigation =====

function _tlNavigate(direction) {
  const zoom = AppState.timelineZoom || 'week';
  const current = AppState.timelineStartDate
    ? _tlParseDate(AppState.timelineStartDate)
    : _tlAddDays(new Date(), -3);

  let next;
  if (zoom === 'day') {
    next = _tlAddDays(current, direction * 14);
  } else if (zoom === 'month') {
    next = new Date(current);
    next.setMonth(next.getMonth() + direction * 6);
  } else {
    next = _tlAddDays(current, direction * 8 * 7);
  }

  AppState.timelineStartDate = _tlDateToISO(next);
  renderTimeline();
}

function _tlGoToToday() {
  AppState.timelineStartDate = null;
  renderTimeline();
}

function timelineSetZoom(zoom) {
  AppState.timelineZoom = zoom;
  AppState.timelineStartDate = null;
  renderTimeline();
}

function timelineSetViewMode(mode) {
  AppState.timelineViewMode = mode;
  renderTimeline();
}

function timelineSetFilterProject(id) {
  AppState.timelineFilterProject = id || '';
  renderTimeline();
}

function timelineSetFilterPerson(id) {
  AppState.timelineFilterPerson = id;
  timelineFetchTasks().then(() => renderTimeline());
}

function _ganttToggleGroup(projectId) {
  if (!AppState._ganttCollapsed) AppState._ganttCollapsed = {};
  AppState._ganttCollapsed[projectId] = !AppState._ganttCollapsed[projectId];
  renderTimeline();
}

// ===== Toolbar =====

function _tlBuildToolbar() {
  const zoom = AppState.timelineZoom || 'week';
  const viewMode = AppState.timelineViewMode || 'timeline';
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const columns = _ganttGetColumns();
  const rangeStart = columns[0]?.start || new Date();
  const rangeEnd = columns[columns.length - 1]?.end || new Date();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let rangeLabel;
  if (rangeStart.getFullYear() === rangeEnd.getFullYear() && rangeStart.getMonth() === rangeEnd.getMonth()) {
    rangeLabel = `${months[rangeStart.getMonth()]} ${rangeStart.getDate()} \u2013 ${rangeEnd.getDate()}, ${rangeStart.getFullYear()}`;
  } else if (rangeStart.getFullYear() === rangeEnd.getFullYear()) {
    rangeLabel = `${months[rangeStart.getMonth()]} ${rangeStart.getDate()} \u2013 ${months[rangeEnd.getMonth()]} ${rangeEnd.getDate()}, ${rangeStart.getFullYear()}`;
  } else {
    rangeLabel = `${months[rangeStart.getMonth()]} ${rangeStart.getDate()}, ${rangeStart.getFullYear()} \u2013 ${months[rangeEnd.getMonth()]} ${rangeEnd.getDate()}, ${rangeEnd.getFullYear()}`;
  }

  const viewModeIndex = viewMode === 'list' ? 1 : 0;
  const zoomIndex = zoom === 'day' ? 0 : zoom === 'month' ? 2 : 1;

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${AppState.timelineFilterProject === p.id ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.timelineFilterPerson === m.id ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

  const showGanttNav = viewMode === 'timeline';

  return `
    <div class="tl-toolbar-v2">
      <div class="tl-toolbar-row tl-toolbar-row--top">
        <div class="tl-toolbar-section">
          <div class="tl-pill-group" data-count="2">
            <div class="tl-pill-slider" style="--pill-index: ${viewModeIndex}; --pill-count: 2;"></div>
            <button class="tl-pill-btn ${viewMode === 'timeline' ? 'active' : ''}" onclick="timelineSetViewMode('timeline')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="11" width="7" height="4" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              Gantt
            </button>
            <button class="tl-pill-btn ${viewMode === 'list' ? 'active' : ''}" onclick="timelineSetViewMode('list')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
              List
            </button>
          </div>

          ${showGanttNav ? `
          <div class="tl-separator"></div>

          <div class="tl-pill-group" data-count="3">
            <div class="tl-pill-slider" style="--pill-index: ${zoomIndex}; --pill-count: 3;"></div>
            <button class="tl-pill-btn ${zoom === 'day' ? 'active' : ''}" onclick="timelineSetZoom('day')">Day</button>
            <button class="tl-pill-btn ${zoom === 'week' ? 'active' : ''}" onclick="timelineSetZoom('week')">Week</button>
            <button class="tl-pill-btn ${zoom === 'month' ? 'active' : ''}" onclick="timelineSetZoom('month')">Month</button>
          </div>
          ` : ''}
        </div>

        ${showGanttNav ? `
        <div class="tl-toolbar-section tl-toolbar-section--nav">
          <button class="tl-nav-btn" onclick="_tlNavigate(-1)" title="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="tl-range-label-v2">${rangeLabel}</span>
          <button class="tl-nav-btn" onclick="_tlNavigate(1)" title="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="tl-today-btn" onclick="_tlGoToToday()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
            Today
          </button>
        </div>
        ` : ''}
      </div>

      <div class="tl-toolbar-row tl-toolbar-row--bottom">
        <div class="tl-toolbar-section">
          <div class="tl-filter-wrap">
            <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M9 16h4"/></svg>
            <select class="tl-filter-v2" onchange="timelineSetFilterProject(this.value)">
              <option value="">All Projects</option>
              ${projectOpts}
            </select>
          </div>
          <div class="tl-filter-wrap">
            <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
            <select class="tl-filter-v2" onchange="timelineSetFilterPerson(this.value)">
              <option value="">All Workers</option>
              ${memberOpts}
            </select>
          </div>
        </div>

        <div class="tl-toolbar-section tl-toolbar-section--actions">
          <div class="tl-drag-block" id="tl-task-drag-block" title="Drag onto the timeline to create a task">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="3"/></svg>
            <span>Task</span>
            <svg class="tl-drag-grip" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>
          </div>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateProjectModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Project
          </button>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Worker
          </button>
        </div>
      </div>
    </div>
  `;
}

// ===== Gantt Chart Builder (Interactive) =====

function _ganttBuildChart() {
  const projects = AppState.timelineProjects || [];
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const columns = _ganttGetColumns();
  const zoom = AppState.timelineZoom || 'week';
  const collapsed = AppState._ganttCollapsed || {};
  const filterProject = AppState.timelineFilterProject;
  const numCols = columns.length;
  const todayISO = _tlDateToISO(new Date());

  let visibleProjects = projects;
  if (filterProject) {
    visibleProjects = projects.filter(p => p.id === filterProject);
  }

  // Build row structure: project headers, tasks, add-rows
  const rows = [];
  for (const project of visibleProjects) {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    rows.push({ type: 'project', project, taskCount: projectTasks.length });
    if (!collapsed[project.id]) {
      for (const task of projectTasks) {
        rows.push({ type: 'task', task, project });
      }
      // Add-row: always show a blank row below tasks for drag-to-create new subtasks
      rows.push({ type: 'add', project });
    }
  }

  const orphanTasks = tasks.filter(t => !projects.find(p => p.id === t.project_id));
  if (orphanTasks.length > 0 && !filterProject) {
    const orphanProject = { id: '__orphan', name: 'Unassigned', color: '#6b7280' };
    rows.push({ type: 'project', project: orphanProject, taskCount: orphanTasks.length });
    if (!collapsed['__orphan']) {
      for (const task of orphanTasks) {
        rows.push({ type: 'task', task, project: orphanProject });
      }
      // No add-row for orphan project since it only shows up when there are already unassigned tasks
    }
  }

  if (rows.length === 0) {
    return `
      <div class="card gantt-empty-state">
        <div class="gantt-empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="10" y1="14" x2="14" y2="14" opacity="0.5"/><line x1="10" y1="17" x2="12" y2="17" opacity="0.3"/>
          </svg>
        </div>
        <h3 class="gantt-empty-title">No tasks yet</h3>
        <p class="gantt-empty-desc">Create a project and add tasks to see them on the Gantt chart.</p>
        <div class="gantt-empty-actions">
          <button class="tl-action-btn tl-action-btn--primary" onclick="openCreateProjectModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Project
          </button>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Add Worker
          </button>
        </div>
      </div>
    `;
  }

  const colWidth = zoom === 'day' ? 36 : zoom === 'month' ? 110 : 80;
  const sidebarWidth = 280;

  // Month header row (day zoom only)
  let monthHeaderHTML = '';
  if (zoom === 'day') {
    const spans = _ganttMonthSpans(columns);
    monthHeaderHTML = `<div class="gantt-month-label-cell" style="grid-column: 1; grid-row: 1;"></div>`;
    for (const span of spans) {
      const gc1 = span.start + 2;
      const gc2 = span.start + span.count + 2;
      monthHeaderHTML += `<div class="gantt-month-label" style="grid-column: ${gc1} / ${gc2}; grid-row: 1;">${MONTH_NAMES_FULL[span.month]} ${span.year}</div>`;
    }
  }

  // Date header row
  const dateRow = zoom === 'day' ? 2 : 1;
  let dateHeaderHTML = `<div class="gantt-sidebar-header" style="grid-row: ${dateRow}; grid-column: 1;">Tasks</div>`;
  for (let i = 0; i < numCols; i++) {
    const col = columns[i];
    const todayClass = col.isToday ? ' gantt-col-today' : '';
    const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
    dateHeaderHTML += `<div class="gantt-date-header${todayClass}${weekendClass}" style="grid-row: ${dateRow}; grid-column: ${i + 2};">${_tlEscape(col.label)}</div>`;
  }

  // Data rows
  const dataRowStart = dateRow + 1;
  let rowsHTML = '';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const gridRow = dataRowStart + r;

    if (row.type === 'project') {
      const isCollapsed = collapsed[row.project.id];
      const arrow = isCollapsed ? '&#9654;' : '&#9660;';

      rowsHTML += `<div class="gantt-project-label" style="grid-row: ${gridRow}; grid-column: 1;" onclick="_ganttToggleGroup('${row.project.id}')">
        <span class="gantt-toggle-arrow">${arrow}</span>
        <span class="gantt-project-dot" style="background: ${row.project.color};"></span>
        <span class="gantt-project-name">${_tlEscape(row.project.name)}</span>
        <span class="gantt-project-count">${row.taskCount}</span>
        <button class="gantt-send-msg-btn" onclick="event.stopPropagation(); sendMessageForProject('${row.project.id}')" title="Send message to assigned people">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button class="gantt-add-subtask-btn" onclick="event.stopPropagation(); openCreateTaskModal('${row.project.id}')" title="Add task">+</button>
      </div>`;

      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        rowsHTML += `<div class="gantt-project-cell${todayClass}" data-project-id="${row.project.id}" data-col-idx="${i}" data-grid-row="${gridRow}" data-project-color="${row.project.color}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }

      // Aggregate bar
      const projectTasks = tasks.filter(t => t.project_id === row.project.id);
      if (projectTasks.length > 0) {
        let minStart = projectTasks[0].start_date;
        let maxEnd = projectTasks[0].end_date;
        for (const t of projectTasks) {
          if (t.start_date < minStart) minStart = t.start_date;
          if (t.end_date > maxEnd) maxEnd = t.end_date;
        }
        const span = _ganttTaskSpan({ start_date: minStart, end_date: maxEnd }, columns);
        if (span.startCol >= 0) {
          const gc1 = span.startCol + 2;
          const gc2 = span.endCol + 3;
          rowsHTML += `<div class="gantt-aggregate-bar" style="grid-row: ${gridRow}; grid-column: ${gc1} / ${gc2}; background: ${row.project.color};"></div>`;
        }
      }

    } else if (row.type === 'task') {
      const task = row.task;
      const assigneeIds = task.assignee_id ? task.assignee_id.split(',') : [];
      const assigneeNames = assigneeIds.map(id => {
        const m = members.find(mm => mm.id === id);
        return m ? _tlEscape(m.name) : null;
      }).filter(Boolean);

      rowsHTML += `<div class="gantt-task-label" style="grid-row: ${gridRow}; grid-column: 1;" onclick="openEditTaskModal('${task.id}')">
        ${_tlEscape(task.title)}
      </div>`;

      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
        rowsHTML += `<div class="gantt-cell${todayClass}${weekendClass}" data-project-id="${row.project.id}" data-col-idx="${i}" data-grid-row="${gridRow}" data-project-color="${row.project.color}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }

      const pos = _ganttTaskPosition(task, columns, colWidth);
      if (pos.startCol >= 0) {
        const gc1 = pos.startCol + 2;
        const gc2 = pos.endCol + 3;
        const color = row.project.color || '#14b8a6';
        const doneClass = task.status === 'done' ? ' gantt-bar-done' : '';
        const assigneeLabel = assigneeNames.join(', ');

        rowsHTML += `<div class="gantt-task-bar${doneClass}" data-task-id="${task.id}" style="grid-row: ${gridRow}; grid-column: ${gc1} / ${gc2}; margin-left: ${pos.marginLeft}px; margin-right: ${pos.marginRight}px; background: ${color};"
          onmouseover="showTaskTooltip(event, '${task.id}')"
          onmouseout="hideTaskTooltip()">
          <div class="gantt-resize-handle gantt-resize-left" data-task-id="${task.id}" data-edge="left"></div>
          <span class="gantt-bar-label">${_tlEscape(task.title)}</span>
          <div class="gantt-resize-handle gantt-resize-right" data-task-id="${task.id}" data-edge="right"></div>
        </div>`;

        if (assigneeLabel && pos.endCol + 1 < numCols) {
          rowsHTML += `<div class="gantt-assignee-label" style="grid-row: ${gridRow}; grid-column: ${gc2};">${assigneeLabel}</div>`;
        }
      }

    } else if (row.type === 'add') {
      // "Draw to add" row - empty cells for drag-to-create
      rowsHTML += `<div class="gantt-add-label" style="grid-row: ${gridRow}; grid-column: 1;">
        <span class="gantt-add-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Click &amp; drag to add
        </span>
      </div>`;

      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
        rowsHTML += `<div class="gantt-add-cell${todayClass}${weekendClass}" data-project-id="${row.project.id}" data-col-idx="${i}" data-grid-row="${gridRow}" data-project-color="${row.project.color}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }
    }
  }

  // Today line
  let todayLine = '';
  for (let i = 0; i < numCols; i++) {
    if (columns[i].isToday) {
      const gc = i + 2;
      const totalGridRows = dataRowStart + rows.length;
      todayLine = `<div class="gantt-today-line" style="grid-column: ${gc}; grid-row: ${dateRow} / ${totalGridRows};"></div>`;
      break;
    }
  }

  const gridCols = `${sidebarWidth}px repeat(${numCols}, ${colWidth}px)`;

  return `
    <div class="card gantt-container">
      <div class="gantt-scroll">
        <div class="gantt-grid" id="gantt-interactive-grid" style="grid-template-columns: ${gridCols};">
          ${monthHeaderHTML}
          ${dateHeaderHTML}
          ${rowsHTML}
          ${todayLine}
        </div>
      </div>
    </div>
  `;
}

// ===== List View Builder =====

function _tlBuildListView() {
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const filterProject = AppState.timelineFilterProject;
  const todayISO = _tlDateToISO(new Date());

  const filteredTasks = filterProject ? tasks.filter(t => t.project_id === filterProject) : tasks;

  if (filteredTasks.length === 0) {
    return `
      <div class="card gantt-empty-state">
        <div class="gantt-empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h3 class="gantt-empty-title">No tasks yet</h3>
        <p class="gantt-empty-desc">Create a task to see it in the list.</p>
        <div class="gantt-empty-actions">
          <button class="tl-action-btn tl-action-btn--primary" onclick="openCreateTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Task
          </button>
        </div>
      </div>
    `;
  }

  const rows = filteredTasks.map(task => {
    const project = projects.find(p => p.id === task.project_id);
    const assigneeIds = task.assignee_id ? task.assignee_id.split(',') : [];
    const assigneeNames = assigneeIds.map(id => {
      const m = members.find(mm => mm.id === id);
      return m ? _tlEscape(m.name) : null;
    }).filter(Boolean);
    const statusCls = task.status === 'done' ? 'tl-status-done'
      : task.status === 'in_progress' ? 'tl-status-progress'
      : 'tl-status-planned';
    const isOverdue = task.end_date < todayISO && task.status !== 'done';

    return `
      <tr onclick="openEditTaskModal('${task.id}')" style="cursor: pointer;" class="${isOverdue ? 'tl-list-row--overdue' : ''}">
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${project ? `<span class="tl-project-dot" style="background: ${project.color};"></span>` : ''}
            ${_tlEscape(task.title)}
            ${isOverdue ? '<span class="tl-overdue-badge">OVERDUE</span>' : ''}
          </div>
        </td>
        <td>${project ? _tlEscape(project.name) : '-'}</td>
        <td>${assigneeNames.length > 0 ? assigneeNames.join(', ') : '-'}</td>
        <td>${task.start_date}</td>
        <td>${task.end_date}</td>
        <td>${task.hours_per_week}h/wk</td>
        <td><span class="tl-status-pill ${statusCls}">${_tlEscape(task.status)}</span></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="gantt-container">
      <div class="gantt-scroll">
        <table class="tl-list-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Assignee</th>
              <th>Start</th>
              <th>End</th>
              <th>Effort</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ===============================================
// INTERACTIVE GANTT - Drag, Resize, Create
// ===============================================

let _tlDrag = null;     // Active drag/resize state
let _tlNaming = false;  // True when inline name input is active (blocks re-render)

function _tlAttachHandlers() {
  const grid = document.getElementById('gantt-interactive-grid');
  if (!grid) return;
  grid.addEventListener('mousedown', _tlGridMouseDown);

  // Attach toolbar drag block
  const dragBlock = document.getElementById('tl-task-drag-block');
  if (dragBlock) {
    dragBlock.addEventListener('mousedown', _tlToolbarDragStart);
  }
}

function _tlGridMouseDown(e) {
  if (_tlNaming) return;

  // 1. Resize handle
  const handle = e.target.closest('.gantt-resize-handle');
  if (handle) {
    e.preventDefault();
    e.stopPropagation();
    _tlStartResize(e, handle);
    return;
  }

  // 2. Task bar (move)
  const bar = e.target.closest('.gantt-task-bar:not(.gantt-bar-ghost)');
  if (bar && bar.dataset.taskId) {
    e.preventDefault();
    e.stopPropagation();
    _tlStartMove(e, bar);
    return;
  }

  // 3. Add-cell or empty cell (create by drawing)
  const cell = e.target.closest('.gantt-add-cell, .gantt-cell[data-project-id], .gantt-project-cell[data-project-id]');
  if (cell && cell.dataset.colIdx !== undefined && cell.dataset.projectId) {
    if (e.target.closest('.gantt-task-bar')) return;
    e.preventDefault();
    _tlStartCreate(e, cell);
    return;
  }
}

// --- Toolbar Drag-to-Create ---

function _tlToolbarDragStart(e) {
  if (_tlNaming) return;
  e.preventDefault();

  const grid = document.getElementById('gantt-interactive-grid');
  if (!grid) return;

  // Create a floating ghost that follows the cursor
  const ghost = document.createElement('div');
  ghost.className = 'gantt-task-bar gantt-bar-ghost gantt-bar-floating';
  ghost.style.position = 'fixed';
  ghost.style.width = '120px';
  ghost.style.left = (e.clientX - 60) + 'px';
  ghost.style.top = (e.clientY - 14) + 'px';
  ghost.style.background = '#14b8a6';
  ghost.style.opacity = '0.85';
  ghost.style.zIndex = '9999';
  ghost.style.pointerEvents = 'none';
  ghost.innerHTML = '<span class="gantt-bar-label" style="opacity: 0.8;">New Task</span>';
  document.body.appendChild(ghost);

  _tlDrag = {
    type: 'toolbar-drag',
    grid,
    ghost,
    placed: false,
    projectId: null,
    projectColor: '#14b8a6',
    gridRow: 0,
    startCol: -1,
    currentCol: -1
  };

  document.addEventListener('mousemove', _tlToolbarDragMove);
  document.addEventListener('mouseup', _tlToolbarDragEnd);
}

function _tlToolbarDragMove(e) {
  if (!_tlDrag || _tlDrag.type !== 'toolbar-drag') return;

  const ghost = _tlDrag.ghost;
  const grid = _tlDrag.grid;

  // Check if hovering over the grid
  const target = _tlGetDropTarget(e.clientX, e.clientY);

  if (target && target.projectId) {
    // Snap into the grid
    if (!_tlDrag.placed) {
      // Transition from floating to grid-placed
      _tlDrag.placed = true;
      ghost.style.position = '';
      ghost.style.left = '';
      ghost.style.top = '';
      ghost.style.width = '';
      ghost.classList.remove('gantt-bar-floating');
      document.body.removeChild(ghost);
      grid.appendChild(ghost);
    }

    _tlDrag.projectId = target.projectId;
    _tlDrag.projectColor = target.projectColor || '#14b8a6';
    _tlDrag.gridRow = target.gridRow;
    ghost.style.background = _tlDrag.projectColor;
    ghost.style.gridRow = target.gridRow;

    const colIdx = target.colIdx;
    if (_tlDrag.startCol < 0) {
      _tlDrag.startCol = colIdx;
    }
    _tlDrag.currentCol = colIdx;
    const minCol = Math.min(_tlDrag.startCol, colIdx);
    const maxCol = Math.max(_tlDrag.startCol, colIdx);
    ghost.style.gridColumn = `${minCol + 2} / ${maxCol + 3}`;
  } else {
    // Still floating outside the grid
    if (_tlDrag.placed) {
      // Move back to floating
      _tlDrag.placed = false;
      _tlDrag.startCol = -1;
      _tlDrag.currentCol = -1;
      if (ghost.parentElement === grid) grid.removeChild(ghost);
      ghost.classList.add('gantt-bar-floating');
      ghost.style.position = 'fixed';
      ghost.style.width = '120px';
      ghost.style.gridRow = '';
      ghost.style.gridColumn = '';
      document.body.appendChild(ghost);
    }
    ghost.style.left = (e.clientX - 60) + 'px';
    ghost.style.top = (e.clientY - 14) + 'px';
  }
}

function _tlToolbarDragEnd(e) {
  document.removeEventListener('mousemove', _tlToolbarDragMove);
  document.removeEventListener('mouseup', _tlToolbarDragEnd);

  if (!_tlDrag || _tlDrag.type !== 'toolbar-drag') return;

  const { ghost, placed, startCol, currentCol, projectId, grid } = _tlDrag;

  if (!placed || startCol < 0 || !projectId) {
    // Dropped outside the grid - cancel
    ghost.remove();
    _tlDrag = null;
    return;
  }

  // Successfully placed on grid - reuse the same finish-create flow
  _tlDrag.type = 'create';
  _tlFinishCreate();
}

// --- Create by Drawing ---

function _tlStartCreate(e, cell) {
  const grid = document.getElementById('gantt-interactive-grid');
  if (!grid) return;

  const colIdx = parseInt(cell.dataset.colIdx);
  const projectId = cell.dataset.projectId;
  const projectColor = cell.dataset.projectColor || '#14b8a6';
  const gridRow = parseInt(cell.dataset.gridRow);

  // Create ghost bar in the grid
  const ghost = document.createElement('div');
  ghost.className = 'gantt-task-bar gantt-bar-ghost';
  ghost.style.gridRow = gridRow;
  ghost.style.gridColumn = `${colIdx + 2} / ${colIdx + 3}`;
  ghost.style.background = projectColor;
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity = '0.7';
  ghost.style.zIndex = '20';
  ghost.innerHTML = '<span class="gantt-bar-label" style="opacity: 0.8;">New Task</span>';
  grid.appendChild(ghost);

  _tlDrag = {
    type: 'create',
    grid,
    ghost,
    projectId,
    projectColor,
    gridRow,
    startCol: colIdx,
    currentCol: colIdx
  };

  document.addEventListener('mousemove', _tlDragMove);
  document.addEventListener('mouseup', _tlDragEnd);
}

function _tlDragMove(e) {
  if (!_tlDrag) return;

  if (_tlDrag.type === 'create') {
    const colIdx = _tlGetColFromX(e.clientX, _tlDrag.grid);
    if (colIdx < 0) return;

    // Check if mouse is over a different project row -> change color
    const target = _tlGetDropTarget(e.clientX, e.clientY);
    if (target && target.projectId && target.projectId !== _tlDrag.projectId) {
      _tlDrag.projectId = target.projectId;
      _tlDrag.projectColor = target.projectColor || _tlDrag.projectColor;
      _tlDrag.ghost.style.background = _tlDrag.projectColor;
      _tlDrag.gridRow = target.gridRow || _tlDrag.gridRow;
      _tlDrag.ghost.style.gridRow = _tlDrag.gridRow;
    }

    _tlDrag.currentCol = colIdx;
    const minCol = Math.min(_tlDrag.startCol, colIdx);
    const maxCol = Math.max(_tlDrag.startCol, colIdx);
    _tlDrag.ghost.style.gridColumn = `${minCol + 2} / ${maxCol + 3}`;
    return;
  }

  if (_tlDrag.type === 'resize') {
    const colIdx = _tlGetColFromX(e.clientX, _tlDrag.grid);
    if (colIdx < 0) return;

    if (_tlDrag.edge === 'right') {
      const endCol = Math.max(colIdx, _tlDrag.originalStartCol);
      _tlDrag.bar.style.gridColumn = `${_tlDrag.originalStartCol + 2} / ${endCol + 3}`;
      _tlDrag.newEndCol = endCol;
    } else {
      const startCol = Math.min(colIdx, _tlDrag.originalEndCol);
      _tlDrag.bar.style.gridColumn = `${startCol + 2} / ${_tlDrag.originalEndCol + 3}`;
      _tlDrag.newStartCol = startCol;
    }
    return;
  }

  if (_tlDrag.type === 'move') {
    const colIdx = _tlGetColFromX(e.clientX, _tlDrag.grid);
    if (colIdx < 0) return;

    const offset = colIdx - _tlDrag.grabCol;
    const newStart = Math.max(0, _tlDrag.originalStartCol + offset);
    const barWidth = _tlDrag.originalEndCol - _tlDrag.originalStartCol;
    const columns = _ganttGetColumns();
    const newEnd = Math.min(newStart + barWidth, columns.length - 1);

    _tlDrag.bar.style.gridColumn = `${newStart + 2} / ${newEnd + 3}`;
    _tlDrag.newStartCol = newStart;
    _tlDrag.newEndCol = newEnd;

    // Check for project change
    const target = _tlGetDropTarget(e.clientX, e.clientY);
    if (target && target.projectId && target.projectId !== '__orphan') {
      _tlDrag.newProjectId = target.projectId;
      _tlDrag.bar.style.background = target.projectColor || _tlDrag.originalColor;
      _tlDrag.bar.style.gridRow = target.gridRow || _tlDrag.gridRow;
    }
    return;
  }
}

function _tlDragEnd(e) {
  document.removeEventListener('mousemove', _tlDragMove);
  document.removeEventListener('mouseup', _tlDragEnd);

  if (!_tlDrag) return;

  if (_tlDrag.type === 'create') {
    _tlFinishCreate();
    return;
  }

  if (_tlDrag.type === 'resize') {
    _tlFinishResize();
    return;
  }

  if (_tlDrag.type === 'move') {
    _tlFinishMove();
    return;
  }

  _tlDrag = null;
}

function _tlFinishCreate() {
  const { ghost, startCol, currentCol, projectId, projectColor, gridRow, grid } = _tlDrag;

  const minCol = Math.min(startCol, currentCol);
  const maxCol = Math.max(startCol, currentCol);

  ghost.style.gridColumn = `${minCol + 2} / ${maxCol + 3}`;
  ghost.style.opacity = '0.9';
  ghost.style.pointerEvents = 'auto';
  ghost.style.cursor = 'default';

  // Replace label with name input - add naming team for larger size
  ghost.classList.add('gantt-bar-naming');
  ghost.innerHTML = `<input class="gantt-bar-name-input" type="text" placeholder="Task name..." autofocus>`;

  const input = ghost.querySelector('.gantt-bar-name-input');
  _tlNaming = true;

  const columns = _ganttGetColumns();
  const startDate = columns[minCol] ? _tlDateToISO(columns[minCol].start) : _tlDateToISO(new Date());
  const endDate = columns[maxCol] ? _tlDateToISO(columns[maxCol].end) : startDate;
  // For end_date, use just the date part (YYYY-MM-DD)
  const endDateISO = columns[maxCol] ? _tlDateToISO(columns[maxCol].start) : startDate;

  let submitted = false;

  const submit = async () => {
    if (submitted) return;
    submitted = true;
    const title = input.value.trim() || 'Untitled Task';
    _tlNaming = false;
    ghost.remove();
    _tlDrag = null;

    try {
      const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks?user_uuid=${AppState.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          project_id: projectId,
          start_date: startDate,
          end_date: endDateISO,
          hours_per_week: 8,
          status: _tlAutoStatus(startDate, endDateISO)
        })
      });
      if (!resp.ok) throw new Error('Failed to create task');
      showNotification('Task created: ' + title, 'success');
      await timelineRefreshData();
      renderTimeline();
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
      renderTimeline();
    }
  };

  const cancel = () => {
    if (submitted) return;
    submitted = true;
    _tlNaming = false;
    ghost.remove();
    _tlDrag = null;
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!submitted && _tlNaming) submit();
    }, 150);
  });

  setTimeout(() => input.focus(), 10);
  _tlDrag = null;
}

// --- Resize ---

function _tlStartResize(e, handle) {
  const grid = document.getElementById('gantt-interactive-grid');
  if (!grid) return;

  const taskId = handle.dataset.taskId;
  const edge = handle.dataset.edge;
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  const bar = handle.closest('.gantt-task-bar');
  const columns = _ganttGetColumns();
  const span = _ganttTaskSpan(task, columns);

  bar.style.transition = 'none';
  bar.style.zIndex = '20';
  bar.style.marginLeft = '0';
  bar.style.marginRight = '0';

  _tlDrag = {
    type: 'resize',
    grid,
    taskId,
    edge,
    bar,
    columns,
    originalStartCol: span.startCol,
    originalEndCol: span.endCol,
    newStartCol: span.startCol,
    newEndCol: span.endCol
  };

  document.addEventListener('mousemove', _tlDragMove);
  document.addEventListener('mouseup', _tlDragEnd);
}

function _tlFinishResize() {
  const { taskId, edge, originalStartCol, originalEndCol, columns, newStartCol, newEndCol, bar } = _tlDrag;

  bar.style.transition = '';
  bar.style.zIndex = '';

  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) { _tlDrag = null; return; }

  let startDate = task.start_date;
  let endDate = task.end_date;
  let changed = false;

  if (edge === 'right' && newEndCol !== originalEndCol) {
    endDate = _tlDateToISO(columns[newEndCol].start);
    changed = true;
  }
  if (edge === 'left' && newStartCol !== originalStartCol) {
    startDate = _tlDateToISO(columns[newStartCol].start);
    changed = true;
  }

  _tlDrag = null;

  if (changed) {
    _tlUpdateTaskDates(taskId, startDate, endDate);
  } else {
    renderTimeline();
  }
}

// --- Move ---

function _tlStartMove(e, bar) {
  const grid = document.getElementById('gantt-interactive-grid');
  if (!grid) return;

  const taskId = bar.dataset.taskId;
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  const columns = _ganttGetColumns();
  const span = _ganttTaskSpan(task, columns);
  const grabCol = _tlGetColFromX(e.clientX, grid);
  const project = (AppState.timelineProjects || []).find(p => p.id === task.project_id);

  bar.style.transition = 'none';
  bar.style.zIndex = '20';
  bar.style.opacity = '0.85';
  bar.style.marginLeft = '0';
  bar.style.marginRight = '0';

  _tlDrag = {
    type: 'move',
    grid,
    taskId,
    bar,
    columns,
    grabCol,
    originalStartCol: span.startCol,
    originalEndCol: span.endCol,
    originalColor: project ? project.color : '#14b8a6',
    originalProjectId: task.project_id,
    gridRow: parseInt(bar.style.gridRow) || 0,
    newStartCol: span.startCol,
    newEndCol: span.endCol,
    newProjectId: null
  };

  document.addEventListener('mousemove', _tlDragMove);
  document.addEventListener('mouseup', _tlDragEnd);
}

function _tlFinishMove() {
  const { taskId, originalStartCol, originalEndCol, columns, newStartCol, newEndCol, bar, newProjectId, originalProjectId } = _tlDrag;

  bar.style.transition = '';
  bar.style.zIndex = '';
  bar.style.opacity = '';

  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) { _tlDrag = null; return; }

  let startDate = task.start_date;
  let endDate = task.end_date;
  let projectId = task.project_id;
  let changed = false;

  if (newStartCol !== undefined && newStartCol !== originalStartCol) {
    startDate = _tlDateToISO(columns[newStartCol].start);
    changed = true;
  }
  if (newEndCol !== undefined && newEndCol !== originalEndCol) {
    endDate = _tlDateToISO(columns[newEndCol].start);
    changed = true;
  }
  if (newProjectId && newProjectId !== originalProjectId) {
    projectId = newProjectId;
    changed = true;
  }

  _tlDrag = null;

  if (changed) {
    _tlUpdateTask(taskId, { start_date: startDate, end_date: endDate, project_id: projectId });
  } else {
    // No change - treat as a click: open edit modal
    openEditTaskModal(taskId);
  }
}

// --- Helpers ---

function _tlGetColFromX(clientX, grid) {
  if (!grid) return -1;
  const rect = grid.getBoundingClientRect();
  const x = clientX - rect.left;
  const zoom = AppState.timelineZoom || 'week';
  const colWidth = zoom === 'day' ? 36 : zoom === 'month' ? 110 : 80;
  const sidebarWidth = 280;
  const columns = _ganttGetColumns();
  const col = Math.floor((x - sidebarWidth) / colWidth);
  return Math.max(0, Math.min(col, columns.length - 1));
}

function _tlGetDropTarget(clientX, clientY) {
  // Temporarily hide all ghosts to find the cell underneath
  const ghosts = document.querySelectorAll('.gantt-bar-ghost');
  ghosts.forEach(g => g.style.display = 'none');

  const el = document.elementFromPoint(clientX, clientY);

  ghosts.forEach(g => g.style.display = '');

  if (!el) return null;
  const cell = el.closest('[data-project-id][data-col-idx]');
  if (!cell) return null;

  return {
    colIdx: parseInt(cell.dataset.colIdx),
    projectId: cell.dataset.projectId,
    projectColor: cell.dataset.projectColor || '#14b8a6',
    gridRow: parseInt(cell.dataset.gridRow) || 0
  };
}

async function _tlUpdateTaskDates(taskId, startDate, endDate) {
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description || '',
        project_id: task.project_id,
        assignee_id: task.assignee_id,
        start_date: startDate,
        end_date: endDate,
        hours_per_week: task.hours_per_week,
        status: task.status
      })
    });
    if (!resp.ok) throw new Error('Failed to update task');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
    renderTimeline();
  }
}

async function _tlUpdateTask(taskId, updates) {
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description || '',
        project_id: updates.project_id || task.project_id,
        assignee_id: task.assignee_id,
        start_date: updates.start_date || task.start_date,
        end_date: updates.end_date || task.end_date,
        hours_per_week: task.hours_per_week,
        status: task.status
      })
    });
    if (!resp.ok) throw new Error('Failed to update task');

    if (updates.project_id && updates.project_id !== task.project_id) {
      const newProj = (AppState.timelineProjects || []).find(p => p.id === updates.project_id);
      showNotification(`Moved to ${newProj ? newProj.name : 'new project'}`, 'success');
    }

    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
    renderTimeline();
  }
}

// ===== Main Render =====

function renderTimeline() {
  if (_tlNaming) return; // Don't re-render during inline naming

  const content = document.getElementById('content');
  if (!content) return;

  if (!AppState._timelineInitialLoad) {
    AppState._timelineInitialLoad = true;
    timelineRefreshData().then(() => renderTimeline());
    content.innerHTML = `
      <div class="animate-slide-up" style="padding: 48px; text-align: center;">
        <p style="color: var(--text-muted);">Loading timeline data...</p>
      </div>
    `;
    return;
  }

  if (AppState.timelineSelectedProject) {
    _tlRenderDetailView(content);
  } else {
    _tlRenderProjectIndex(content);
  }
}

// ===== Project Index Page =====

function _tlRenderProjectIndex(content) {
  const workspaces = AppState.timelineWorkspaces || [];
  const projects = AppState.timelineProjects || [];
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const search = (AppState.timelineProjectSearch || '').toLowerCase();
  const viewMode = AppState.timelineProjectViewMode || 'grid';

  const titleEl = document.getElementById('view-title');
  const subEl = document.getElementById('view-subtitle');
  if (titleEl) titleEl.textContent = 'Workspaces';
  if (subEl) subEl.textContent = 'Browse and manage your workspaces and task plans.';

  const filtered = search
    ? workspaces.filter(ws => ws.name.toLowerCase().includes(search) || (ws.description || '').toLowerCase().includes(search))
    : workspaces;

  const cardsHTML = filtered.map(ws => {
    const wsTasks = projects.filter(p => p.workspace_id === ws.id);
    const taskCount = wsTasks.length;
    const taskIds = wsTasks.map(p => p.id);
    const allSubtasks = tasks.filter(t => taskIds.includes(t.project_id));
    const subtaskCount = allSubtasks.length;

    let dateRange = 'No tasks yet';
    let durationWeeks = 0;
    if (allSubtasks.length > 0) {
      let minStart = allSubtasks[0].start_date;
      let maxEnd = allSubtasks[0].end_date;
      for (const t of allSubtasks) {
        if (t.start_date < minStart) minStart = t.start_date;
        if (t.end_date > maxEnd) maxEnd = t.end_date;
      }
      const s = _tlParseDate(minStart);
      const e = _tlParseDate(maxEnd);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dateRange = `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      durationWeeks = Math.max(1, Math.round((e - s) / (7 * 24 * 60 * 60 * 1000)));
    }

    const assigneeIds = [...new Set(allSubtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
    const assignees = assigneeIds.map(id => members.find(m => m.id === id)).filter(Boolean);

    let statusColor = '#5a6480';
    let statusLabel = 'Empty';
    if (allSubtasks.length > 0) {
      const doneCount = allSubtasks.filter(t => t.status === 'done').length;
      const inProgressCount = allSubtasks.filter(t => t.status === 'in_progress').length;
      if (doneCount === allSubtasks.length) {
        statusColor = '#10b981'; statusLabel = 'Completed';
      } else if (inProgressCount > 0 || doneCount > 0) {
        statusColor = '#3b82f6'; statusLabel = 'In Progress';
      } else {
        statusColor = '#f59e0b'; statusLabel = 'Planned';
      }
    }

    const progress = allSubtasks.length > 0
      ? Math.round((allSubtasks.filter(t => t.status === 'done').length / allSubtasks.length) * 100)
      : 0;

    const maxAvatars = 4;
    const visibleAssignees = assignees.slice(0, maxAvatars);
    const extraCount = assignees.length - maxAvatars;
    const avatarStackHTML = visibleAssignees.map((m, i) => `
      <div class="pi-avatar" style="z-index: ${maxAvatars - i}; border-color: ${ws.color};" title="${_tlEscape(m.name)}">
        ${_tlEscape(m.avatar_initials || '??')}
      </div>
    `).join('') + (extraCount > 0 ? `<div class="pi-avatar pi-avatar-extra" style="z-index: 0;">+${extraCount}</div>` : '');

    const desc = ws.description || '';
    const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;

    if (viewMode === 'list') {
      return `
        <div class="pi-list-row" onclick="_tlOpenProject('${ws.id}')">
          <div class="pi-list-color" style="background: ${ws.color};"></div>
          <div class="pi-list-info">
            <div class="pi-list-name">${_tlEscape(ws.name)}</div>
            <div class="pi-list-meta">${dateRange}${desc ? ' \u00b7 ' + _tlEscape(shortDesc) : ''}</div>
          </div>
          <div class="pi-list-status">
            <span class="pi-status-dot" style="background: ${statusColor};"></span>
            <span class="pi-status-text">${statusLabel}</span>
          </div>
          <div class="pi-list-people">
            <div class="pi-avatar-stack pi-avatar-stack--sm">${avatarStackHTML}</div>
          </div>
          <div class="pi-list-tasks">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            <span>${taskCount} project${taskCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="pi-list-duration">
            ${durationWeeks > 0 ? `${durationWeeks} wk${durationWeeks !== 1 ? 's' : ''}` : '\u2014'}
          </div>
          <div class="pi-list-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      `;
    }

    return `
      <div class="pi-card" onclick="_tlOpenProject('${ws.id}')">
        <div class="pi-card-header">
          <div class="pi-card-color-bar" style="background: ${ws.color};"></div>
          <div class="pi-card-top">
            <div class="pi-card-status">
              <span class="pi-status-dot" style="background: ${statusColor};"></span>
              <span class="pi-status-text">${statusLabel}</span>
            </div>
            <button class="pi-card-menu" onclick="event.stopPropagation(); _tlShowProjectMenu('${ws.id}', event)" title="Options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
          </div>
        </div>
        <div class="pi-card-body">
          <h3 class="pi-card-title">${_tlEscape(ws.name)}</h3>
          ${desc ? `<p class="pi-card-desc">${_tlEscape(shortDesc)}</p>` : ''}
          <div class="pi-card-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>${dateRange}</span>
          </div>
          ${allSubtasks.length > 0 ? `
          <div class="pi-card-progress">
            <div class="pi-progress-bar">
              <div class="pi-progress-fill" style="width: ${progress}%; background: ${ws.color};"></div>
            </div>
            <span class="pi-progress-label">${progress}%</span>
          </div>
          ` : ''}
        </div>
        <div class="pi-card-footer">
          <div class="pi-avatar-stack">${avatarStackHTML}</div>
          <div class="pi-card-stats">
            <div class="pi-card-task-count" title="Projects">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 16h4"/></svg>
              ${taskCount}
            </div>
            <div class="pi-card-task-count" title="Tasks">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              ${subtaskCount}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const emptyStateHTML = workspaces.length === 0 ? `
    <div class="pi-empty-state">
      <div class="pi-empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <h3 class="pi-empty-title">No workspaces yet</h3>
      <p class="pi-empty-desc">Create your first workspace to start planning your work schedule</p>
      <button class="pi-btn-create-large" onclick="openNewProjectModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create First Workspace
      </button>
    </div>
  ` : (filtered.length === 0 ? `
    <div class="pi-empty-state pi-empty-state--search">
      <div class="pi-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <h3 class="pi-empty-title">No matching workspaces</h3>
      <p class="pi-empty-desc">Try a different search term</p>
    </div>
  ` : '');

  const gridActive = viewMode === 'grid' ? 'active' : '';
  const listActive = viewMode === 'list' ? 'active' : '';

  content.innerHTML = `
    <div class="pi-page animate-slide-up">
      <div class="pi-header">
        <div class="pi-header-left">
          <div class="pi-search-wrap">
            <svg class="pi-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="pi-search" placeholder="Search workspaces..." value="${_tlEscape(AppState.timelineProjectSearch || '')}" oninput="_tlProjectSearch(this.value)">
          </div>
          <div class="pi-view-toggle">
            <button class="pi-view-btn ${gridActive}" onclick="_tlSetProjectViewMode('grid')" title="Grid view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
            <button class="pi-view-btn ${listActive}" onclick="_tlSetProjectViewMode('list')" title="List view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
        <div class="pi-header-right">
          <span class="pi-project-count">${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}</span>
          <button class="pi-btn-new" onclick="openNewProjectModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Workspace
          </button>
        </div>
      </div>

      ${workspaces.length === 0 || filtered.length === 0 ? emptyStateHTML : `
        <div class="pi-${viewMode === 'list' ? 'list' : 'grid'}">
          ${cardsHTML}
        </div>
      `}
    </div>
  `;
}

// ===== Project Index Helpers =====

function _tlOpenProject(workspaceId) {
  AppState.timelineSelectedProject = workspaceId;
  AppState.timelineFilterProject = '';
  renderTimeline();
}

function _tlBackToProjects() {
  AppState.timelineSelectedProject = null;
  AppState.timelineFilterProject = '';
  renderTimeline();
}

function _tlProjectSearch(value) {
  AppState.timelineProjectSearch = value;
  renderTimeline();
}

function _tlSetProjectViewMode(mode) {
  AppState.timelineProjectViewMode = mode;
  renderTimeline();
}

function _tlShowProjectMenu(workspaceId, event) {
  const existing = document.getElementById('pi-context-menu');
  if (existing) existing.remove();

  const ws = (AppState.timelineWorkspaces || []).find(w => w.id === workspaceId);
  if (!ws) return;

  const menu = document.createElement('div');
  menu.id = 'pi-context-menu';
  menu.className = 'pi-context-menu';
  menu.innerHTML = `
    <button class="pi-context-item" onclick="_tlOpenProject('${workspaceId}'); document.getElementById('pi-context-menu')?.remove();">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Open Planner
    </button>
    <button class="pi-context-item" onclick="_tlEditProjectFromIndex('${workspaceId}'); document.getElementById('pi-context-menu')?.remove();">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit Workspace
    </button>
    <div class="pi-context-divider"></div>
    <button class="pi-context-item pi-context-item--danger" onclick="_tlDeleteProject('${workspaceId}'); document.getElementById('pi-context-menu')?.remove();">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      Delete Workspace
    </button>
  `;

  const rect = event.target.closest('.pi-card-menu').getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  menu.style.zIndex = '9999';

  document.body.appendChild(menu);

  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 10);
}

function _tlEditProjectFromIndex(workspaceId) {
  const ws = (AppState.timelineWorkspaces || []).find(w => w.id === workspaceId);
  if (!ws) return;

  const colorSwatches = TL_COLORS.map((c, i) =>
    `<label class="tl-color-swatch" style="background: ${c};">
      <input type="radio" name="tl-edit-project-color" value="${c}" ${c === ws.color ? 'checked' : ''} style="display:none;">
      <span class="tl-swatch-check">&#10003;</span>
    </label>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Workspace Name</label>
      <input type="text" id="tl-edit-proj-name" class="form-input" value="${_tlEscape(ws.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="tl-edit-proj-desc" class="form-input" rows="3" placeholder="What is this workspace about?">${_tlEscape(ws.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="tl-color-palette">${colorSwatches}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_tlSubmitEditProject('${ws.id}')">Save Changes</button>
  `;

  _tlShowModal(_tlModalShell('Edit Workspace', body, footer));
}

async function _tlSubmitEditProject(workspaceId) {
  const name = document.getElementById('tl-edit-proj-name')?.value?.trim();
  const description = document.getElementById('tl-edit-proj-desc')?.value?.trim() || '';
  const colorInput = document.querySelector('input[name="tl-edit-project-color"]:checked');
  const color = colorInput ? colorInput.value : '#14b8a6';

  if (!name) {
    showNotification('Please enter a workspace name', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/workspaces/${workspaceId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    if (!resp.ok) throw new Error('Failed to update workspace');
    closeTimelineModal();
    showNotification('Workspace updated', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function _tlDeleteProject(workspaceId) {
  const ws = (AppState.timelineWorkspaces || []).find(w => w.id === workspaceId);
  if (!ws) return;

  const wsTasks = (AppState.timelineProjects || []).filter(p => p.workspace_id === workspaceId);
  const taskCount = wsTasks.length;
  const msg = taskCount > 0
    ? `Delete "${ws.name}" and its ${taskCount} project${taskCount > 1 ? 's' : ''} (plus all tasks)? This cannot be undone.`
    : `Delete "${ws.name}"? This cannot be undone.`;

  if (!confirm(msg)) return;

  try {
    for (const proj of wsTasks) {
      const subtasks = (AppState.timelineTasks || []).filter(t => t.project_id === proj.id);
      for (const st of subtasks) {
        await fetch(`${AppState.authenticationUrl}/timeline-tasks/${st.id}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
      }
      await fetch(`${AppState.authenticationUrl}/projects/${proj.id}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    }

    const resp = await fetch(`${AppState.authenticationUrl}/workspaces/${workspaceId}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete workspace');
    showNotification('Workspace deleted', 'success');

    if (AppState.timelineSelectedProject === workspaceId) {
      AppState.timelineSelectedProject = null;
      AppState.timelineFilterProject = '';
    }

    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== New Workspace Modal =====

function openNewProjectModal() {
  const colorSwatches = TL_COLORS.map((c, i) =>
    `<label class="tl-color-swatch" style="background: ${c};">
      <input type="radio" name="tl-new-project-color" value="${c}" ${i === 0 ? 'checked' : ''} style="display:none;">
      <span class="tl-swatch-check">&#10003;</span>
    </label>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Workspace Name</label>
      <input type="text" id="tl-new-proj-name" class="form-input" placeholder="e.g. Year 10 Mathematics">
    </div>
    <div class="form-group">
      <label class="form-label">Description <span style="color: var(--text-muted); font-weight: 400;">(optional)</span></label>
      <textarea id="tl-new-proj-desc" class="form-input" rows="3" placeholder="What is this workspace about?"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="tl-color-palette">${colorSwatches}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_tlSubmitNewProject()">Create Workspace</button>
  `;

  _tlShowModal(_tlModalShell('New Workspace', body, footer));
}

async function _tlSubmitNewProject() {
  const name = document.getElementById('tl-new-proj-name')?.value?.trim();
  const description = document.getElementById('tl-new-proj-desc')?.value?.trim() || '';
  const colorInput = document.querySelector('input[name="tl-new-project-color"]:checked');
  const color = colorInput ? colorInput.value : '#14b8a6';

  if (!name) {
    showNotification('Please enter a project name', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/workspaces?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    if (!resp.ok) throw new Error('Failed to create workspace');
    closeTimelineModal();
    showNotification('Workspace created', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Detail Gantt View =====

function _tlRenderDetailView(content) {
  const workspaceId = AppState.timelineSelectedProject;
  const workspace = (AppState.timelineWorkspaces || []).find(w => w.id === workspaceId);
  const projectName = workspace ? workspace.name : 'Project';

  const titleEl = document.getElementById('view-title');
  const subEl = document.getElementById('view-subtitle');
  if (titleEl) titleEl.textContent = projectName;
  if (subEl) subEl.textContent = workspace?.description || 'Plan and manage your tasks.';

  const allProjects = AppState.timelineProjects || [];
  const allTasks = AppState.timelineTasks || [];
  const scopedProjects = allProjects.filter(p => p.workspace_id === workspaceId);
  const scopedProjectIds = new Set(scopedProjects.map(p => p.id));
  const scopedTasks = allTasks.filter(t => scopedProjectIds.has(t.project_id));

  // Temporarily scope data for builders
  const origProjects = AppState.timelineProjects;
  const origTasks = AppState.timelineTasks;
  AppState.timelineProjects = scopedProjects;
  AppState.timelineTasks = scopedTasks;

  const viewMode = AppState.timelineViewMode || 'timeline';
  const toolbar = _tlBuildToolbar();
  let body;
  if (viewMode === 'list') {
    body = _tlBuildListView();
  } else {
    body = _ganttBuildChart();
  }

  // Restore original data
  AppState.timelineProjects = origProjects;
  AppState.timelineTasks = origTasks;

  const backBtn = `
    <button class="pi-back-btn" onclick="_tlBackToProjects()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      <span>All Workspaces</span>
    </button>
  `;

  content.innerHTML = `
    <div class="animate-slide-up" style="display: flex; flex-direction: column; gap: 16px;">
      ${backBtn}
      ${toolbar}
      ${body}
    </div>
  `;

  // Attach interactive handlers for drag-to-create, resize, move
  if (viewMode === 'timeline') {
    requestAnimationFrame(() => _tlAttachHandlers());
  }
}

// ===== Tooltip =====

function showTaskTooltip(event, taskId) {
  hideTaskTooltip();
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;
  const project = (AppState.timelineProjects || []).find(p => p.id === task.project_id);
  const assigneeIds = task.assignee_id ? task.assignee_id.split(',') : [];
  const assigneeNames = assigneeIds.map(id => {
    const m = (AppState.timelineTeamMembers || []).find(mm => mm.id === id);
    return m ? _tlEscape(m.name) : null;
  }).filter(Boolean);

  const tooltip = document.createElement('div');
  tooltip.id = 'tl-tooltip';
  tooltip.className = 'tl-tooltip';
  tooltip.innerHTML = `
    <div class="tl-tooltip-title">${_tlEscape(task.title)}</div>
    <div class="tl-tooltip-meta">
      ${project ? `<span style="color: ${project.color};">${_tlEscape(project.name)}</span>` : ''}
      ${assigneeNames.length > 0 ? `<span>${assigneeNames.join(', ')}</span>` : ''}
    </div>
    <div class="tl-tooltip-dates">${task.start_date} &rarr; ${task.end_date}</div>
    <div class="tl-tooltip-hours">${task.hours_per_week}h/week &middot; ${_tlEscape(task.status)}</div>
    ${task.description ? `<div class="tl-tooltip-desc">${_tlEscape(task.description)}</div>` : ''}
  `;

  const x = Math.min(event.pageX + 12, window.innerWidth - 320);
  const y = Math.min(event.pageY - 10, window.innerHeight - 200);
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  document.body.appendChild(tooltip);
}

function hideTaskTooltip() {
  const existing = document.getElementById('tl-tooltip');
  if (existing) existing.remove();
}

// ===== Modal Helpers =====

function closeTimelineModal() {
  const modal = document.getElementById('tl-modal');
  if (modal) modal.remove();
}

function _tlModalShell(title, bodyHTML, footerHTML) {
  return `
    <div class="tl-modal" role="dialog" aria-modal="true">
      <div class="tl-modal-header">
        <h3 style="margin: 0; color: var(--text-primary);">${title}</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeTimelineModal()" style="padding: 4px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="tl-modal-body">${bodyHTML}</div>
      <div class="tl-modal-footer">${footerHTML}</div>
    </div>
  `;
}

function _tlShowModal(html) {
  closeTimelineModal();
  const backdrop = document.createElement('div');
  backdrop.id = 'tl-modal';
  backdrop.className = 'tl-modal-backdrop';
  backdrop.innerHTML = html;

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeTimelineModal();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeTimelineModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(backdrop);
}

// ===== Color Palette =====

const TL_COLORS = [
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#6366f1', '#06b6d4', '#84cc16',
  '#f97316', '#a855f7', '#0ea5e9', '#e11d48', '#22c55e'
];

// ===== Create Project Modal =====

function openCreateProjectModal() {
  const colorSwatches = TL_COLORS.map((c, i) =>
    `<label class="tl-color-swatch" style="background: ${c};">
      <input type="radio" name="tl-project-color" value="${c}" ${i === 0 ? 'checked' : ''} style="display:none;">
      <span class="tl-swatch-check">&#10003;</span>
    </label>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Project Name</label>
      <input type="text" id="tl-proj-name" class="form-input" placeholder="e.g. Algebra Fundamentals">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="tl-color-palette">${colorSwatches}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateProject()">Create Project</button>
  `;

  _tlShowModal(_tlModalShell('New Project', body, footer));
}

async function submitCreateProject() {
  const name = document.getElementById('tl-proj-name')?.value?.trim();
  const colorInput = document.querySelector('input[name="tl-project-color"]:checked');
  const color = colorInput ? colorInput.value : '#14b8a6';

  if (!name) {
    showNotification('Please enter a project name', 'warning');
    return;
  }

  const workspace_id = AppState.timelineSelectedProject || null;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/projects?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, workspace_id })
    });
    if (!resp.ok) throw new Error('Failed to create project');
    closeTimelineModal();
    showNotification('Project created', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Create Worker Modal =====

function openCreateMemberModal() {
  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="tl-member-name" class="form-input" placeholder="e.g. Sarah Johnson">
    </div>
    <div class="form-group">
      <label class="form-label">Year Group / Team</label>
      <input type="text" id="tl-member-role" class="form-input" placeholder="e.g. Year 10, Team 10B">
    </div>
    <div class="form-group">
      <label class="form-label">Weekly Hours</label>
      <input type="number" id="tl-member-capacity" class="form-input" value="25" min="1" max="80">
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateMember()">Add Worker</button>
  `;

  _tlShowModal(_tlModalShell('New Worker', body, footer));
}

async function submitCreateMember() {
  const name = document.getElementById('tl-member-name')?.value?.trim();
  const role = document.getElementById('tl-member-role')?.value?.trim() || '';
  const capacity = parseInt(document.getElementById('tl-member-capacity')?.value) || 40;

  if (!name) {
    showNotification('Please enter a name', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, weekly_capacity_hours: capacity })
    });
    if (!resp.ok) throw new Error('Failed to create worker');
    closeTimelineModal();
    showNotification('Worker added', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Create Task Modal =====

function openCreateTaskModal(prefillProjectId, prefillAssignee) {
  const allProjects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  const workspaceId = AppState.timelineSelectedProject;
  const projects = workspaceId
    ? allProjects.filter(p => p.workspace_id === workspaceId)
    : allProjects;

  if (projects.length === 0) {
    showNotification('Create at least one project first.', 'warning');
    return;
  }

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === prefillProjectId ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const prefillList = prefillAssignee ? prefillAssignee.split(',') : [];
  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const checked = prefillList.includes(m.id) ? 'checked' : '';
    return `<label class="tl-assignee-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="tl-task-assignees" value="${m.id}" ${checked} onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar">${_tlEscape(m.avatar_initials)}</span>
      <span class="tl-assignee-name">${_tlEscape(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No teams yet</span>';

  const today = _tlDateToISO(new Date());
  const nextWeek = _tlDateToISO(_tlAddDays(new Date(), 7));

  const body = `
    <div class="form-group">
      <label class="form-label">Task Name</label>
      <input type="text" id="tl-task-title" class="form-input" placeholder="e.g. Introduction to Quadratics">
    </div>
    <div class="form-group">
      <label class="form-label">Parent Project</label>
      <select id="tl-task-project" class="form-input">${projectOpts}</select>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" id="tl-task-start" class="form-input" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input type="date" id="tl-task-end" class="form-input" value="${nextWeek}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Assigned Teams</label>
      <div class="tl-assignee-grid">${memberCheckboxes}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes <span style="color: var(--text-muted); font-weight: 400;">(optional)</span></label>
      <textarea id="tl-task-desc" class="form-input" rows="3" placeholder="Task objectives, key points..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Files</label>
      <div class="tl-files-list" id="tl-task-files-list"></div>
      <label class="tl-file-add-btn">
        <input type="file" id="tl-task-file-input" multiple hidden onchange="_tlHandleFileSelect(event, 'tl-task-files-list')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        Attach files
      </label>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateTask()">Create Task</button>
  `;

  _tlShowModal(_tlModalShell('New Task', body, footer));
}

async function submitCreateTask() {
  const title = document.getElementById('tl-task-title')?.value?.trim();
  const project_id = document.getElementById('tl-task-project')?.value;
  const checkedBoxes = document.querySelectorAll('input[name="tl-task-assignees"]:checked');
  const assignee_id = Array.from(checkedBoxes).map(cb => cb.value).join(',') || null;
  const start_date = document.getElementById('tl-task-start')?.value;
  const end_date = document.getElementById('tl-task-end')?.value;
  const notes = document.getElementById('tl-task-desc')?.value?.trim() || '';
  const files = _tlGetFilesFromList('tl-task-files-list');

  if (!title || !project_id || !start_date || !end_date) {
    showNotification('Please fill in all required fields', 'warning');
    return;
  }
  if (start_date > end_date) {
    showNotification('End date must be after start date', 'warning');
    return;
  }

  const description = JSON.stringify({ notes, files });
  const status = _tlAutoStatus(start_date, end_date);

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, project_id, assignee_id, start_date, end_date, hours_per_week: 8, status })
    });
    if (!resp.ok) throw new Error('Failed to create task');
    closeTimelineModal();
    showNotification('Task created', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Edit Task Modal =====

function openEditTaskModal(taskId) {
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  const allProjects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  const workspaceId = AppState.timelineSelectedProject;
  const projects = workspaceId
    ? allProjects.filter(p => p.workspace_id === workspaceId)
    : allProjects;

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === task.project_id ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const currentAssignees = task.assignee_id ? task.assignee_id.split(',') : [];
  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const checked = currentAssignees.includes(m.id) ? 'checked' : '';
    return `<label class="tl-assignee-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="tl-edit-assignees" value="${m.id}" ${checked} onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar">${_tlEscape(m.avatar_initials)}</span>
      <span class="tl-assignee-name">${_tlEscape(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No teams yet</span>';

  // Parse description JSON (notes + files)
  let notes = task.description || '';
  let files = [];
  try {
    const parsed = JSON.parse(task.description);
    if (parsed && typeof parsed === 'object') {
      notes = parsed.notes || '';
      files = parsed.files || [];
    }
  } catch (e) { /* plain text description - treat as notes */ }

  // Auto-calculate status
  const autoStatus = _tlAutoStatus(task.start_date, task.end_date);
  const statusLabel = autoStatus === 'in_progress' ? 'In Progress' : autoStatus === 'done' ? 'Done' : 'Planned';
  const statusCls = autoStatus === 'done' ? 'tl-status-done' : autoStatus === 'in_progress' ? 'tl-status-progress' : 'tl-status-planned';

  const existingFilesHTML = files.map((f, i) => `
    <div class="tl-file-item" data-file-path="${_tlEscape(f.path)}" data-file-name="${_tlEscape(f.name)}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="tl-file-name" title="${_tlEscape(f.path)}">${_tlEscape(f.name)}</span>
      <button class="tl-file-open" onclick="_tlOpenFile('${_tlEscape(f.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Open file">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      <button class="tl-file-remove" onclick="this.closest('.tl-file-item').remove()" title="Remove">&times;</button>
    </div>
  `).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Task Name</label>
      <input type="text" id="tl-edit-title" class="form-input" value="${_tlEscape(task.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Parent Project</label>
      <select id="tl-edit-project" class="form-input">${projectOpts}</select>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" id="tl-edit-start" class="form-input" value="${task.start_date}">
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input type="date" id="tl-edit-end" class="form-input" value="${task.end_date}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Assigned Teams</label>
      <div class="tl-assignee-grid">${memberCheckboxes}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <div class="tl-auto-status">
        <span class="tl-status-pill ${statusCls}">${statusLabel}</span>
        <span class="tl-auto-status-hint">Auto-set from dates</span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea id="tl-edit-desc" class="form-input" rows="3" placeholder="Task objectives, key points...">${_tlEscape(notes)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Files</label>
      <div class="tl-files-list" id="tl-edit-files-list">${existingFilesHTML}</div>
      <label class="tl-file-add-btn">
        <input type="file" id="tl-edit-file-input" multiple hidden onchange="_tlHandleFileSelect(event, 'tl-edit-files-list')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        Attach files
      </label>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" onclick="deleteTimelineTask('${task.id}')" style="color: var(--error); margin-right: auto;">Delete</button>
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitEditTask('${task.id}')">Save Changes</button>
  `;

  _tlShowModal(_tlModalShell('Edit Task', body, footer));
}

async function submitEditTask(taskId) {
  const title = document.getElementById('tl-edit-title')?.value?.trim();
  const project_id = document.getElementById('tl-edit-project')?.value;
  const checkedBoxes = document.querySelectorAll('input[name="tl-edit-assignees"]:checked');
  const assignee_id = Array.from(checkedBoxes).map(cb => cb.value).join(',') || null;
  const start_date = document.getElementById('tl-edit-start')?.value;
  const end_date = document.getElementById('tl-edit-end')?.value;
  const notes = document.getElementById('tl-edit-desc')?.value?.trim() || '';
  const files = _tlGetFilesFromList('tl-edit-files-list');

  if (!title || !start_date || !end_date) {
    showNotification('Please fill in all required fields', 'warning');
    return;
  }
  if (start_date > end_date) {
    showNotification('End date must be after start date', 'warning');
    return;
  }

  const description = JSON.stringify({ notes, files });
  const status = _tlAutoStatus(start_date, end_date);

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, project_id, assignee_id, start_date, end_date, hours_per_week: 8, status })
    });
    if (!resp.ok) throw new Error('Failed to update task');
    closeTimelineModal();
    showNotification('Task updated', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function deleteTimelineTask(taskId) {
  if (!confirm('Delete this task?')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete task');
    closeTimelineModal();
    showNotification('Task deleted', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== File Attachment Helpers =====

function _tlHandleFileSelect(event, listId) {
  const fileInput = event.target;
  const list = document.getElementById(listId);
  if (!list || !fileInput.files) return;

  for (const file of fileInput.files) {
    const filePath = file.path || file.name; // Electron gives .path
    const fileName = file.name;

    // Don't add duplicates
    const existing = list.querySelectorAll('.tl-file-item');
    let isDupe = false;
    existing.forEach(el => { if (el.dataset.filePath === filePath) isDupe = true; });
    if (isDupe) continue;

    const item = document.createElement('div');
    item.className = 'tl-file-item';
    item.dataset.filePath = filePath;
    item.dataset.fileName = fileName;
    item.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="tl-file-name" title="${_tlEscape(filePath)}">${_tlEscape(fileName)}</span>
      <button class="tl-file-open" onclick="_tlOpenFile('${_tlEscape(filePath).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Open file">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      <button class="tl-file-remove" onclick="this.closest('.tl-file-item').remove()" title="Remove">&times;</button>
    `;
    list.appendChild(item);
  }

  // Reset input so the same file can be added again if removed
  fileInput.value = '';
}

function _tlGetFilesFromList(listId) {
  const list = document.getElementById(listId);
  if (!list) return [];
  const items = list.querySelectorAll('.tl-file-item');
  return Array.from(items).map(el => ({
    name: el.dataset.fileName || 'file',
    path: el.dataset.filePath || ''
  }));
}

function _tlOpenFile(filePath) {
  try {
    // Use Electron shell to open the file with the default application
    const { shell } = require('electron');
    shell.openPath(filePath);
  } catch (e) {
    // Fallback: try window.open
    window.open('file:///' + filePath.replace(/\\/g, '/'));
  }
}

// ===== Global Exports =====

if (typeof window !== 'undefined') {
  window.renderTimeline = renderTimeline;
  window.timelineRefreshData = timelineRefreshData;
  window.timelineSetZoom = timelineSetZoom;
  window.timelineSetViewMode = timelineSetViewMode;
  window.timelineSetFilterProject = timelineSetFilterProject;
  window.timelineSetFilterPerson = timelineSetFilterPerson;
  window._tlNavigate = _tlNavigate;
  window._tlGoToToday = _tlGoToToday;
  window._ganttToggleGroup = _ganttToggleGroup;
  window.openCreateTaskModal = openCreateTaskModal;
  window.openEditTaskModal = openEditTaskModal;
  window.submitCreateTask = submitCreateTask;
  window.submitEditTask = submitEditTask;
  window.deleteTimelineTask = deleteTimelineTask;
  window.closeTimelineModal = closeTimelineModal;
  window.openCreateProjectModal = openCreateProjectModal;
  window.submitCreateProject = submitCreateProject;
  window.openCreateMemberModal = openCreateMemberModal;
  window.submitCreateMember = submitCreateMember;
  window.showTaskTooltip = showTaskTooltip;
  window.hideTaskTooltip = hideTaskTooltip;

  // Project index exports
  window._tlOpenProject = _tlOpenProject;
  window._tlBackToProjects = _tlBackToProjects;
  window._tlProjectSearch = _tlProjectSearch;
  window._tlSetProjectViewMode = _tlSetProjectViewMode;
  window._tlShowProjectMenu = _tlShowProjectMenu;
  window._tlEditProjectFromIndex = _tlEditProjectFromIndex;
  window._tlSubmitEditProject = _tlSubmitEditProject;
  window._tlDeleteProject = _tlDeleteProject;
  window.openNewProjectModal = openNewProjectModal;
  window._tlSubmitNewProject = _tlSubmitNewProject;

  // File helpers
  window._tlHandleFileSelect = _tlHandleFileSelect;
  window._tlGetFilesFromList = _tlGetFilesFromList;
  window._tlOpenFile = _tlOpenFile;
}
