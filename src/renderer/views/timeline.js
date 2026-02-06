// ============================================
// TIMELINE VIEW - Resource Capacity Planning
// Swim lanes by team member, weekly columns,
// color-coded task bars, capacity indicators
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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
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

function _tlFormatRangeLabel(start, end) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${months[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} - ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

// ===== Viewport / Column Calculations =====

function _tlGetColumns() {
  const zoom = AppState.timelineZoom || 'week';
  const startDate = AppState.timelineStartDate
    ? _tlParseDate(AppState.timelineStartDate)
    : _tlWeekStart(new Date());

  const columns = [];

  if (zoom === 'day') {
    for (let i = 0; i < 14; i++) {
      const d = _tlAddDays(startDate, i);
      columns.push({
        start: new Date(d),
        end: _tlAddDays(d, 0),
        label: _tlFormatShortDate(d),
        isToday: _tlDateToISO(d) === _tlDateToISO(new Date()),
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
  } else if (zoom === 'month') {
    const ms = _tlMonthStart(startDate);
    for (let i = 0; i < 6; i++) {
      const m = new Date(ms);
      m.setMonth(m.getMonth() + i);
      const mEnd = new Date(m);
      mEnd.setMonth(mEnd.getMonth() + 1);
      mEnd.setDate(mEnd.getDate() - 1);
      columns.push({
        start: new Date(m),
        end: mEnd,
        label: _tlFormatMonthYear(m),
        isToday: false,
        isWeekend: false
      });
    }
  } else {
    // Week zoom (default)
    const ws = _tlWeekStart(startDate);
    for (let i = 0; i < 8; i++) {
      const w = _tlAddDays(ws, i * 7);
      const wEnd = _tlAddDays(w, 6);
      columns.push({
        start: new Date(w),
        end: wEnd,
        label: _tlFormatShortDate(w),
        isToday: false,
        isWeekend: false
      });
    }
  }

  return columns;
}

function _tlGetViewportRange(columns) {
  if (!columns.length) return { start: new Date(), end: new Date() };
  return { start: columns[0].start, end: columns[columns.length - 1].end };
}

// ===== Capacity Calculation =====

function _tlCalcCapacity(member, tasks, colStart, colEnd) {
  const overlapping = tasks.filter(t => {
    if (t.assignee_id !== member.id) return false;
    const tStart = _tlParseDate(t.start_date);
    const tEnd = _tlParseDate(t.end_date);
    return tStart <= colEnd && tEnd >= colStart;
  });
  const totalHours = overlapping.reduce((sum, t) => sum + (t.hours_per_week || 0), 0);
  const capacity = member.weekly_capacity_hours || 40;
  return {
    used: totalHours,
    total: capacity,
    percent: Math.round((totalHours / capacity) * 100)
  };
}

// ===== Task Bar Column Span =====

function _tlTaskColumnSpan(task, columns) {
  const tStart = _tlParseDate(task.start_date);
  const tEnd = _tlParseDate(task.end_date);

  let startCol = -1;
  let endCol = -1;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (tStart <= col.end && tEnd >= col.start) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }

  return { startCol, endCol };
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
  if (AppState.timelineFilterProject) url += `&project_id=${encodeURIComponent(AppState.timelineFilterProject)}`;
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
    : _tlWeekStart(new Date());

  let next;
  if (zoom === 'day') {
    next = _tlAddDays(current, direction * 7);
  } else if (zoom === 'month') {
    next = new Date(current);
    next.setMonth(next.getMonth() + direction * 3);
  } else {
    next = _tlAddDays(current, direction * 4 * 7);
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
  renderTimeline();
}

function timelineSetViewMode(mode) {
  AppState.timelineViewMode = mode;
  renderTimeline();
}

function timelineSetFilterProject(id) {
  AppState.timelineFilterProject = id;
  timelineFetchTasks().then(() => renderTimeline());
}

function timelineSetFilterPerson(id) {
  AppState.timelineFilterPerson = id;
  timelineFetchTasks().then(() => renderTimeline());
}

// ===== Toolbar Builder =====

function _tlBuildToolbar() {
  const zoom = AppState.timelineZoom || 'week';
  const viewMode = AppState.timelineViewMode || 'timeline';
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const columns = _tlGetColumns();
  const range = _tlGetViewportRange(columns);

  const zoomBtn = (val, label) =>
    `<button class="tl-tab-btn ${zoom === val ? 'active' : ''}" onclick="timelineSetZoom('${val}')">${label}</button>`;

  const viewBtn = (val, label) =>
    `<button class="tl-tab-btn ${viewMode === val ? 'active' : ''}" onclick="timelineSetViewMode('${val}')">${label}</button>`;

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${AppState.timelineFilterProject === p.id ? 'selected' : ''}>${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${AppState.timelineFilterPerson === m.id ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

  return `
    <div class="tl-toolbar card">
      <div class="tl-toolbar-left">
        <div class="tl-tab-group">
          ${viewBtn('timeline', 'Timeline')}
          ${viewBtn('list', 'List')}
        </div>
        <div class="tl-tab-group">
          ${zoomBtn('day', 'Day')}
          ${zoomBtn('week', 'Week')}
          ${zoomBtn('month', 'Month')}
        </div>
      </div>
      <div class="tl-toolbar-center">
        <button class="btn btn-ghost btn-sm" onclick="_tlNavigate(-1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="tl-range-label">${_tlFormatRangeLabel(range.start, range.end)}</span>
        <button class="btn btn-ghost btn-sm" onclick="_tlNavigate(1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="_tlGoToToday()">Today</button>
      </div>
      <div class="tl-toolbar-right">
        <select class="tl-filter-select" onchange="timelineSetFilterProject(this.value)">
          <option value="">All Projects</option>
          ${projectOpts}
        </select>
        <select class="tl-filter-select" onchange="timelineSetFilterPerson(this.value)">
          <option value="">All People</option>
          ${memberOpts}
        </select>
        <button class="btn btn-primary btn-sm" onclick="openCreateTaskModal()">+ Task</button>
        <button class="btn btn-secondary btn-sm" onclick="openCreateProjectModal()">+ Project</button>
        <button class="btn btn-secondary btn-sm" onclick="openCreateMemberModal()">+ Member</button>
      </div>
    </div>
  `;
}

// ===== Today Marker =====

function _tlTodayMarkerColumn(columns) {
  const todayISO = _tlDateToISO(new Date());
  const today = _tlParseDate(todayISO);

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (today >= col.start && today <= col.end) {
      // Calculate position within this column
      const totalDays = Math.max(1, (col.end - col.start) / (1000 * 60 * 60 * 24));
      const dayOffset = (today - col.start) / (1000 * 60 * 60 * 24);
      const pct = Math.round((dayOffset / totalDays) * 100);
      return { colIndex: i, pct };
    }
  }
  return null;
}

// ===== Timeline Grid Builder =====

function _tlBuildTimelineGrid() {
  const columns = _tlGetColumns();
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const numCols = columns.length;

  if (members.length === 0) {
    return `
      <div class="card" style="padding: 48px; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline-block;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No team members yet</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">Add team members to start planning your resource timeline.</p>
        <button class="btn btn-primary" onclick="openCreateMemberModal()">+ Add Team Member</button>
      </div>
    `;
  }

  // Build header row
  let headerCells = `<div class="tl-header-cell tl-member-header">Team Member</div>`;
  for (const col of columns) {
    const cls = col.isToday ? ' tl-col-today' : '';
    headerCells += `<div class="tl-header-cell${cls}">${_tlEscape(col.label)}</div>`;
  }

  // Build swim lane rows
  let swimLanes = '';
  for (const member of members) {
    const memberTasks = tasks.filter(t => t.assignee_id === member.id);
    swimLanes += _tlBuildSwimLane(member, memberTasks, columns, projects);
  }

  // Today marker
  const todayInfo = _tlTodayMarkerColumn(columns);
  let todayMarker = '';
  if (todayInfo) {
    // grid-column is 1-indexed, +2 for the member column offset
    const gridCol = todayInfo.colIndex + 2;
    todayMarker = `<div class="tl-today-marker" style="grid-column: ${gridCol}; left: ${todayInfo.pct}%;"></div>`;
  }

  return `
    <div class="card tl-container">
      <div class="tl-grid" style="grid-template-columns: 200px repeat(${numCols}, minmax(${AppState.timelineZoom === 'day' ? '80px' : '120px'}, 1fr));">
        ${headerCells}
        ${swimLanes}
        ${todayMarker}
      </div>
    </div>
  `;
}

function _tlBuildSwimLane(member, memberTasks, columns, projects) {
  const numCols = columns.length;

  // Member info cell
  let html = `
    <div class="tl-member-cell">
      <div class="tl-member-avatar">${_tlEscape(member.avatar_initials)}</div>
      <div class="tl-member-info">
        <div class="tl-member-name">${_tlEscape(member.name)}</div>
        <div class="tl-member-role">${_tlEscape(member.role)}${member.weekly_capacity_hours ? ', ' + member.weekly_capacity_hours + 'h/wk' : ''}</div>
      </div>
    </div>
  `;

  // Time cells with capacity badges
  for (let i = 0; i < numCols; i++) {
    const col = columns[i];
    const cap = _tlCalcCapacity(member, AppState.timelineTasks || [], col.start, col.end);
    let capClass = 'tl-cap-ok';
    if (cap.percent >= 100) capClass = 'tl-cap-over';
    else if (cap.percent >= 75) capClass = 'tl-cap-warning';

    const capBadge = cap.used > 0
      ? `<div class="tl-capacity-badge ${capClass}">${cap.percent}%</div>`
      : '';

    html += `<div class="tl-cell${col.isWeekend ? ' tl-weekend' : ''}${col.isToday ? ' tl-col-today' : ''}">${capBadge}</div>`;
  }

  // Task bars (positioned as an overlay row)
  // Group tasks by vertical stack position
  const tasksByRow = [];
  for (const task of memberTasks) {
    const span = _tlTaskColumnSpan(task, columns);
    if (span.startCol === -1) continue; // task not in viewport

    const project = projects.find(p => p.id === task.project_id);
    let placed = false;

    for (let row = 0; row < tasksByRow.length; row++) {
      const rowTasks = tasksByRow[row];
      const overlaps = rowTasks.some(rt => {
        const rtSpan = _tlTaskColumnSpan(rt, columns);
        return span.startCol <= rtSpan.endCol && span.endCol >= rtSpan.startCol;
      });
      if (!overlaps) {
        rowTasks.push(task);
        placed = true;
        break;
      }
    }
    if (!placed) {
      tasksByRow.push([task]);
    }
  }

  // Render task bars
  for (let row = 0; row < tasksByRow.length; row++) {
    for (const task of tasksByRow[row]) {
      const span = _tlTaskColumnSpan(task, columns);
      if (span.startCol === -1) continue;

      const project = projects.find(p => p.id === task.project_id);
      const color = project ? project.color : '#14b8a6';
      // grid-column is 1-indexed, +2 for the member column offset
      const gridColStart = span.startCol + 2;
      const gridColEnd = span.endCol + 3; // exclusive end
      const topOffset = 24 + row * 32;
      const doneClass = task.status === 'done' ? ' status-done' : '';

      html += `
        <div class="tl-task-bar${doneClass}"
             style="grid-column: ${gridColStart} / ${gridColEnd}; background: ${color}; margin-top: ${topOffset}px;"
             onclick="openEditTaskModal('${task.id}')"
             onmouseover="showTaskTooltip(event, '${task.id}')"
             onmouseout="hideTaskTooltip()">
          <span class="tl-task-label">${_tlEscape(task.title)}</span>
          ${project ? `<span class="tl-task-tag">${_tlEscape(project.name)}</span>` : ''}
        </div>
      `;
    }
  }

  return html;
}

// ===== List View Builder =====

function _tlBuildListView() {
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  if (tasks.length === 0) {
    return `
      <div class="card" style="padding: 48px; text-align: center;">
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No tasks yet</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">Create a task to see it in the list.</p>
        <button class="btn btn-primary" onclick="openCreateTaskModal()">+ Create Task</button>
      </div>
    `;
  }

  const rows = tasks.map(task => {
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
    <div class="card tl-container">
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
  const body = viewMode === 'list' ? _tlBuildListView() : _tlBuildTimelineGrid();

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
      <label class="form-label">Project Name</label>
      <input type="text" id="tl-proj-name" class="form-input" placeholder="e.g. Website Redesign">
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

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/projects?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
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

function openCreateTaskModal(prefillAssignee) {
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  if (projects.length === 0 || members.length === 0) {
    showNotification('Create at least one project and one team member first.', 'warning');
    return;
  }

  const projectOpts = projects.map(p =>
    `<option value="${p.id}">${_tlEscape(p.name)}</option>`
  ).join('');

  const memberOpts = members.map(m =>
    `<option value="${m.id}" ${m.id === prefillAssignee ? 'selected' : ''}>${_tlEscape(m.name)}</option>`
  ).join('');

  const today = _tlDateToISO(new Date());
  const nextWeek = _tlDateToISO(_tlAddDays(new Date(), 7));

  const body = `
    <div class="form-group">
      <label class="form-label">Task Title</label>
      <input type="text" id="tl-task-title" class="form-input" placeholder="e.g. Design Homepage">
    </div>
    <div class="form-group">
      <label class="form-label">Project</label>
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
    <button class="btn btn-primary" onclick="submitCreateTask()">Create Task</button>
  `;

  _tlShowModal(_tlModalShell('New Task', body, footer));
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
      <label class="form-label">Task Title</label>
      <input type="text" id="tl-edit-title" class="form-input" value="${_tlEscape(task.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Project</label>
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

  _tlShowModal(_tlModalShell('Edit Task', body, footer));
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
