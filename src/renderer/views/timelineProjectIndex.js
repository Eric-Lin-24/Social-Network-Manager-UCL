// ============================================
// TIMELINE PROJECT INDEX
// Workspace listing, search, grid/list views,
// context menus, edit/delete workspace modals
// ============================================
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
      <div class="pi-avatar" style="z-index: ${maxAvatars - i}; border-color: ${ws.color};" title="${escapeHtml(m.name)}">
        ${escapeHtml(m.avatar_initials || '??')}
      </div>
    `).join('') + (extraCount > 0 ? `<div class="pi-avatar pi-avatar-extra" style="z-index: 0;">+${extraCount}</div>` : '');

    const desc = ws.description || '';
    const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;

    if (viewMode === 'list') {
      return `
        <div class="pi-list-row" onclick="_tlOpenProject('${ws.id}')">
          <div class="pi-list-color" style="background: ${ws.color};"></div>
          <div class="pi-list-info">
            <div class="pi-list-name">${escapeHtml(ws.name)}</div>
            <div class="pi-list-meta">${dateRange}${desc ? ' \u00b7 ' + escapeHtml(shortDesc) : ''}</div>
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
          <h3 class="pi-card-title">${escapeHtml(ws.name)}</h3>
          ${desc ? `<p class="pi-card-desc">${escapeHtml(shortDesc)}</p>` : ''}
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
            <input type="text" class="pi-search" placeholder="Search workspaces..." value="${escapeHtml(AppState.timelineProjectSearch || '')}" oninput="_tlProjectSearch(this.value)">
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

const _tlProjectSearch = debounce((value) => {
  AppState.timelineProjectSearch = value;
  renderTimeline();
}, 150);

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
      <input type="text" id="tl-edit-proj-name" class="form-input" value="${escapeHtml(ws.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="tl-edit-proj-desc" class="form-input" rows="3" placeholder="What is this workspace about?">${escapeHtml(ws.description || '')}</textarea>
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