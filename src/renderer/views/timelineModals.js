// ============================================
// TIMELINE MODALS
// Tooltip, modal infrastructure, create/edit
// project/member/task modals, file attachments
// ============================================
// ===== Tooltip =====

function showTaskTooltip(event, taskId) {
  if (window.__tlDraggingActive) return;
  hideTaskTooltip();
  const task = (AppState.timelineTasks || []).find(t => t.id === taskId);
  if (!task) return;
  const project = (AppState.timelineProjects || []).find(p => p.id === task.project_id);
  const assigneeIds = task.assignee_id ? task.assignee_id.split(',') : [];
  const assigneeNames = assigneeIds.map(id => {
    const m = (AppState.timelineTeamMembers || []).find(mm => mm.id === id);
    return m ? escapeHtml(m.name) : null;
  }).filter(Boolean);

  const tooltip = document.createElement('div');
  tooltip.id = 'tl-tooltip';
  tooltip.className = 'tl-tooltip';
  tooltip.innerHTML = `
    <div class="tl-tooltip-title">${escapeHtml(task.title)}</div>
    <div class="tl-tooltip-meta">
      ${project ? `<span style="color: ${project.color};">${escapeHtml(project.name)}</span>` : ''}
      ${assigneeNames.length > 0 ? `<span>${assigneeNames.join(', ')}</span>` : ''}
    </div>
    <div class="tl-tooltip-dates">${task.start_date} &rarr; ${task.end_date}</div>
    <div class="tl-tooltip-hours">${task.hours_per_week}h/week &middot; ${escapeHtml(task.status)}</div>
    ${task.description ? `<div class="tl-tooltip-desc">${escapeHtml(task.description)}</div>` : ''}
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
  if (modal) {
    // Clean up ESC handler to prevent leaks
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
    modal.remove();
  }
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
    }
  };
  backdrop._escHandler = escHandler;
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
      <label class="form-label">Sprint Name</label>
      <input type="text" id="tl-proj-name" class="form-input" placeholder="e.g. Algebra Fundamentals">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="tl-color-palette">${colorSwatches}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitCreateProject()">Create Sprint</button>
  `;

  _tlShowModal(_tlModalShell('New Sprint', body, footer));
}

