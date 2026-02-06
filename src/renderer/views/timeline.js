// ============================================
// TIMELINE VIEW - Project Gantt Chart
// Left sidebar: projects + tasks, right: date grid
// with horizontal task bars, today line, zoom
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
    // Show 35 individual days
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
    // Show 12 months
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
    // Week zoom: show 16 weeks
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

// Calculate which columns a task spans
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

// Build month header groupings for day zoom
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

// ===== Data Fetching =====

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

  // Compute sliding pill position for view mode
  const viewModeIndex = viewMode === 'list' ? 1 : 0;
  // Compute sliding pill position for zoom
  const zoomIndex = zoom === 'day' ? 0 : zoom === 'month' ? 2 : 1;

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${AppState.timelineFilterProject === p.id ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.timelineFilterPerson === m.id ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

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

          <div class="tl-separator"></div>

          <div class="tl-pill-group" data-count="3">
            <div class="tl-pill-slider" style="--pill-index: ${zoomIndex}; --pill-count: 3;"></div>
            <button class="tl-pill-btn ${zoom === 'day' ? 'active' : ''}" onclick="timelineSetZoom('day')">Day</button>
            <button class="tl-pill-btn ${zoom === 'week' ? 'active' : ''}" onclick="timelineSetZoom('week')">Week</button>
            <button class="tl-pill-btn ${zoom === 'month' ? 'active' : ''}" onclick="timelineSetZoom('month')">Month</button>
          </div>
        </div>

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
      </div>

      <div class="tl-toolbar-row tl-toolbar-row--bottom">
        <div class="tl-toolbar-section">
          <div class="tl-filter-wrap">
            <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M9 16h4"/></svg>
            <select class="tl-filter-v2" onchange="timelineSetFilterProject(this.value)">
              <option value="">All Tasks</option>
              ${projectOpts}
            </select>
          </div>
          <div class="tl-filter-wrap">
            <svg class="tl-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
            <select class="tl-filter-v2" onchange="timelineSetFilterPerson(this.value)">
              <option value="">All People</option>
              ${memberOpts}
            </select>
          </div>
        </div>

        <div class="tl-toolbar-section tl-toolbar-section--actions">
          <button class="tl-action-btn tl-action-btn--primary" onclick="openCreateTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Sub-task
          </button>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateProjectModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Task
          </button>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Member
          </button>
        </div>
      </div>
    </div>
  `;
}

// ===== Gantt Chart Builder =====

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

  // Build row data: project headers + task rows
  let visibleProjects = projects;
  if (filterProject) {
    visibleProjects = projects.filter(p => p.id === filterProject);
  }

  const rows = []; // { type: 'project'|'task', data, project }
  for (const project of visibleProjects) {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    if (!filterProject && projectTasks.length === 0) continue;
    rows.push({ type: 'project', project, taskCount: projectTasks.length });
    if (!collapsed[project.id]) {
      for (const task of projectTasks) {
        rows.push({ type: 'task', task, project });
      }
    }
  }

  // Catch unassigned tasks (no project)
  const orphanTasks = tasks.filter(t => !projects.find(p => p.id === t.project_id));
  if (orphanTasks.length > 0 && !filterProject) {
    rows.push({ type: 'project', project: { id: '__orphan', name: 'Unassigned', color: '#6b7280' }, taskCount: orphanTasks.length });
    if (!collapsed['__orphan']) {
      for (const task of orphanTasks) {
        rows.push({ type: 'task', task, project: { id: '__orphan', name: 'Unassigned', color: '#6b7280' } });
      }
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
        <p class="gantt-empty-desc">Create a task and add sub-tasks to see them on the Gantt chart.</p>
        <div class="gantt-empty-actions">
          <button class="tl-action-btn tl-action-btn--primary" onclick="openCreateProjectModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Task
          </button>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Add Member
          </button>
        </div>
      </div>
    `;
  }

  // Column width based on zoom
  const colWidth = zoom === 'day' ? 36 : zoom === 'month' ? 110 : 80;
  const sidebarWidth = 280;
  const totalRows = rows.length;

  // ---- Build month header row (for day zoom) ----
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

  // ---- Build date header row ----
  const dateRow = zoom === 'day' ? 2 : 1;
  let dateHeaderHTML = `<div class="gantt-sidebar-header" style="grid-row: ${dateRow}; grid-column: 1;">Tasks</div>`;
  for (let i = 0; i < numCols; i++) {
    const col = columns[i];
    const todayClass = col.isToday ? ' gantt-col-today' : '';
    const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
    dateHeaderHTML += `<div class="gantt-date-header${todayClass}${weekendClass}" style="grid-row: ${dateRow}; grid-column: ${i + 2};">${_tlEscape(col.label)}</div>`;
  }

  // ---- Build rows ----
  const dataRowStart = dateRow + 1;
  let rowsHTML = '';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const gridRow = dataRowStart + r;

    if (row.type === 'project') {
      const isCollapsed = collapsed[row.project.id];
      const arrow = isCollapsed ? '&#9654;' : '&#9660;';

      // Sidebar label
      rowsHTML += `<div class="gantt-project-label" style="grid-row: ${gridRow}; grid-column: 1;" onclick="_ganttToggleGroup('${row.project.id}')">
        <span class="gantt-toggle-arrow">${arrow}</span>
        <span class="gantt-project-dot" style="background: ${row.project.color};"></span>
        <span class="gantt-project-name">${_tlEscape(row.project.name)}</span>
        <span class="gantt-project-count">${row.taskCount}</span>
        <button class="gantt-add-subtask-btn" onclick="event.stopPropagation(); openCreateTaskModal('${row.project.id}')" title="Add sub-task">+</button>
      </div>`;

      // Background cells for project row
      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        rowsHTML += `<div class="gantt-project-cell${todayClass}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }

      // Project aggregate bar (span from earliest task to latest task)
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

    } else {
      // Task row
      const task = row.task;
      const member = members.find(m => m.id === task.assignee_id);

      // Sidebar label
      rowsHTML += `<div class="gantt-task-label" style="grid-row: ${gridRow}; grid-column: 1;" onclick="openEditTaskModal('${task.id}')">
        ${_tlEscape(task.title)}
      </div>`;

      // Background cells
      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
        rowsHTML += `<div class="gantt-cell${todayClass}${weekendClass}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }

      // Task bar
      const span = _ganttTaskSpan(task, columns);
      if (span.startCol >= 0) {
        const gc1 = span.startCol + 2;
        const gc2 = span.endCol + 3;
        const color = row.project.color || '#14b8a6';
        const doneClass = task.status === 'done' ? ' gantt-bar-done' : '';
        const assigneeName = member ? _tlEscape(member.name) : '';

        rowsHTML += `<div class="gantt-task-bar${doneClass}" style="grid-row: ${gridRow}; grid-column: ${gc1} / ${gc2}; background: ${color};"
          onclick="openEditTaskModal('${task.id}')"
          onmouseover="showTaskTooltip(event, '${task.id}')"
          onmouseout="hideTaskTooltip()">
          <span class="gantt-bar-label">${_tlEscape(task.title)}</span>
        </div>`;

        // Assignee label to the right of bar
        if (assigneeName && span.endCol + 1 < numCols) {
          rowsHTML += `<div class="gantt-assignee-label" style="grid-row: ${gridRow}; grid-column: ${gc2};">${assigneeName}</div>`;
        }
      }
    }
  }

  // ---- Today line ----
  let todayLine = '';
  for (let i = 0; i < numCols; i++) {
    if (columns[i].isToday) {
      // For day zoom, center the line on the column
      // For week/month, position proportionally
      const gc = i + 2;
      const totalGridRows = dataRowStart + rows.length;
      todayLine = `<div class="gantt-today-line" style="grid-column: ${gc}; grid-row: ${dateRow} / ${totalGridRows};"></div>`;
      break;
    }
  }

  // Grid template
  const gridCols = `${sidebarWidth}px repeat(${numCols}, ${colWidth}px)`;
  const headerRows = zoom === 'day' ? 2 : 1;

  return `
    <div class="card gantt-container">
      <div class="gantt-scroll">
        <div class="gantt-grid" style="grid-template-columns: ${gridCols};">
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

  const filteredTasks = filterProject ? tasks.filter(t => t.project_id === filterProject) : tasks;

  if (filteredTasks.length === 0) {
    return `
      <div class="card gantt-empty-state">
        <div class="gantt-empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h3 class="gantt-empty-title">No sub-tasks yet</h3>
        <p class="gantt-empty-desc">Create a sub-task to see it in the list.</p>
        <div class="gantt-empty-actions">
          <button class="tl-action-btn tl-action-btn--primary" onclick="openCreateTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Sub-task
          </button>
        </div>
      </div>
    `;
  }

  const rows = filteredTasks.map(task => {
    const project = projects.find(p => p.id === task.project_id);
    const member = members.find(m => m.id === task.assignee_id);
    const statusCls = task.status === 'done' ? 'tl-status-done'
      : task.status === 'in_progress' ? 'tl-status-progress'
      : 'tl-status-planned';

    return `
      <tr onclick="openEditTaskModal('${task.id}')" style="cursor: pointer;">
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${project ? `<span class="tl-project-dot" style="background: ${project.color};"></span>` : ''}
            ${_tlEscape(task.title)}
          </div>
        </td>
        <td>${project ? _tlEscape(project.name) : '-'}</td>
        <td>${member ? _tlEscape(member.name) : '-'}</td>
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
              <th>Sub-task</th>
              <th>Task</th>
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

