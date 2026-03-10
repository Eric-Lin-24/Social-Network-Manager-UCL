// ============================================
// TIMELINE INTERACTION
// Drag-to-create, resize, move task bars,
// toolbar drag, and all mouse event handlers
// ============================================
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
  // Determine lane from drop target
  const dropTarget = _tlGetDropTarget(e.clientX, e.clientY);
  if (dropTarget && dropTarget.isAddRow) {
    _tlDrag.laneIdx = _ganttNextLaneIndex(_tlDrag.projectId);
  } else if (dropTarget && dropTarget.laneIdx !== undefined) {
    _tlDrag.laneIdx = dropTarget.laneIdx;
  } else {
    _tlDrag.laneIdx = _ganttNextLaneIndex(_tlDrag.projectId);
  }
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

  // Determine lane: existing lane if clicked on a task row, new lane if clicked on add row
  const isAddRow = cell.classList.contains('gantt-add-cell');
  const laneIdx = isAddRow
    ? _ganttNextLaneIndex(projectId)
    : (cell.dataset.laneIdx !== undefined ? parseInt(cell.dataset.laneIdx) : _ganttNextLaneIndex(projectId));

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
    laneIdx,
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

    // Check if mouse is over a different row -> update project/lane
    const target = _tlGetDropTarget(e.clientX, e.clientY);
    if (target && target.projectId) {
      if (target.projectId !== _tlDrag.projectId) {
        _tlDrag.projectId = target.projectId;
        _tlDrag.projectColor = target.projectColor || _tlDrag.projectColor;
        _tlDrag.ghost.style.background = _tlDrag.projectColor;
      }
      _tlDrag.gridRow = target.gridRow || _tlDrag.gridRow;
      _tlDrag.ghost.style.gridRow = _tlDrag.gridRow;
      // Update lane based on where cursor is
      if (target.isAddRow) {
        _tlDrag.laneIdx = _ganttNextLaneIndex(_tlDrag.projectId);
      } else if (target.laneIdx !== undefined) {
        _tlDrag.laneIdx = target.laneIdx;
      }
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

    // Check for project/lane change
    const target = _tlGetDropTarget(e.clientX, e.clientY);
    if (target && target.projectId && target.projectId !== '__orphan') {
      _tlDrag.newProjectId = target.projectId;
      _tlDrag.bar.style.background = target.projectColor || _tlDrag.originalColor;
      _tlDrag.bar.style.gridRow = target.gridRow || _tlDrag.gridRow;
      // Track lane for the drop target
      if (target.isAddRow) {
        _tlDrag.newLaneIdx = _ganttNextLaneIndex(target.projectId);
      } else if (target.laneIdx !== undefined) {
        _tlDrag.newLaneIdx = target.laneIdx;
      }
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
  const { ghost, startCol, currentCol, projectId, projectColor, gridRow, laneIdx, grid } = _tlDrag;

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
  const startDate = columns[minCol] ? dateToLocalISO(columns[minCol].start) : dateToLocalISO(new Date());
  const endDate = columns[maxCol] ? dateToLocalISO(columns[maxCol].end) : startDate;
  // For end_date, use just the date part (YYYY-MM-DD)
  const endDateISO = columns[maxCol] ? dateToLocalISO(columns[maxCol].start) : startDate;

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
      const created = await resp.json();
      // Assign the new task to the lane the user drew on
      if (created && created.id) {
        _ganttSetLaneIndex(projectId, created.id, laneIdx);
      }
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
    endDate = dateToLocalISO(columns[newEndCol].start);
    changed = true;
  }
  if (edge === 'left' && newStartCol !== originalStartCol) {
    startDate = dateToLocalISO(columns[newStartCol].start);
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

  // Track click start to distinguish click from drag
  const startX = e.clientX;
  const startY = e.clientY;
  const startTime = Date.now();
  let dragInitialized = false;

  const onMouseMove = (moveE) => {
    const dx = moveE.clientX - startX;
    const dy = moveE.clientY - startY;
    // Only start actual drag if moved more than 5px
    if (!dragInitialized && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragInitialized = true;

      const columns = _ganttGetColumns();
      const span = _ganttTaskSpan(task, columns);
      const grabCol = _tlGetColFromX(startX, grid, columns);
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
    }

    if (dragInitialized && _tlDrag) {
      _tlDragMove(moveE);
    }
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (!dragInitialized) {
      // Quick click — open edit modal directly
      openEditTaskModal(taskId);
    } else if (_tlDrag) {
      // Was dragging — finish move via existing logic
      document.removeEventListener('mousemove', _tlDragMove);
      document.removeEventListener('mouseup', _tlDragEnd);
      _tlFinishMove();
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function _tlFinishMove() {
  const { taskId, originalStartCol, originalEndCol, columns, newStartCol, newEndCol, bar, newProjectId, originalProjectId, newLaneIdx } = _tlDrag;

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
    startDate = dateToLocalISO(columns[newStartCol].start);
    changed = true;
  }
  if (newEndCol !== undefined && newEndCol !== originalEndCol) {
    endDate = dateToLocalISO(columns[newEndCol].start);
    changed = true;
  }
  if (newProjectId && newProjectId !== originalProjectId) {
    projectId = newProjectId;
    changed = true;
  }

  // Update lane assignment if task was moved to a different row
  if (newLaneIdx !== undefined) {
    const targetProjectId = projectId || task.project_id;
    _ganttSetLaneIndex(targetProjectId, taskId, newLaneIdx);
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

function _tlGetColFromX(clientX, grid, columns) {
  if (!grid) return -1;
  const rect = grid.getBoundingClientRect();
  const x = clientX - rect.left;
  const zoom = AppState.timelineZoom || 'week';
  const colWidth = zoom === 'day' ? 36 : zoom === 'month' ? 110 : 80;
  const sidebarWidth = 280;
  const cols = columns || _ganttGetColumns();
  const col = Math.floor((x - sidebarWidth) / colWidth);
  return Math.max(0, Math.min(col, cols.length - 1));
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
    gridRow: parseInt(cell.dataset.gridRow) || 0,
    laneIdx: cell.dataset.laneIdx !== undefined ? parseInt(cell.dataset.laneIdx) : undefined,
    isAddRow: cell.classList.contains('gantt-add-cell')
  };
}

async function _tlUpdateTaskDates(taskId, startDate, endDate) {
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  // Optimistic local update
  const oldStart = task.start_date;
  const oldEnd = task.end_date;
  task.start_date = startDate;
  task.end_date = endDate;
  renderTimeline();

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
    timelineRefreshData().then(() => renderTimeline());
  } catch (e) {
    // Revert on failure
    task.start_date = oldStart;
    task.end_date = oldEnd;
    showNotification('Error: ' + e.message, 'error');
    renderTimeline();
  }
}

async function _tlUpdateTask(taskId, updates) {
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;

  // Optimistic local update
  const oldValues = {};
  for (const key of Object.keys(updates)) {
    oldValues[key] = task[key];
    task[key] = updates[key];
  }
  renderTimeline();

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

    if (updates.project_id && updates.project_id !== oldValues.project_id) {
      const newProj = (AppState.timelineProjects || []).find(p => p.id === updates.project_id);
      showNotification(`Moved to ${newProj ? newProj.name : 'new project'}`, 'success');
    }

    timelineRefreshData().then(() => renderTimeline());
  } catch (e) {
    // Revert on failure
    for (const key of Object.keys(oldValues)) {
      task[key] = oldValues[key];
    }
    showNotification('Error: ' + e.message, 'error');
    renderTimeline();
  }
}
