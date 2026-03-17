// ============================================
// PEOPLE - Teams Sub-Page
// Team list, team detail view, create/edit/
// delete team modals
// ============================================
// ============================================
// TEAMS SUB-PAGE
// ============================================

// ===== Teams List View =====

function _pplBuildTeamList() {
  const teams = AppState.teams || [];
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.peopleTeamSearch || '').toLowerCase();

  const filtered = searchQ
    ? teams.filter(t =>
        t.name.toLowerCase().includes(searchQ) ||
        (t.description || '').toLowerCase().includes(searchQ)
      )
    : teams;

  const header = `
    <div class="ppl-list-header">
      <div class="ppl-list-header-left">
        <h2 class="ppl-page-title">Teams</h2>
        <span class="ppl-member-count">${teams.length} team${teams.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="ppl-list-header-right">
        <div class="ppl-search-wrap">
          <svg class="ppl-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="ppl-search-input" placeholder="Search teams..." value="${escapeHtml(AppState.peopleTeamSearch || '')}" oninput="_pplSearchTeams(this.value)">
        </div>
        <button class="ppl-add-btn" onclick="_pplOpenCreateTeamModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create team
        </button>
      </div>
    </div>
  `;

  if (filtered.length === 0) {
    const emptyMsg = searchQ
      ? 'No teams match your search.'
      : 'No teams yet. Create your first team to group members together.';
    return `${header}
      <div class="ppl-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
          <circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/>
        </svg>
        <p>${emptyMsg}</p>
      </div>`;
  }

  const cards = filtered.map(team => {
    const mIds = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    const teamMembers = mIds.map(id => members.find(m => m.id === id)).filter(Boolean);
    const memberCount = teamMembers.length;

    // Show up to 5 avatar initials
    const avatars = teamMembers.slice(0, 5).map(m => {
      const initials = m.avatar_initials || m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      return `<div class="ppl-team-avatar-sm" style="background: ${_pplAvatarColor(m.name)}" title="${escapeHtml(m.name)}">${escapeHtml(initials)}</div>`;
    }).join('');
    const extraCount = memberCount > 5 ? `<div class="ppl-team-avatar-sm ppl-team-avatar-extra">+${memberCount - 5}</div>` : '';

    return `
      <div class="ppl-team-card" onclick="_pplOpenTeam('${team.id}')">
        <div class="ppl-team-card-color" style="background: ${team.color || '#14b8a6'}"></div>
        <div class="ppl-team-card-body">
          <div class="ppl-team-card-name">${escapeHtml(team.name)}</div>
          ${team.description ? `<div class="ppl-team-card-desc">${escapeHtml(team.description)}</div>` : ''}
          <div class="ppl-team-card-members">
            <div class="ppl-team-avatar-stack">${avatars}${extraCount}</div>
            <span class="ppl-team-card-count">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button class="ppl-msg-btn" title="Message team" onclick="_pplMessageTeam('${team.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
        </button>
        <svg class="ppl-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    `;
  }).join('');

  return `${header}<div class="ppl-team-grid">${cards}</div>`;
}

// ===== Team Detail View =====