// ===== Main Render =====

function renderTimeline() {
  const content = document.getElementById('content');
  if (!content) return;

  // Fetch data on first render
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

  const viewMode = AppState.timelineViewMode || 'timeline';
  const toolbar = _tlBuildToolbar();
  const body = viewMode === 'list' ? _tlBuildListView() : _ganttBuildChart();

  content.innerHTML = `
    <div class="animate-slide-up" style="display: flex; flex-direction: column; gap: 16px;">
      ${toolbar}
      ${body}
    </div>
  `;
}

// ===== Tooltip =====

function showTaskTooltip(event, taskId) {
  hideTaskTooltip();
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;
  const project = (AppState.timelineProjects || []).find(p => p.id === task.project_id);
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === task.assignee_id);

  const tooltip = document.createElement('div');
  tooltip.id = 'tl-tooltip';
  tooltip.className = 'tl-tooltip';
  tooltip.innerHTML = `
    <div class="tl-tooltip-title">${_tlEscape(task.title)}</div>
    <div class="tl-tooltip-meta">
      ${project ? `<span style="color: ${project.color};">${_tlEscape(project.name)}</span>` : ''}
      ${member ? `<span>${_tlEscape(member.name)}</span>` : ''}
    </div>
    <div class="tl-tooltip-dates">${task.start_date} &rarr; ${task.end_date}</div>
    <div class="tl-tooltip-hours">${task.hours_per_week}h/week &middot; ${_tlEscape(task.status)}</div>
    ${task.description ? `<div class="tl-tooltip-desc">${_tlEscape(task.description)}</div>` : ''}
  `;

  // Position near cursor but keep within viewport
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