async function submitCreateProject() {
  const name = document.getElementById('tl-proj-name')?.value?.trim();
  const colorInput = document.querySelector('input[name="tl-project-color"]:checked');
  const color = colorInput ? colorInput.value : '#14b8a6';

  if (!name) {
    showNotification('Please enter a sprint name', 'warning');
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
    showNotification('Sprint created', 'success');
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
      <label class="form-label">Email</label>
      <input type="email" id="tl-member-email" class="form-input" placeholder="e.g. sarah@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Phone</label>
      <input type="tel" id="tl-member-phone" class="form-input" placeholder="e.g. +44 7700 900000">
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
  const email = document.getElementById('tl-member-email')?.value?.trim() || '';
  const phone = document.getElementById('tl-member-phone')?.value?.trim() || '';
  const capacity = parseInt(document.getElementById('tl-member-capacity')?.value) || 40;

  if (!name) {
    showNotification('Please enter a name', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, email, phone, weekly_capacity_hours: capacity })
    });
    if (!resp.ok) throw new Error('Failed to create worker');
    closeTimelineModal();
    showNotification('Worker added', 'success');
    await timelineRefreshData();
    if (AppState._peopleReturnAfterModal) {
      AppState._peopleReturnAfterModal = false;
      renderPeople();
    } else {
      renderTimeline();
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Create Task Modal =====

function openCreateTaskModal(prefillProjectId, prefillAssignee) {
  const allProjects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const teams = AppState.teams || [];

  const workspaceId = AppState.timelineSelectedProject;
  const projects = workspaceId
    ? allProjects.filter(p => p.workspace_id === workspaceId)
    : allProjects;

  if (projects.length === 0) {
    showNotification('Create at least one project first.', 'warning');
    return;
  }

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === prefillProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

  const prefillList = prefillAssignee ? prefillAssignee.split(',') : [];

  // Team checkboxes
  const teamCheckboxes = teams.length > 0 ? teams.map(t => {
    const mIds = (t.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    return `<label class="tl-assignee-chip tl-team-chip">
      <input type="checkbox" name="tl-task-teams" value="${t.id}" data-member-ids="${mIds.join(',')}" onchange="_tlToggleTeamMembers(this, 'tl-task-assignees')">
      <span class="tl-assignee-avatar" style="background: ${t.color || '#14b8a6'}; color: white;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
      </span>
      <span class="tl-assignee-name">${escapeHtml(t.name)}</span>
      <span class="tl-team-count">${mIds.length}</span>
    </label>`;
  }).join('') : '';

  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const checked = prefillList.includes(m.id) ? 'checked' : '';
    return `<label class="tl-assignee-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="tl-task-assignees" value="${m.id}" ${checked} onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar">${escapeHtml(m.avatar_initials)}</span>
      <span class="tl-assignee-name">${escapeHtml(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No members yet</span>';

  const today = dateToLocalISO(new Date());
  const nextWeek = dateToLocalISO(addDays(new Date(), 7));

  const teamsSection = teamCheckboxes ? `
    <div class="form-group">
      <label class="form-label">Assign Teams <span style="color: var(--text-muted); font-weight: 400;">(auto-selects all members)</span></label>
      <div class="tl-assignee-grid">${teamCheckboxes}</div>
    </div>
  ` : '';

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
    ${teamsSection}
    <div class="form-group">
      <label class="form-label">Assign Individual Members</label>
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
  const teams = AppState.teams || [];

  const workspaceId = AppState.timelineSelectedProject;
  const projects = workspaceId
    ? allProjects.filter(p => p.workspace_id === workspaceId)
    : allProjects;

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${p.id === task.project_id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

  const currentAssignees = task.assignee_id ? task.assignee_id.split(',') : [];

  // Team checkboxes for edit modal
  const teamCheckboxes = teams.length > 0 ? teams.map(t => {
    const mIds = (t.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    // Check if all team members are currently assigned
    const allAssigned = mIds.length > 0 && mIds.every(id => currentAssignees.includes(id));
    const checked = allAssigned ? 'checked' : '';
    return `<label class="tl-assignee-chip tl-team-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="tl-edit-teams" value="${t.id}" data-member-ids="${mIds.join(',')}" ${checked} onchange="_tlToggleTeamMembers(this, 'tl-edit-assignees')">
      <span class="tl-assignee-avatar" style="background: ${t.color || '#14b8a6'}; color: white;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
      </span>
      <span class="tl-assignee-name">${escapeHtml(t.name)}</span>
      <span class="tl-team-count">${mIds.length}</span>
    </label>`;
  }).join('') : '';

  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const checked = currentAssignees.includes(m.id) ? 'checked' : '';
    return `<label class="tl-assignee-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="tl-edit-assignees" value="${m.id}" ${checked} onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar">${escapeHtml(m.avatar_initials)}</span>
      <span class="tl-assignee-name">${escapeHtml(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No members yet</span>';

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
    <div class="tl-file-item" data-file-path="${escapeHtml(f.path)}" data-file-name="${escapeHtml(f.name)}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="tl-file-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
      <button class="tl-file-open" onclick="_tlOpenFile('${escapeHtml(f.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Open file">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      <button class="tl-file-remove" onclick="this.closest('.tl-file-item').remove()" title="Remove">&times;</button>
    </div>
  `).join('');

  const teamsSection = teamCheckboxes ? `
    <div class="form-group">
      <label class="form-label">Assign Teams <span style="color: var(--text-muted); font-weight: 400;">(auto-selects all members)</span></label>
      <div class="tl-assignee-grid">${teamCheckboxes}</div>
    </div>
  ` : '';

  const body = `
    <div class="form-group">
      <label class="form-label">Task Name</label>
      <input type="text" id="tl-edit-title" class="form-input" value="${escapeHtml(task.title)}">
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
    ${teamsSection}
    <div class="form-group">
      <label class="form-label">Assign Individual Members</label>
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
      <textarea id="tl-edit-desc" class="form-input" rows="3" placeholder="Task objectives, key points...">${escapeHtml(notes)}</textarea>
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

  // Optimistic local update — apply changes to AppState immediately
  const taskIdx = (AppState.timelineTasks || []).findIndex(t => t.id === taskId);
  if (taskIdx >= 0) {
    Object.assign(AppState.timelineTasks[taskIdx], { title, description, project_id, assignee_id, start_date, end_date, status });
  }

  closeTimelineModal();
  renderTimeline();

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks/${taskId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, project_id, assignee_id, start_date, end_date, hours_per_week: 8, status })
    });
    if (!resp.ok) throw new Error('Failed to update task');
    showNotification('Task updated', 'success');
    // Background sync — refresh data without blocking UI
    timelineRefreshData().then(() => renderTimeline());
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
    // Revert on failure
    await timelineRefreshData();
    renderTimeline();
  }
}

async function deleteTimelineTask(taskId) {
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

async function _tlDeleteGanttProject(projectId) {
  const project = (AppState.timelineProjects || []).find(p => p.id === projectId);
  if (!project) return;

  const taskCount = (AppState.timelineTasks || []).filter(t => t.project_id === projectId).length;
  const msg = taskCount > 0
    ? `Delete "${project.name}" and its ${taskCount} task${taskCount > 1 ? 's' : ''}? This cannot be undone.`
    : `Delete "${project.name}"? This cannot be undone.`;

  if (!confirm(msg)) return;

  try {
    const tasks = (AppState.timelineTasks || []).filter(t => t.project_id === projectId);
    for (const t of tasks) {
      await fetch(`${AppState.authenticationUrl}/timeline-tasks/${t.id}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    }
    const resp = await fetch(`${AppState.authenticationUrl}/projects/${projectId}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete project');
    showNotification(`"${project.name}" deleted`, 'success');
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
      <span class="tl-file-name" title="${escapeHtml(filePath)}">${escapeHtml(fileName)}</span>
      <button class="tl-file-open" onclick="_tlOpenFile('${escapeHtml(filePath).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Open file">
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