function _pplBuildTeamDetail(teamId) {
  const team = (AppState.teams || []).find(t => t.id === teamId);
  if (!team) return `<div class="ppl-empty"><p>Team not found.</p></div>`;

  const allMembers = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const mIds = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const teamMembers = mIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);

  // Find tasks assigned to any member in this team
  const teamMemberIds = new Set(mIds);
  const teamTasks = tasks.filter(t => {
    if (!t.assignee_id) return false;
    const assignees = t.assignee_id.split(',').map(s => s.trim());
    return assignees.some(a => teamMemberIds.has(a));
  });

  const activeTasks = teamTasks.filter(t => t.status === 'in_progress');
  const plannedTasks = teamTasks.filter(t => t.status === 'planned');
  const doneTasks = teamTasks.filter(t => t.status === 'done');

  const memberCards = teamMembers.length > 0 ? teamMembers.map(m => {
    const initials = m.avatar_initials || m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const mTasks = tasks.filter(t => t.assignee_id && t.assignee_id.split(',').includes(m.id));
    const mActive = mTasks.filter(t => t.status !== 'done').length;
    return `
      <div class="ppl-member-card" onclick="_pplSwitchTab('members'); setTimeout(() => _pplOpenMember('${m.id}'), 50);">
        <div class="ppl-card-avatar" style="background: ${_pplAvatarColor(m.name)}">${escapeHtml(initials)}</div>
        <div class="ppl-card-body">
          <div class="ppl-card-name">${escapeHtml(m.name)}</div>
          <div class="ppl-card-role">${escapeHtml(m.role) || 'Member'}</div>
        </div>
        <div class="ppl-card-meta">
          <span class="ppl-card-stat">${mActive} active task${mActive !== 1 ? 's' : ''}</span>
        </div>
        <svg class="ppl-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
  }).join('') : '<span class="ppl-profile-none">No members in this team yet. Edit the team to add members.</span>';

  // Build task list
  const taskSection = (taskList, label, statusClass) => {
    if (taskList.length === 0) return '';
    const items = taskList.map(t => {
      const proj = projects.find(p => p.id === t.project_id);
      const projName = proj ? escapeHtml(proj.name) : '';
      const projColor = proj ? proj.color || '#14b8a6' : '#14b8a6';
      // Show which team members are assigned to this task
      const assigneeIds = t.assignee_id ? t.assignee_id.split(',').map(s => s.trim()) : [];
      const assignedMembers = assigneeIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);
      const assigneeNames = assignedMembers.map(m => escapeHtml(m.name)).join(', ');
      return `
        <div class="ppl-profile-task">
          <div class="ppl-profile-task-status ${statusClass}"></div>
          <div class="ppl-profile-task-info">
            <span class="ppl-profile-task-title">${escapeHtml(t.title)}</span>
            ${projName ? `<span class="ppl-profile-task-project" style="color: ${projColor}">${projName}</span>` : ''}
            ${assigneeNames ? `<span class="ppl-profile-task-assignees">${assigneeNames}</span>` : ''}
          </div>
          <span class="ppl-profile-task-dates">${t.start_date || ''} &rarr; ${t.end_date || ''}</span>
        </div>
      `;
    }).join('');
    return `
      <div class="ppl-profile-task-group">
        <h4 class="ppl-profile-task-group-label">${label} <span class="ppl-profile-task-count">${taskList.length}</span></h4>
        ${items}
      </div>
    `;
  };

  return `
    <div class="ppl-profile">
      <button class="ppl-back-btn" onclick="_pplBackToTeams()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All Teams
      </button>

      <div class="ppl-profile-layout">
        <!-- Left: Team Info -->
        <div class="ppl-profile-sidebar">
          <div class="ppl-profile-card">
            <div class="ppl-team-detail-icon" style="background: ${team.color || '#14b8a6'}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                <circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/>
              </svg>
            </div>
            <h2 class="ppl-profile-name">${escapeHtml(team.name)}</h2>
            ${team.description ? `<span class="ppl-profile-role">${escapeHtml(team.description)}</span>` : ''}

            <div class="ppl-profile-fields" style="margin-top: 12px;">
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                  Members
                </label>
                <span class="ppl-profile-field-value">${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                  Tasks
                </label>
                <span class="ppl-profile-field-value">${teamTasks.length} task${teamTasks.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <button class="ppl-message-btn" onclick="_pplMessageTeam('${team.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Message Team
            </button>
            <button class="ppl-edit-btn" onclick="_pplOpenEditTeamModal('${team.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Team
            </button>
            <button class="ppl-delete-btn" onclick="_pplDeleteTeam('${team.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete Team
            </button>
          </div>
        </div>

        <!-- Right: Members + Tasks -->
        <div class="ppl-profile-main">
          <div class="ppl-profile-section">
            <h3 class="ppl-profile-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
              Members
              <span class="ppl-profile-task-count">${teamMembers.length}</span>
            </h3>
            <div class="ppl-member-list" style="border:none; background:none;">${memberCards}</div>
          </div>

          <div class="ppl-profile-section">
            <h3 class="ppl-profile-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Tasks
              <span class="ppl-profile-task-count">${teamTasks.length}</span>
            </h3>
            <div class="ppl-profile-tasks">
              ${taskSection(activeTasks, 'In Progress', 'status-progress')}
              ${taskSection(plannedTasks, 'Planned', 'status-planned')}
              ${taskSection(doneTasks, 'Completed', 'status-done')}
              ${teamTasks.length === 0 ? '<span class="ppl-profile-none">No tasks assigned to team members</span>' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===== Create Team Modal =====

function _pplOpenCreateTeamModal() {
  const members = AppState.timelineTeamMembers || [];

  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const initials = m.avatar_initials || m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    return `<label class="tl-assignee-chip">
      <input type="checkbox" name="ppl-team-members" value="${m.id}" onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar" style="background: ${_pplAvatarColor(m.name)}; color: white;">${escapeHtml(initials)}</span>
      <span class="tl-assignee-name">${escapeHtml(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No members yet. Add members first.</span>';

  const colorOptions = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'].map(c =>
    `<label class="ppl-color-option">
      <input type="radio" name="ppl-team-color" value="${c}" ${c === '#14b8a6' ? 'checked' : ''} hidden>
      <span class="ppl-color-swatch" style="background: ${c}" onclick="this.parentElement.querySelector('input').checked = true; document.querySelectorAll('.ppl-color-option').forEach(el => el.classList.remove('selected')); this.parentElement.classList.add('selected');"></span>
    </label>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Team Name</label>
      <input type="text" id="ppl-team-name" class="form-input" placeholder="e.g. Design Team, Class 10B...">
    </div>
    <div class="form-group">
      <label class="form-label">Description <span style="color: var(--text-muted); font-weight: 400;">(optional)</span></label>
      <input type="text" id="ppl-team-desc" class="form-input" placeholder="Brief description of this team...">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="ppl-color-grid">${colorOptions}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Members</label>
      <div class="tl-assignee-grid">${memberCheckboxes}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitCreateTeam()">Create Team</button>
  `;

  _tlShowModal(_tlModalShell('New Team', body, footer));
  // Pre-select first color
  setTimeout(() => {
    const first = document.querySelector('.ppl-color-option');
    if (first) first.classList.add('selected');
  }, 50);
}

async function _pplSubmitCreateTeam() {
  const name = document.getElementById('ppl-team-name')?.value?.trim();
  const description = document.getElementById('ppl-team-desc')?.value?.trim() || '';
  const colorRadio = document.querySelector('input[name="ppl-team-color"]:checked');
  const color = colorRadio ? colorRadio.value : '#14b8a6';
  const checkedBoxes = document.querySelectorAll('input[name="ppl-team-members"]:checked');
  const member_ids = Array.from(checkedBoxes).map(cb => cb.value).join(',');

  if (!name) { showNotification('Please enter a team name', 'warning'); return; }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/teams?user_uuid=${AppState.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color, member_ids })
    });
    if (!resp.ok) throw new Error('Failed to create team');
    closeTimelineModal();
    showNotification('Team created', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== Edit Team Modal =====

function _pplOpenEditTeamModal(teamId) {
  const team = (AppState.teams || []).find(t => t.id === teamId);
  if (!team) return;

  const members = AppState.timelineTeamMembers || [];
  const currentMemberIds = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);

  const memberCheckboxes = members.length > 0 ? members.map(m => {
    const initials = m.avatar_initials || m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const checked = currentMemberIds.includes(m.id) ? 'checked' : '';
    return `<label class="tl-assignee-chip ${checked ? 'selected' : ''}">
      <input type="checkbox" name="ppl-team-members" value="${m.id}" ${checked} onchange="this.parentElement.classList.toggle('selected', this.checked)">
      <span class="tl-assignee-avatar" style="background: ${_pplAvatarColor(m.name)}; color: white;">${escapeHtml(initials)}</span>
      <span class="tl-assignee-name">${escapeHtml(m.name)}</span>
    </label>`;
  }).join('') : '<span style="color: var(--text-muted); font-size: 0.8125rem;">No members yet.</span>';

  const colorOptions = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'].map(c =>
    `<label class="ppl-color-option ${c === (team.color || '#14b8a6') ? 'selected' : ''}">
      <input type="radio" name="ppl-team-color" value="${c}" ${c === (team.color || '#14b8a6') ? 'checked' : ''} hidden>
      <span class="ppl-color-swatch" style="background: ${c}" onclick="this.parentElement.querySelector('input').checked = true; document.querySelectorAll('.ppl-color-option').forEach(el => el.classList.remove('selected')); this.parentElement.classList.add('selected');"></span>
    </label>`
  ).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Team Name</label>
      <input type="text" id="ppl-team-name" class="form-input" value="${escapeHtml(team.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description <span style="color: var(--text-muted); font-weight: 400;">(optional)</span></label>
      <input type="text" id="ppl-team-desc" class="form-input" value="${escapeHtml(team.description || '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="ppl-color-grid">${colorOptions}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Members</label>
      <div class="tl-assignee-grid">${memberCheckboxes}</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitEditTeam('${team.id}')">Save Changes</button>
  `;

  _tlShowModal(_tlModalShell('Edit Team', body, footer));
}

async function _pplSubmitEditTeam(teamId) {
  const name = document.getElementById('ppl-team-name')?.value?.trim();
  const description = document.getElementById('ppl-team-desc')?.value?.trim() || '';
  const colorRadio = document.querySelector('input[name="ppl-team-color"]:checked');
  const color = colorRadio ? colorRadio.value : '#14b8a6';
  const checkedBoxes = document.querySelectorAll('input[name="ppl-team-members"]:checked');
  const member_ids = Array.from(checkedBoxes).map(cb => cb.value).join(',');

  if (!name) { showNotification('Please enter a team name', 'warning'); return; }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/teams/${teamId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color, member_ids })
    });
    if (!resp.ok) throw new Error('Failed to update team');
    closeTimelineModal();
    showNotification('Team updated', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function _pplDeleteTeam(teamId) {
  if (!confirm('Delete this team? Members will not be removed, only the group.')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/teams/${teamId}?user_uuid=${AppState.userId}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete team');
    showNotification('Team deleted', 'success');
    AppState.peopleSelectedTeam = null;
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}