// ===== Project Color Palette =====

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
      <label class="form-label">Task Name</label>
      <input type="text" id="tl-proj-name" class="form-input" placeholder="e.g. Website Redesign">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="tl-color-palette">${colorSwatches}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateProject()">Create Task</button>
  `;

  _tlShowModal(_tlModalShell('New Task', body, footer));
}

async function submitCreateProject() {
  const name = document.getElementById('tl-proj-name')?.value?.trim();
  const colorInput = document.querySelector('input[name="tl-project-color"]:checked');
  const color = colorInput ? colorInput.value : '#14b8a6';

  if (!name) {
    showNotification('Please enter a project name', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/projects?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    });
    if (!resp.ok) throw new Error('Failed to create project');
    closeTimelineModal();
    showNotification('Task created', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Create Member Modal =====

function openCreateMemberModal() {
  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="tl-member-name" class="form-input" placeholder="e.g. Sarah Johnson">
    </div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <input type="text" id="tl-member-role" class="form-input" placeholder="e.g. Frontend Developer">
    </div>
    <div class="form-group">
      <label class="form-label">Weekly Capacity (hours)</label>
      <input type="number" id="tl-member-capacity" class="form-input" value="40" min="1" max="80">
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateMember()">Add Member</button>
  `;

  _tlShowModal(_tlModalShell('New Team Member', body, footer));
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
    if (!resp.ok) throw new Error('Failed to create team member');
    closeTimelineModal();
    showNotification('Team member added', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Create Task Modal =====

function openCreateTaskModal(prefillProjectId, prefillAssignee) {
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  if (projects.length === 0 || members.length === 0) {
    showNotification('Create at least one task and one team member first.', 'warning');
    return;
  }

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === prefillProjectId ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${m.id === prefillAssignee ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

  const today = _tlDateToISO(new Date());
  const nextWeek = _tlDateToISO(_tlAddDays(new Date(), 7));

  const body = `
    <div class="form-group">
      <label class="form-label">Sub-task Title</label>
      <input type="text" id="tl-task-title" class="form-input" placeholder="e.g. Design Homepage">
    </div>
    <div class="form-group">
      <label class="form-label">Parent Task</label>
      <select id="tl-task-project" class="form-input">${projectOpts}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Assignee</label>
      <select id="tl-task-assignee" class="form-input">${memberOpts}</select>
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
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group">
        <label class="form-label">Hours per Week</label>
        <input type="number" id="tl-task-hours" class="form-input" value="8" min="1" max="60">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="tl-task-status" class="form-input">
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description (optional)</label>
      <textarea id="tl-task-desc" class="form-input" rows="3" placeholder="Additional details..."></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateTask()">Create Sub-task</button>
  `;

  _tlShowModal(_tlModalShell('New Sub-task', body, footer));
}

async function submitCreateTask() {
  const title = document.getElementById('tl-task-title')?.value?.trim();
  const project_id = document.getElementById('tl-task-project')?.value;
  const assignee_id = document.getElementById('tl-task-assignee')?.value;
  const start_date = document.getElementById('tl-task-start')?.value;
  const end_date = document.getElementById('tl-task-end')?.value;
  const hours_per_week = parseInt(document.getElementById('tl-task-hours')?.value) || 8;
  const taskStatus = document.getElementById('tl-task-status')?.value || 'planned';
  const description = document.getElementById('tl-task-desc')?.value?.trim() || '';

  if (!title || !project_id || !assignee_id || !start_date || !end_date) {
    showNotification('Please fill in all required fields', 'warning');
    return;
  }
  if (start_date > end_date) {
    showNotification('End date must be after start date', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, project_id, assignee_id, start_date, end_date, hours_per_week, status: taskStatus })
    });
    if (!resp.ok) throw new Error('Failed to create task');
    closeTimelineModal();
    showNotification('Sub-task created', 'success');
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

  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === task.project_id ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${m.id === task.assignee_id ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

  const statusOpts = ['planned', 'in_progress', 'done'].map(s =>
    `<option value="${s}" ${s === task.status ? 'selected' : ''}>${s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Sub-task Title</label>
      <input type="text" id="tl-edit-title" class="form-input" value="${_tlEscape(task.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Parent Task</label>
      <select id="tl-edit-project" class="form-input">${projectOpts}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Assignee</label>
      <select id="tl-edit-assignee" class="form-input">${memberOpts}</select>
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
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group">
        <label class="form-label">Hours per Week</label>
        <input type="number" id="tl-edit-hours" class="form-input" value="${task.hours_per_week}" min="1" max="60">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="tl-edit-status" class="form-input">${statusOpts}</select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="tl-edit-desc" class="form-input" rows="3">${_tlEscape(task.description || '')}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" onclick="deleteTimelineTask('${task.id}')" style="color: var(--error); margin-right: auto;">Delete</button>
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitEditTask('${task.id}')">Save Changes</button>
  `;

  _tlShowModal(_tlModalShell('Edit Sub-task', body, footer));
}

async function submitEditTask(taskId) {
  const title = document.getElementById('tl-edit-title')?.value?.trim();
  const project_id = document.getElementById('tl-edit-project')?.value;
  const assignee_id = document.getElementById('tl-edit-assignee')?.value;
  const start_date = document.getElementById('tl-edit-start')?.value;
  const end_date = document.getElementById('tl-edit-end')?.value;
  const hours_per_week = parseInt(document.getElementById('tl-edit-hours')?.value) || 8;
  const taskStatus = document.getElementById('tl-edit-status')?.value || 'planned';
  const description = document.getElementById('tl-edit-desc')?.value?.trim() || '';

  if (!title || !start_date || !end_date) {
    showNotification('Please fill in all required fields', 'warning');
    return;
  }
  if (start_date > end_date) {
    showNotification('End date must be after start date', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, project_id, assignee_id, start_date, end_date, hours_per_week, status: taskStatus })
    });
    if (!resp.ok) throw new Error('Failed to update task');
    closeTimelineModal();
    showNotification('Sub-task updated', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function deleteTimelineTask(taskId) {
  if (!confirm('Delete this sub-task?')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete task');
    closeTimelineModal();
    showNotification('Sub-task deleted', 'success');
    await timelineRefreshData();
    renderTimeline();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
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
}
