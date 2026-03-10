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

function _pplAvatarColor(name) {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const _pplSearchMembers = debounce((query) => {
  AppState.peopleSearchQuery = query;
  renderPeople();
}, 150);

const _pplSearchTeams = debounce((query) => {
  AppState.peopleTeamSearch = query;
  renderPeople();
}, 150);

// ===== Message Helpers =====

/**
 * Navigate to the message composer with one or more recipients pre-selected.
 * Tries to match team member emails against subscribedEmailUsers;
 * falls back to constructing a recipient entry from the member data.
 */
function _pplMessageMember(memberId) {
  event && event.stopPropagation();
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) { showNotification('Member not found', 'error'); return; }
  if (!member.email) { showNotification('This member has no email set. Edit their profile to add one.', 'warning'); return; }
  _pplNavigateToComposer([member]);
}

function _pplMessageTeam(teamId) {
  event && event.stopPropagation();
  const team = (AppState.teams || []).find(t => t.id === teamId);
  if (!team) { showNotification('Team not found', 'error'); return; }
  const mIds = (team.member_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const allMembers = AppState.timelineTeamMembers || [];
  const teamMembers = mIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);
  const withEmail = teamMembers.filter(m => m.email);
  if (withEmail.length === 0) {
    showNotification('No team members have an email set.', 'warning');
    return;
  }
  _pplNavigateToComposer(withEmail);
}

function _pplNavigateToComposer(members) {
  const emailUsers = AppState.subscribedEmailUsers || [];
  const recipients = members.map(m => {
    // Try to match against subscribed email users
    const match = emailUsers.find(u =>
      (u.email_address && u.email_address.toLowerCase() === (m.email || '').toLowerCase()) ||
      (String(u.user_id) === String(m.id))
    );
    if (match) {
      return {
        userId: match.user_id,
        chatId: match.user_id,
        chatName: match.user_name || match.email_address || m.name,
        platform: 'email'
      };
    }
    // Fallback: construct from member data
    return {
      userId: m.email,
      chatId: m.email,
      chatName: m.name,
      platform: 'email'
    };
  });

  AppState.composeChannel = 'email';
  AppState.messagePrefillRecipients = recipients;
  AppState.schedulerFormState = null; // clear any stale form state
  navigateTo('scheduleMessage');
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
          <input type="text" class="ppl-search-input" placeholder="Search by name, role, or email..." value="${escapeHtml(AppState.peopleSearchQuery || '')}" oninput="_pplSearchMembers(this.value)">
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
      `<span class="ppl-card-tag" style="--tag-color: ${t.color || '#14b8a6'}">${escapeHtml(t.name)}</span>`
    ).join('');
    const extraGroups = memberTeams.length > 3 ? `<span class="ppl-card-tag ppl-card-tag--more">+${memberTeams.length - 3}</span>` : '';

    return `
      <div class="ppl-member-card" onclick="_pplOpenMember('${m.id}')">
        <div class="ppl-card-avatar" style="background: ${_pplAvatarColor(m.name)}">${escapeHtml(initials)}</div>
        <div class="ppl-card-body">
          <div class="ppl-card-name">${escapeHtml(m.name)}</div>
          <div class="ppl-card-role">${escapeHtml(m.role) || 'Member'}</div>
          ${(m.email) ? `<div class="ppl-card-email">${escapeHtml(m.email)}</div>` : ''}
          <div class="ppl-card-tags">${groupTags}${extraGroups}</div>
        </div>
        <div class="ppl-card-actions">
          <button class="ppl-msg-btn" title="Send message" onclick="_pplMessageMember('${m.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </button>
          <div class="ppl-card-meta">
            <span class="ppl-card-stat">${activeTasks} active task${activeTasks !== 1 ? 's' : ''}</span>
            <span class="ppl-card-capacity">${m.weekly_capacity_hours || 40}h/wk</span>
          </div>
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
          <span>${escapeHtml(t.name)}</span>
        </div>
      `).join('')
    : '<span class="ppl-profile-none">Not assigned to any teams</span>';

  // Build task section per status
  const taskSection = (taskList, label, statusClass) => {
    if (taskList.length === 0) return '';
    const items = taskList.map(t => {
      const proj = projects.find(p => p.id === t.project_id);
      const projName = proj ? escapeHtml(proj.name) : '';
      const projColor = proj ? proj.color || '#14b8a6' : '#14b8a6';
      return `
        <div class="ppl-profile-task">
          <div class="ppl-profile-task-status ${statusClass}"></div>
          <div class="ppl-profile-task-info">
            <span class="ppl-profile-task-title">${escapeHtml(t.title)}</span>
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
            <div class="ppl-profile-avatar" style="background: ${_pplAvatarColor(member.name)}">${escapeHtml(initials)}</div>
            <h2 class="ppl-profile-name">${escapeHtml(member.name)}</h2>
            <span class="ppl-profile-role">${escapeHtml(member.role) || 'Member'}</span>

            <div class="ppl-profile-fields">
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Email
                </label>
                <span class="ppl-profile-field-value">${escapeHtml(member.email) || '<em class="ppl-not-set">Not set</em>'}</span>
              </div>
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Phone
                </label>
                <span class="ppl-profile-field-value">${escapeHtml(member.phone) || '<em class="ppl-not-set">Not set</em>'}</span>
              </div>
              <div class="ppl-profile-field">
                <label class="ppl-profile-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Capacity
                </label>
                <span class="ppl-profile-field-value">${member.weekly_capacity_hours || 40}h / week</span>
              </div>
            </div>

            <button class="ppl-message-btn" onclick="_pplMessageMember('${member.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Send Message
            </button>
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
      <input type="text" id="ppl-edit-name" class="form-input" value="${escapeHtml(member.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <input type="text" id="ppl-edit-role" class="form-input" value="${escapeHtml(member.role)}" placeholder="e.g. Developer, Designer...">
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" id="ppl-edit-email" class="form-input" value="${escapeHtml(member.email || '')}" placeholder="e.g. sarah@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Phone</label>
      <input type="tel" id="ppl-edit-phone" class="form-input" value="${escapeHtml(member.phone || '')}" placeholder="e.g. +44 7700 900000">
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


// ===== Main Render =====

async function renderPeople() {
  const content = document.getElementById('content');
  if (!content) return;

  // Ensure data is loaded (reuse timeline fetchers)
  if (!AppState._peopleInitialLoad) {
    AppState._peopleInitialLoad = true;
    content.innerHTML = `<div class="animate-slide-up" style="padding: 48px; text-align: center;"><p style="color: var(--text-muted);">Loading team data...</p></div>`;
    if (typeof timelineRefreshData === 'function') {
      await timelineRefreshData();
    }
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
  window._pplMessageMember = _pplMessageMember;
  window._pplMessageTeam = _pplMessageTeam;
  window._pplNavigateToComposer = _pplNavigateToComposer;
}