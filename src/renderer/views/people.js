// ============================================
// PEOPLE VIEW - Team Member Directory & Teams
// Displays all members as clickable cards;
// each card opens a full member profile page
// with editable fields and task/group info.
// Includes a Teams sub-page for creating and
// managing groups/classes of members.
// ============================================

// ===== People State =====
if (!AppState.peopleSearchQuery) AppState.peopleSearchQuery = '';
if (!AppState.peopleSelectedMember) AppState.peopleSelectedMember = null;
if (!AppState._peopleInitialLoad) AppState._peopleInitialLoad = false;
if (!AppState.peopleTab) AppState.peopleTab = 'members'; // 'members' | 'teams'
if (!AppState.peopleSelectedTeam) AppState.peopleSelectedTeam = null;
if (!AppState.peopleTeamSearch) AppState.peopleTeamSearch = '';

// ===== Helpers =====

function _pplEscape(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _pplAvatarColor(name) {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function _pplSearchMembers(query) {
  AppState.peopleSearchQuery = query;
  renderPeople();
}

function _pplSearchTeams(query) {
  AppState.peopleTeamSearch = query;
  renderPeople();
}

// ===== Tab Navigation =====

function _pplSwitchTab(tab) {
  AppState.peopleTab = tab;
  AppState.peopleSelectedMember = null;
  AppState.peopleSelectedTeam = null;
  renderPeople();
}

// ===== Member Navigation =====

function _pplOpenMember(memberId) {
  AppState.peopleSelectedMember = memberId;
  renderPeople();
}

function _pplBackToList() {
  AppState.peopleSelectedMember = null;
  renderPeople();
}

// ===== Team Navigation =====

function _pplOpenTeam(teamId) {
  AppState.peopleSelectedTeam = teamId;
  renderPeople();
}

function _pplBackToTeams() {
  AppState.peopleSelectedTeam = null;
  renderPeople();
}

// ===== Tab Bar Builder =====

function _pplBuildTabs() {
  const tab = AppState.peopleTab || 'members';
  return `
    <div class="ppl-tabs">
      <button class="ppl-tab ${tab === 'members' ? 'ppl-tab--active' : ''}" onclick="_pplSwitchTab('members')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>
        Members
      </button>
      <button class="ppl-tab ${tab === 'teams' ? 'ppl-tab--active' : ''}" onclick="_pplSwitchTab('teams')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/></svg>
        Teams
      </button>
    </div>
  `;
}

// ===== Member List View =====

function _pplBuildMemberList() {
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const searchQ = (AppState.peopleSearchQuery || '').toLowerCase();

  const filtered = searchQ
    ? members.filter(m =>
        m.name.toLowerCase().includes(searchQ) ||
        (m.role || '').toLowerCase().includes(searchQ) ||
        (m.email || '').toLowerCase().includes(searchQ)
      )
    : members;

  const header = `
    <div class="ppl-list-header">
      <div class="ppl-list-header-left">
        <h2 class="ppl-page-title">People</h2>
        <span class="ppl-member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="ppl-list-header-right">
        <div class="ppl-search-wrap">
          <svg class="ppl-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="ppl-search-input" placeholder="Search by name, role, or email..." value="${_pplEscape(AppState.peopleSearchQuery || '')}" oninput="_pplSearchMembers(this.value)">
        </div>
        <button class="ppl-add-btn" onclick="openCreateMemberModal(); AppState._peopleReturnAfterModal = true;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add member
        </button>
      </div>
    </div>
  `;

  if (filtered.length === 0) {
    const emptyMsg = searchQ
      ? 'No members match your search.'
      : 'No team members yet. Add your first member to get started.';
    return `${header}
      <div class="ppl-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
        </svg>
        <p>${emptyMsg}</p>
      </div>`;
  }

  const cards = filtered.map(m => {
    const initials = m.avatar_initials || m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
    const memberTasks = tasks.filter(t => t.assignee_id && t.assignee_id.split(',').includes(m.id));
    const activeTasks = memberTasks.filter(t => t.status !== 'done').length;

    // Find which projects/groups this member is part of (via their tasks)
    const memberProjectIds = [...new Set(memberTasks.map(t => t.project_id).filter(Boolean))];
    const memberProjects = memberProjectIds.map(pid => projects.find(p => p.id === pid)).filter(Boolean);

    // Find which teams this member belongs to
    const memberTeams = (AppState.teams || []).filter(team => {
      const ids = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      return ids.includes(m.id);
    });

    const groupTags = memberTeams.slice(0, 3).map(t =>
      `<span class="ppl-card-tag" style="--tag-color: ${t.color || '#14b8a6'}">${_pplEscape(t.name)}</span>`
    ).join('');
    const extraGroups = memberTeams.length > 3 ? `<span class="ppl-card-tag ppl-card-tag--more">+${memberTeams.length - 3}</span>` : '';

    return `
      <div class="ppl-member-card" onclick="_pplOpenMember('${m.id}')">
        <div class="ppl-card-avatar" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
        <div class="ppl-card-body">
          <div class="ppl-card-name">${_pplEscape(m.name)}</div>
          <div class="ppl-card-role">${_pplEscape(m.role) || 'Member'}</div>
          ${(m.email) ? `<div class="ppl-card-email">${_pplEscape(m.email)}</div>` : ''}
          <div class="ppl-card-tags">${groupTags}${extraGroups}</div>
        </div>
        <div class="ppl-card-meta">
          <span class="ppl-card-stat">${activeTasks} active task${activeTasks !== 1 ? 's' : ''}</span>
          <span class="ppl-card-capacity">${m.weekly_capacity_hours || 40}h/wk</span>
        </div>
        <svg class="ppl-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    `;
  }).join('');

  return `${header}<div class="ppl-member-list">${cards}</div>`;
}

// ===== Member Detail / Profile View =====

function _pplBuildMemberProfile(memberId) {
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) {
    return `<div class="ppl-empty"><p>Member not found.</p></div>`;
  }

  const tasks = (AppState.timelineTasks || []).filter(t => t.assignee_id && t.assignee_id.split(',').includes(memberId));
  const projects = AppState.timelineProjects || [];
  const workspaces = AppState.timelineWorkspaces || [];
  const initials = member.avatar_initials || member.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';

  // Teams this member belongs to
  const memberTeams = (AppState.teams || []).filter(team => {
    const ids = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    return ids.includes(memberId);
  });

  // Tasks grouped by status
  const activeTasks = tasks.filter(t => t.status === 'in_progress');
  const plannedTasks = tasks.filter(t => t.status === 'planned');
  const doneTasks = tasks.filter(t => t.status === 'done');

  // Build groups section (now shows teams instead of workspaces)
  const groupCards = memberTeams.length > 0
    ? memberTeams.map(t => `
        <div class="ppl-profile-group-card" style="cursor:pointer" onclick="_pplSwitchTab('teams'); setTimeout(() => _pplOpenTeam('${t.id}'), 50);">
          <div class="ppl-profile-group-dot" style="background: ${t.color || '#14b8a6'}"></div>
          <span>${_pplEscape(t.name)}</span>
        </div>
      `).join('')
    : '<span class="ppl-profile-none">Not assigned to any teams</span>';

  // Build task section per status
  const taskSection = (taskList, label, statusClass) => {
    if (taskList.length === 0) return '';
    const items = taskList.map(t => {
      const proj = projects.find(p => p.id === t.project_id);
      const projName = proj ? _pplEscape(proj.name) : '';
      const projColor = proj ? proj.color || '#14b8a6' : '#14b8a6';
      return `
        <div class="ppl-profile-task">
          <div class="ppl-profile-task-status ${statusClass}"></div>
          <div class="ppl-profile-task-info">
            <span class="ppl-profile-task-title">${_pplEscape(t.title)}</span>
            ${projName ? `<span class="ppl-profile-task-project" style="color: ${projColor}">${projName}</span>` : ''}
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
      <button class="ppl-back-btn" onclick="_pplBackToList()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All People
      </button>

      <div class="ppl-profile-layout">
        <!-- Left: Info Card -->
        <div class="ppl-profile-sidebar">
          <div class="ppl-profile-card">
            <div class="ppl-profile-avatar" style="background: ${_pplAvatarColor(member.name)}">${_pplEscape(initials)}</div>
            <h2 class="ppl-profile-name">${_pplEscape(member.name)}</h2>
            <span class="ppl-profile-role">${_pplEscape(member.role) || 'Member'}</span>

            <div class="ppl-profile-fields">
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Email
                </label>
                <span class="ppl-profile-field-value">${_pplEscape(member.email) || '<em class="ppl-not-set">Not set</em>'}</span>
              </div>
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Phone
                </label>
                <span class="ppl-profile-field-value">${_pplEscape(member.phone) || '<em class="ppl-not-set">Not set</em>'}</span>
              </div>
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Capacity
                </label>
                <span class="ppl-profile-field-value">${member.weekly_capacity_hours || 40}h / week</span>
              </div>
            </div>

            <button class="ppl-edit-btn" onclick="_pplOpenEditProfile('${member.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Profile
            </button>
            <button class="ppl-delete-btn" onclick="_pplDeleteMember('${member.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Remove Member
            </button>
          </div>

          <!-- Teams -->
          <div class="ppl-profile-section">
            <h3 class="ppl-profile-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/></svg>
              Teams
            </h3>
            <div class="ppl-profile-groups">${groupCards}</div>
          </div>
        </div>

        <!-- Right: Tasks -->
        <div class="ppl-profile-main">
          <div class="ppl-profile-section">
            <h3 class="ppl-profile-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Tasks
              <span class="ppl-profile-task-count">${tasks.length}</span>
            </h3>
            <div class="ppl-profile-tasks">
              ${taskSection(activeTasks, 'In Progress', 'status-progress')}
              ${taskSection(plannedTasks, 'Planned', 'status-planned')}
              ${taskSection(doneTasks, 'Completed', 'status-done')}
              ${tasks.length === 0 ? '<span class="ppl-profile-none">No tasks assigned</span>' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===== Edit Profile Modal =====

function _pplOpenEditProfile(memberId) {
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="ppl-edit-name" class="form-input" value="${_pplEscape(member.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <input type="text" id="ppl-edit-role" class="form-input" value="${_pplEscape(member.role)}" placeholder="e.g. Developer, Designer...">
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" id="ppl-edit-email" class="form-input" value="${_pplEscape(member.email || '')}" placeholder="e.g. sarah@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Phone</label>
      <input type="tel" id="ppl-edit-phone" class="form-input" value="${_pplEscape(member.phone || '')}" placeholder="e.g. +44 7700 900000">
    </div>
    <div class="form-group">
      <label class="form-label">Weekly Capacity (hours)</label>
      <input type="number" id="ppl-edit-capacity" class="form-input" value="${member.weekly_capacity_hours || 40}" min="1" max="80">
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_pplSubmitEditMember('${member.id}')">Save Changes</button>
  `;
  _tlShowModal(_tlModalShell('Edit Member', body, footer));
}

async function _pplSubmitEditMember(memberId) {
  const name = document.getElementById('ppl-edit-name')?.value?.trim();
  const role = document.getElementById('ppl-edit-role')?.value?.trim() || '';
  const email = document.getElementById('ppl-edit-email')?.value?.trim() || '';
  const phone = document.getElementById('ppl-edit-phone')?.value?.trim() || '';
  const capacity = parseInt(document.getElementById('ppl-edit-capacity')?.value) || 40;

  if (!name) { showNotification('Please enter a name', 'warning'); return; }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, email, phone, weekly_capacity_hours: capacity })
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

async function _pplDeleteMember(memberId) {
  if (!confirm('Remove this team member? This cannot be undone.')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete team member');
    showNotification('Team member removed', 'success');
    AppState.peopleSelectedMember = null;
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

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
          <input type="text" class="ppl-search-input" placeholder="Search teams..." value="${_pplEscape(AppState.peopleTeamSearch || '')}" oninput="_pplSearchTeams(this.value)">
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
      return `<div class="ppl-team-avatar-sm" style="background: ${_pplAvatarColor(m.name)}" title="${_pplEscape(m.name)}">${_pplEscape(initials)}</div>`;
    }).join('');
    const extraCount = memberCount > 5 ? `<div class="ppl-team-avatar-sm ppl-team-avatar-extra">+${memberCount - 5}</div>` : '';

    return `
      <div class="ppl-team-card" onclick="_pplOpenTeam('${team.id}')">
        <div class="ppl-team-card-color" style="background: ${team.color || '#14b8a6'}"></div>
        <div class="ppl-team-card-body">
          <div class="ppl-team-card-name">${_pplEscape(team.name)}</div>
          ${team.description ? `<div class="ppl-team-card-desc">${_pplEscape(team.description)}</div>` : ''}
          <div class="ppl-team-card-members">
            <div class="ppl-team-avatar-stack">${avatars}${extraCount}</div>
            <span class="ppl-team-card-count">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
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
        <div class="ppl-card-avatar" style="background: ${_pplAvatarColor(m.name)}">${_pplEscape(initials)}</div>
        <div class="ppl-card-body">
          <div class="ppl-card-name">${_pplEscape(m.name)}</div>
          <div class="ppl-card-role">${_pplEscape(m.role) || 'Member'}</div>
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
      const projName = proj ? _pplEscape(proj.name) : '';
      const projColor = proj ? proj.color || '#14b8a6' : '#14b8a6';
      // Show which team members are assigned to this task
      const assigneeIds = t.assignee_id ? t.assignee_id.split(',').map(s => s.trim()) : [];
      const assignedMembers = assigneeIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);
      const assigneeNames = assignedMembers.map(m => _pplEscape(m.name)).join(', ');
      return `
        <div class="ppl-profile-task">
          <div class="ppl-profile-task-status ${statusClass}"></div>
          <div class="ppl-profile-task-info">
            <span class="ppl-profile-task-title">${_pplEscape(t.title)}</span>
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
            <h2 class="ppl-profile-name">${_pplEscape(team.name)}</h2>
            ${team.description ? `<span class="ppl-profile-role">${_pplEscape(team.description)}</span>` : ''}

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
      <span class="tl-assignee-avatar" style="background: ${_pplAvatarColor(m.name)}; color: white;">${_pplEscape(initials)}</span>
      <span class="tl-assignee-name">${_pplEscape(m.name)}</span>
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
      <span class="tl-assignee-avatar" style="background: ${_pplAvatarColor(m.name)}; color: white;">${_pplEscape(initials)}</span>
      <span class="tl-assignee-name">${_pplEscape(m.name)}</span>
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
      <input type="text" id="ppl-team-name" class="form-input" value="${_pplEscape(team.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description <span style="color: var(--text-muted); font-weight: 400;">(optional)</span></label>
      <input type="text" id="ppl-team-desc" class="form-input" value="${_pplEscape(team.description || '')}">
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

  let body;
  const tab = AppState.peopleTab || 'members';

  if (tab === 'teams') {
    if (AppState.peopleSelectedTeam) {
      body = _pplBuildTeamDetail(AppState.peopleSelectedTeam);
    } else {
      body = _pplBuildTabs() + _pplBuildTeamList();
    }
  } else {
    // members tab
    if (AppState.peopleSelectedMember) {
      body = _pplBuildMemberProfile(AppState.peopleSelectedMember);
    } else {
      body = _pplBuildTabs() + _pplBuildMemberList();
    }
  }

  content.innerHTML = `<div class="animate-slide-up ppl-view">${body}</div>`;
}

// ===== Global Exports =====

if (typeof window !== 'undefined') {
  window.renderPeople = renderPeople;
  window._pplSearchMembers = _pplSearchMembers;
  window._pplSearchTeams = _pplSearchTeams;
  window._pplSwitchTab = _pplSwitchTab;
  window._pplOpenMember = _pplOpenMember;
  window._pplBackToList = _pplBackToList;
  window._pplOpenTeam = _pplOpenTeam;
  window._pplBackToTeams = _pplBackToTeams;
  window._pplOpenEditProfile = _pplOpenEditProfile;
  window._pplSubmitEditMember = _pplSubmitEditMember;
  window._pplDeleteMember = _pplDeleteMember;
  window._pplOpenCreateTeamModal = _pplOpenCreateTeamModal;
  window._pplSubmitCreateTeam = _pplSubmitCreateTeam;
  window._pplOpenEditTeamModal = _pplOpenEditTeamModal;
  window._pplSubmitEditTeam = _pplSubmitEditTeam;
  window._pplDeleteTeam = _pplDeleteTeam;
}
