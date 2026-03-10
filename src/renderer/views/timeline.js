// ============================================
// TIMELINE VIEW - Core
// Data fetching, navigation, toolbar, Gantt
// chart builder, list view, main render
// ============================================
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

async function timelineFetchTeams() {
  if (!AppState.userId) return;
  const resp = await fetch(`${AppState.authenticationUrl}/teams?user_uuid=${AppState.userId}`);
  if (!resp.ok) throw new Error('Failed to fetch teams');
  AppState.teams = await resp.json();
}

async function timelineRefreshData() {
  try {
    await Promise.all([
      timelineFetchWorkspaces(),
      timelineFetchProjects(),
      timelineFetchMembers(),
      timelineFetchTasks(),
      timelineFetchTeams()
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
    : addDays(new Date(), -3);

  let next;
  if (zoom === 'day') {
    next = addDays(current, direction * 14);
  } else if (zoom === 'month') {
    next = new Date(current);
    next.setMonth(next.getMonth() + direction * 6);
  } else {
    next = addDays(current, direction * 8 * 7);
  }

  AppState.timelineStartDate = dateToLocalISO(next);
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
    `<option value="${p.id}" ${AppState.timelineFilterProject === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.timelineFilterPerson === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
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
  const todayISO = dateToLocalISO(new Date());

  let visibleProjects = projects;
  if (filterProject) {
    visibleProjects = projects.filter(p => p.id === filterProject);
  }

  // Build row structure: project headers, task lanes, add-rows
  const rows = [];
  for (const project of visibleProjects) {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    rows.push({ type: 'project', project, taskCount: projectTasks.length });
    if (!collapsed[project.id]) {
      // Group tasks by user-assigned lanes
      const lanes = _ganttGroupByLane(projectTasks, project.id);
      for (const lane of lanes) {
        rows.push({ type: 'lane', laneIdx: lane.laneIdx, tasks: lane.tasks, project });
      }
      // Add-row: blank row for drag-to-create (creates a new lane)
      rows.push({ type: 'add', project });
    }
  }

  const orphanTasks = tasks.filter(t => !projects.find(p => p.id === t.project_id));
  if (orphanTasks.length > 0 && !filterProject) {
    const orphanProject = { id: '__orphan', name: 'Unassigned', color: '#6b7280' };
    rows.push({ type: 'project', project: orphanProject, taskCount: orphanTasks.length });
    if (!collapsed['__orphan']) {
      const lanes = _ganttGroupByLane(orphanTasks, '__orphan');
      for (const lane of lanes) {
        rows.push({ type: 'lane', laneIdx: lane.laneIdx, tasks: lane.tasks, project: orphanProject });
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
    dateHeaderHTML += `<div class="gantt-date-header${todayClass}${weekendClass}" style="grid-row: ${dateRow}; grid-column: ${i + 2};">${escapeHtml(col.label)}</div>`;
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
        <span class="gantt-project-name">${escapeHtml(row.project.name)}</span>
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

    } else if (row.type === 'lane') {
      // Lane: one grid row with potentially multiple task bars
      const laneTasks = row.tasks;
      const firstTask = laneTasks[0];
      const laneLabel = laneTasks.map(t => escapeHtml(t.title)).join(', ');

      rowsHTML += `<div class="gantt-task-label" style="grid-row: ${gridRow}; grid-column: 1;" onclick="openEditTaskModal('${firstTask.id}')" title="${laneLabel}">
        ${escapeHtml(firstTask.title)}${laneTasks.length > 1 ? `<span class="gantt-lane-count">+${laneTasks.length - 1}</span>` : ''}
      </div>`;

      for (let i = 0; i < numCols; i++) {
        const col = columns[i];
        const todayClass = col.isToday ? ' gantt-col-today' : '';
        const weekendClass = col.isWeekend ? ' gantt-col-weekend' : '';
        rowsHTML += `<div class="gantt-cell${todayClass}${weekendClass}" data-project-id="${row.project.id}" data-col-idx="${i}" data-grid-row="${gridRow}" data-project-color="${row.project.color}" data-lane-idx="${row.laneIdx}" style="grid-row: ${gridRow}; grid-column: ${i + 2};"></div>`;
      }

      for (const task of laneTasks) {
        const assigneeIds = task.assignee_id ? task.assignee_id.split(',') : [];
        const assigneeNames = assigneeIds.map(id => {
          const m = members.find(mm => mm.id === id);
          return m ? escapeHtml(m.name) : null;
        }).filter(Boolean);

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
            <span class="gantt-bar-label">${escapeHtml(task.title)}</span>
            <div class="gantt-resize-handle gantt-resize-right" data-task-id="${task.id}" data-edge="right"></div>
          </div>`;

          if (assigneeLabel && pos.endCol + 1 < numCols) {
            rowsHTML += `<div class="gantt-assignee-label" style="grid-row: ${gridRow}; grid-column: ${gc2};">${assigneeLabel}</div>`;
          }
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
  const todayISO = dateToLocalISO(new Date());

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
      return m ? escapeHtml(m.name) : null;
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
            ${escapeHtml(task.title)}
            ${isOverdue ? '<span class="tl-overdue-badge">OVERDUE</span>' : ''}
          </div>
        </td>
        <td>${project ? escapeHtml(project.name) : '-'}</td>
        <td>${assigneeNames.length > 0 ? assigneeNames.join(', ') : '-'}</td>
        <td>${task.start_date}</td>
        <td>${task.end_date}</td>
        <td>${task.hours_per_week}h/wk</td>
        <td><span class="tl-status-pill ${statusCls}">${escapeHtml(task.status)}</span></td>
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
  window._tlToggleTeamMembers = _tlToggleTeamMembers;
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
  window._tlToggleTeamMembers = _tlToggleTeamMembers;
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
