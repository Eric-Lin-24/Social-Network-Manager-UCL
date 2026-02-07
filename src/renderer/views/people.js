// ============================================
// CLASSES VIEW - Class-focused Dashboard
// Manage classes, assign students, view rosters,
// track attendance and grades per class.
// ============================================

// ===== State =====

if (!AppState.classesTab) AppState.classesTab = 'overview';
if (!AppState.classesSearchQuery) AppState.classesSearchQuery = '';
if (!AppState._classesInitialLoad) AppState._classesInitialLoad = false;
if (!AppState._classesExpandedId) AppState._classesExpandedId = null;

// Attendance state
if (!AppState._attendanceData) AppState._attendanceData = {};
if (!AppState._attendanceWeekOffset) AppState._attendanceWeekOffset = 0;
if (!AppState._attendanceClassFilter) AppState._attendanceClassFilter = '';

// Grade state
if (!AppState._gradesData) AppState._gradesData = {};
if (!AppState._gradeAssignments) AppState._gradeAssignments = [];

// ===== Helpers =====

function _clsEscape(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _clsDateToISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _clsParseDate(str) {
  const parts = str.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function _clsWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function _clsAddDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function _clsAvatarColor(name) {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function _clsTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

// Map students to classes via tasks: a student belongs to a class if they have a task in that class
function _clsGetClassStudents(classId) {
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];
  const studentIds = new Set();
  for (const t of tasks) {
    if (t.project_id === classId && t.assignee_id) {
      t.assignee_id.split(',').forEach(id => studentIds.add(id.trim()));
    }
  }
  return members.filter(m => studentIds.has(m.id));
}

// Get all students assigned to ANY class
function _clsGetAllAssignedStudents() {
  const tasks = AppState.timelineTasks || [];
  const ids = new Set();
  for (const t of tasks) {
    if (t.assignee_id) t.assignee_id.split(',').forEach(id => ids.add(id.trim()));
  }
  return ids;
}

// ===== Navigation =====

function _clsSetTab(tab) {
  AppState.classesTab = tab;
  renderPeople();
}

function _clsSearch(query) {
  AppState.classesSearchQuery = query;
  renderPeople();
}

function _clsExpandClass(classId) {
  AppState._classesExpandedId = AppState._classesExpandedId === classId ? null : classId;
  renderPeople();
}

// ===== OVERVIEW =====

function _clsBuildOverviewStats() {
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const todayISO = _clsDateToISO(new Date());

  const totalClasses = projects.length;
  const totalStudents = members.length;
  const activeLessons = tasks.filter(t => t.status === 'in_progress').length;
  const completedLessons = tasks.filter(t => t.status === 'done').length;
  const totalLessons = tasks.length;
  const overdueLessons = tasks.filter(t => t.end_date < todayISO && t.status !== 'done').length;

  return `
    <div class="cls-stats-row">
      <div class="cls-stat-pill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span class="cls-stat-pill-val">${totalClasses}</span>
        <span class="cls-stat-pill-label">Classes</span>
      </div>
      <div class="cls-stat-pill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
          <circle cx="17" cy="11" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96"/>
        </svg>
        <span class="cls-stat-pill-val">${totalStudents}</span>
        <span class="cls-stat-pill-label">Students</span>
      </div>
      <div class="cls-stat-pill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span class="cls-stat-pill-val">${activeLessons}<span class="cls-stat-pill-sub">/${totalLessons}</span></span>
        <span class="cls-stat-pill-label">Active Lessons</span>
      </div>
      <div class="cls-stat-pill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span class="cls-stat-pill-val">${completedLessons}</span>
        <span class="cls-stat-pill-label">Completed</span>
      </div>
      ${overdueLessons > 0 ? `
      <div class="cls-stat-pill cls-stat-pill--alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="cls-stat-pill-val">${overdueLessons}</span>
        <span class="cls-stat-pill-label">Overdue</span>
      </div>` : ''}
    </div>
  `;
}

function _clsBuildClassCards() {
  const projects = AppState.timelineProjects || [];
  const tasks = AppState.timelineTasks || [];
  const searchQ = (AppState.classesSearchQuery || '').toLowerCase();
  const todayISO = _clsDateToISO(new Date());
  const expandedId = AppState._classesExpandedId;

  let filtered = projects;
  if (searchQ) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQ));

  if (filtered.length === 0) {
    return `
      <div class="cls-empty">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-linecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <p>No classes found. Create a class in the Planner to get started.</p>
      </div>
    `;
  }

  return `<div class="cls-cards-grid">${filtered.map(project => {
    const classTasks = tasks.filter(t => t.project_id === project.id);
    const students = _clsGetClassStudents(project.id);
    const active = classTasks.filter(t => t.status === 'in_progress').length;
    const done = classTasks.filter(t => t.status === 'done').length;
    const planned = classTasks.filter(t => t.status === 'planned' || (!t.status || t.status === '')).length;
    const overdue = classTasks.filter(t => t.end_date < todayISO && t.status !== 'done').length;
    const color = project.color || '#14b8a6';
    const isExpanded = expandedId === project.id;

    // Progress bar
    const total = classTasks.length || 1;
    const donePct = (done / total) * 100;
    const activePct = (active / total) * 100;

    // Upcoming lesson
    const upcoming = classTasks
      .filter(t => t.start_date >= todayISO && t.status !== 'done')
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

    // Student avatars (max 5)
    const avatarHTML = students.slice(0, 5).map(s => {
      const ini = s.avatar_initials || s.name.substring(0, 2).toUpperCase();
      return `<div class="cls-card-avatar" style="background: ${_clsAvatarColor(s.name)}" title="${_clsEscape(s.name)}">${_clsEscape(ini)}</div>`;
    }).join('');
    const extraStudents = students.length > 5 ? `<div class="cls-card-avatar cls-card-avatar--extra">+${students.length - 5}</div>` : '';

    // Expanded detail: student list + lessons
    let expandedHTML = '';
    if (isExpanded) {
      const studentRowsHTML = students.length > 0 ? students.map(s => {
        const ini = s.avatar_initials || s.name.substring(0, 2).toUpperCase();
        const sTasks = classTasks.filter(t => t.assignee_id && t.assignee_id.includes(s.id));
        return `
          <div class="cls-detail-student">
            <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(s.name)}">${_clsEscape(ini)}</div>
            <div class="cls-detail-student-info">
              <span class="cls-detail-student-name">${_clsEscape(s.name)}</span>
              <span class="cls-detail-student-meta">${_clsEscape(s.role) || 'Student'} &middot; ${sTasks.length} lesson${sTasks.length !== 1 ? 's' : ''}</span>
            </div>
            <button class="cls-detail-remove-btn" onclick="event.stopPropagation(); _clsRemoveStudentFromClass('${s.id}', '${project.id}')" title="Remove from class">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }).join('') : '<p class="cls-detail-empty">No students assigned yet.</p>';

      const lessonRowsHTML = classTasks.slice(0, 8).map(t => {
        const statusDot = t.status === 'done' ? 'cls-dot--done' : t.status === 'in_progress' ? 'cls-dot--active' : 'cls-dot--planned';
        const isOverdue = t.end_date < todayISO && t.status !== 'done';
        return `
          <div class="cls-detail-lesson">
            <span class="cls-dot ${statusDot}"></span>
            <span class="cls-detail-lesson-name">${_clsEscape(t.title)}</span>
            <span class="cls-detail-lesson-dates">${t.start_date} &rarr; ${t.end_date}</span>
            ${isOverdue ? '<span class="cls-overdue-tag">OVERDUE</span>' : ''}
          </div>
        `;
      }).join('') || '<p class="cls-detail-empty">No lessons yet.</p>';

      expandedHTML = `
        <div class="cls-card-expanded">
          <div class="cls-detail-section">
            <div class="cls-detail-section-header">
              <h4>Students (${students.length})</h4>
              <button class="cls-detail-add-btn" onclick="event.stopPropagation(); _clsOpenAddStudentsModal('${project.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Students
              </button>
            </div>
            ${studentRowsHTML}
          </div>
          <div class="cls-detail-section">
            <div class="cls-detail-section-header">
              <h4>Lessons (${classTasks.length})</h4>
              <button class="cls-detail-add-btn" onclick="event.stopPropagation(); navigateTo('timeline');">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Plan Lesson
              </button>
            </div>
            ${lessonRowsHTML}
            ${classTasks.length > 8 ? `<p class="cls-detail-more">+ ${classTasks.length - 8} more lessons</p>` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="cls-card ${isExpanded ? 'cls-card--expanded' : ''}" onclick="_clsExpandClass('${project.id}')">
        <div class="cls-card-color-bar" style="background: ${color};"></div>
        <div class="cls-card-body">
          <div class="cls-card-header">
            <div class="cls-card-title-wrap">
              <h3 class="cls-card-title">${_clsEscape(project.name)}</h3>
              <span class="cls-card-subtitle">${classTasks.length} lesson${classTasks.length !== 1 ? 's' : ''} &middot; ${students.length} student${students.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="cls-card-actions">
              <button class="cls-card-action-btn" onclick="event.stopPropagation(); _clsOpenAddStudentsModal('${project.id}')" title="Add students">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
              </button>
              <button class="cls-card-action-btn" onclick="event.stopPropagation(); _clsExpandClass('${project.id}')" title="${isExpanded ? 'Collapse' : 'Expand'}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="transform: rotate(${isExpanded ? '180' : '0'}deg); transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          </div>

          <div class="cls-card-progress">
            <div class="cls-card-progress-bar">
              <div class="cls-card-progress-done" style="width: ${donePct}%;"></div>
              <div class="cls-card-progress-active" style="width: ${activePct}%;"></div>
            </div>
            <div class="cls-card-progress-labels">
              <span>${done} done</span>
              <span>${active} active</span>
              <span>${planned} planned</span>
              ${overdue > 0 ? `<span class="cls-card-overdue">${overdue} overdue</span>` : ''}
            </div>
          </div>

          <div class="cls-card-footer">
            <div class="cls-card-avatars">${avatarHTML}${extraStudents}</div>
            ${upcoming ? `<span class="cls-card-next">Next: ${_clsEscape(upcoming.title)}</span>` : ''}
          </div>
        </div>
        ${expandedHTML}
      </div>
    `;
  }).join('')}</div>`;
}

// ===== ADD STUDENTS TO CLASS MODAL =====

function _clsOpenAddStudentsModal(classId) {
  const project = (AppState.timelineProjects || []).find(p => p.id === classId);
  if (!project) return;

  const members = AppState.timelineTeamMembers || [];
  const existingStudents = _clsGetClassStudents(classId);
  const existingIds = new Set(existingStudents.map(s => s.id));

  if (members.length === 0) {
    const body = `
      <div class="cls-detail-empty" style="text-align: center; padding: 20px 0;">
        <p>No students exist yet. Add a student first.</p>
      </div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
      <button class="btn btn-primary" onclick="closeTimelineModal(); openCreateMemberModal(); AppState._classesReturnAfterModal = true;">New Student</button>
    `;
    _tlShowModal(_tlModalShell(`Add Students to ${_clsEscape(project.name)}`, body, footer));
    return;
  }

  const studentsHTML = members.map(m => {
    const ini = m.avatar_initials || m.name.substring(0, 2).toUpperCase();
    const isAssigned = existingIds.has(m.id);
    return `
      <label class="cls-student-check ${isAssigned ? 'cls-student-check--assigned' : ''}" for="cls-chk-${m.id}">
        <input type="checkbox" id="cls-chk-${m.id}" value="${m.id}" ${isAssigned ? 'checked' : ''} ${isAssigned ? 'disabled' : ''}>
        <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(m.name)}">${_clsEscape(ini)}</div>
        <div class="cls-student-check-info">
          <span class="cls-student-check-name">${_clsEscape(m.name)}</span>
          <span class="cls-student-check-role">${_clsEscape(m.role) || 'Student'}${isAssigned ? ' &middot; Already assigned' : ''}</span>
        </div>
      </label>
    `;
  }).join('');

  const body = `
    <div class="cls-add-students-list">${studentsHTML}</div>
    <div style="margin-top: 12px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
      <button class="cls-detail-add-btn" onclick="closeTimelineModal(); openCreateMemberModal(); AppState._classesReturnAfterModal = true;" style="width: 100%; justify-content: center;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create New Student
      </button>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_clsSubmitAddStudents('${classId}')">Add Selected</button>
  `;
  _tlShowModal(_tlModalShell(`Add Students to ${_clsEscape(project.name)}`, body, footer));
}

async function _clsSubmitAddStudents(classId) {
  const checkboxes = document.querySelectorAll('.cls-add-students-list input[type=checkbox]:checked:not(:disabled)');
  const selectedIds = Array.from(checkboxes).map(cb => cb.value);

  if (selectedIds.length === 0) {
    showNotification('No new students selected', 'warning');
    return;
  }

  // To "add a student to a class", we create a placeholder task in that class assigned to the student
  const project = (AppState.timelineProjects || []).find(p => p.id === classId);
  const todayISO = _clsDateToISO(new Date());
  const endISO = _clsDateToISO(_clsAddDays(new Date(), 7));

  let success = 0;
  for (const studentId of selectedIds) {
    try {
      const resp = await fetch(`${AppState.authenticationUrl}/timeline-tasks?user_uuid=${AppState.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${(AppState.timelineTeamMembers || []).find(m => m.id === studentId)?.name || 'Student'} - Enrolled`,
          project_id: classId,
          assignee_id: studentId,
          start_date: todayISO,
          end_date: endISO,
          status: 'planned',
          description: JSON.stringify({ notes: 'Auto-created enrolment record.', files: [] })
        })
      });
      if (resp.ok) success++;
    } catch (e) { /* continue */ }
  }

  closeTimelineModal();
  if (success > 0) {
    showNotification(`${success} student${success > 1 ? 's' : ''} added to ${_clsEscape(project?.name || 'class')}`, 'success');
    await timelineRefreshData();
    renderPeople();
  } else {
    showNotification('Failed to add students', 'error');
  }
}

async function _clsRemoveStudentFromClass(studentId, classId) {
  if (!confirm('Remove this student from the class? Their lessons in this class will be unassigned.')) return;

  const tasks = (AppState.timelineTasks || []).filter(t => t.project_id === classId && t.assignee_id && t.assignee_id.includes(studentId));

  for (const task of tasks) {
    try {
      const ids = task.assignee_id.split(',').map(s => s.trim()).filter(id => id !== studentId);
      await fetch(`${AppState.authenticationUrl}/timeline-tasks/${task.id}?user_uuid=${AppState.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: ids.join(',') || '' })
      });
    } catch (e) { /* continue */ }
  }

  showNotification('Student removed from class', 'success');
  await timelineRefreshData();
  renderPeople();
}

// ===== CLASS ROSTER VIEW =====

function _clsBuildRoster() {
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const tasks = AppState.timelineTasks || [];
  const searchQ = (AppState.classesSearchQuery || '').toLowerCase();
  const todayISO = _clsDateToISO(new Date());

  if (projects.length === 0) {
    return `<div class="cls-empty"><p>No classes found. Create a class in the Planner.</p></div>`;
  }

  const classesHTML = projects.map(project => {
    const color = project.color || '#14b8a6';
    const students = _clsGetClassStudents(project.id);
    const filteredStudents = searchQ ? students.filter(s => s.name.toLowerCase().includes(searchQ)) : students;
    const classTasks = tasks.filter(t => t.project_id === project.id);

    const studentsHTML = filteredStudents.map(s => {
      const ini = s.avatar_initials || s.name.substring(0, 2).toUpperCase();
      const sTasks = classTasks.filter(t => t.assignee_id && t.assignee_id.includes(s.id));
      const sDone = sTasks.filter(t => t.status === 'done').length;
      const sOverdue = sTasks.filter(t => t.end_date < todayISO && t.status !== 'done').length;

      const attKeys = Object.keys(AppState._attendanceData || {}).filter(k => k.startsWith(s.id + '_'));
      const attTotal = attKeys.length;
      const attPresent = attKeys.filter(k => AppState._attendanceData[k] === 'present').length;
      const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

      return `
        <div class="cls-roster-student-card">
          <div class="cls-roster-student-top">
            <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(s.name)}">${_clsEscape(ini)}</div>
            <div class="cls-roster-student-info">
              <span class="cls-roster-student-name">${_clsEscape(s.name)}</span>
              <span class="cls-roster-student-role">${_clsEscape(s.role) || 'Student'}</span>
            </div>
            <button class="cls-detail-remove-btn" onclick="_clsShowStudentMenu('${s.id}', event)" title="Actions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
          <div class="cls-roster-student-stats">
            <div class="cls-roster-mini-stat"><span class="cls-roster-mini-val">${sTasks.length}</span> Lessons</div>
            <div class="cls-roster-mini-stat"><span class="cls-roster-mini-val">${sDone}</span> Done</div>
            ${sOverdue > 0 ? `<div class="cls-roster-mini-stat cls-roster-mini-stat--alert"><span class="cls-roster-mini-val">${sOverdue}</span> Overdue</div>` : ''}
            ${attRate !== null ? `<div class="cls-roster-mini-stat"><span class="cls-roster-mini-val">${attRate}%</span> Attend.</div>` : ''}
          </div>
        </div>
      `;
    }).join('') || '<p class="cls-detail-empty" style="padding: 14px;">No students assigned to this class.</p>';

    return `
      <div class="cls-roster-class-section">
        <div class="cls-roster-class-header">
          <div class="cls-roster-class-color" style="background: ${color}"></div>
          <h3 class="cls-roster-class-name">${_clsEscape(project.name)}</h3>
          <span class="cls-roster-class-count">${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''}</span>
          <button class="cls-detail-add-btn" onclick="_clsOpenAddStudentsModal('${project.id}')" style="margin-left: auto;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Students
          </button>
        </div>
        <div class="cls-roster-students-grid">${studentsHTML}</div>
      </div>
    `;
  }).join('');

  // Unassigned students
  const assignedIds = _clsGetAllAssignedStudents();
  const unassigned = members.filter(m => !assignedIds.has(m.id));
  const unassignedSearch = searchQ ? unassigned.filter(s => s.name.toLowerCase().includes(searchQ)) : unassigned;

  let unassignedHTML = '';
  if (unassignedSearch.length > 0) {
    const uCards = unassignedSearch.map(s => {
      const ini = s.avatar_initials || s.name.substring(0, 2).toUpperCase();
      return `
        <div class="cls-roster-student-card cls-roster-student-card--unassigned">
          <div class="cls-roster-student-top">
            <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(s.name)}">${_clsEscape(ini)}</div>
            <div class="cls-roster-student-info">
              <span class="cls-roster-student-name">${_clsEscape(s.name)}</span>
              <span class="cls-roster-student-role">${_clsEscape(s.role) || 'Student'}</span>
            </div>
            <button class="cls-detail-remove-btn" onclick="_clsShowStudentMenu('${s.id}', event)" title="Actions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
          <div class="cls-roster-student-stats">
            <div class="cls-roster-mini-stat cls-roster-mini-stat--muted">Not assigned to any class</div>
          </div>
        </div>
      `;
    }).join('');

    unassignedHTML = `
      <div class="cls-roster-class-section cls-roster-class-section--unassigned">
        <div class="cls-roster-class-header">
          <div class="cls-roster-class-color" style="background: #6b7280"></div>
          <h3 class="cls-roster-class-name">Unassigned Students</h3>
          <span class="cls-roster-class-count">${unassignedSearch.length} student${unassignedSearch.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="cls-roster-students-grid">${uCards}</div>
      </div>
    `;
  }

  return classesHTML + unassignedHTML;
}

// ===== STUDENT CONTEXT MENU =====

function _clsShowStudentMenu(memberId, event) {
  event.stopPropagation();
  _clsHideStudentMenu();
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const menu = document.createElement('div');
  menu.id = 'cls-context-menu';
  menu.className = 'cls-context-menu';
  menu.innerHTML = `
    <button onclick="_clsEditStudent('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit Student
    </button>
    <button onclick="_clsViewStudentLessons('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      View in Planner
    </button>
    <button class="cls-menu-danger" onclick="_clsDeleteStudent('${memberId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Remove Student
    </button>
  `;

  const rect = event.target.closest('button').getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;

  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', _clsHideStudentMenu, { once: true }); }, 0);
}

function _clsHideStudentMenu() {
  const existing = document.getElementById('cls-context-menu');
  if (existing) existing.remove();
}

function _clsEditStudent(memberId) {
  _clsHideStudentMenu();
  const member = (AppState.timelineTeamMembers || []).find(m => m.id === memberId);
  if (!member) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="cls-edit-name" class="form-input" value="${_clsEscape(member.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Year Group / Role</label>
      <input type="text" id="cls-edit-role" class="form-input" value="${_clsEscape(member.role)}">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_clsSubmitEditStudent('${member.id}')">Save</button>
  `;
  _tlShowModal(_tlModalShell('Edit Student', body, footer));
}

async function _clsSubmitEditStudent(memberId) {
  const name = document.getElementById('cls-edit-name')?.value?.trim();
  const role = document.getElementById('cls-edit-role')?.value?.trim() || '';
  if (!name) { showNotification('Please enter a name', 'warning'); return; }

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role })
    });
    if (!resp.ok) throw new Error('Failed to update');
    closeTimelineModal();
    showNotification('Student updated', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

function _clsViewStudentLessons(memberId) {
  _clsHideStudentMenu();
  AppState.timelineFilterPerson = memberId;
  navigateTo('timeline');
}

async function _clsDeleteStudent(memberId) {
  _clsHideStudentMenu();
  if (!confirm('Remove this student? This cannot be undone.')) return;

  try {
    const resp = await fetch(`${AppState.authenticationUrl}/team-members/${memberId}?user_uuid=${AppState.userId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete');
    showNotification('Student removed', 'success');
    await timelineRefreshData();
    renderPeople();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== ATTENDANCE VIEW =====

function _clsBuildAttendance() {
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.classesSearchQuery || '').toLowerCase();
  const classFilter = AppState._attendanceClassFilter || '';

  let displayMembers = members;
  if (classFilter) {
    displayMembers = _clsGetClassStudents(classFilter);
  }
  if (searchQ) displayMembers = displayMembers.filter(m => m.name.toLowerCase().includes(searchQ));

  if (members.length === 0) {
    return `<div class="cls-empty"><p>No students added yet.</p></div>`;
  }

  const offset = AppState._attendanceWeekOffset || 0;
  const now = new Date();
  const baseStart = _clsWeekStart(now);
  const weekStart = _clsAddDays(baseStart, offset * 7);
  const days = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayISO = _clsDateToISO(new Date());

  for (let i = 0; i < 5; i++) {
    const d = _clsAddDays(weekStart, i);
    days.push({
      date: d,
      iso: _clsDateToISO(d),
      day: dayNames[i],
      dayNum: d.getDate(),
      month: months[d.getMonth()],
      isToday: _clsDateToISO(d) === todayISO,
      isFuture: _clsDateToISO(d) > todayISO
    });
  }

  const weekLabel = `${months[weekStart.getMonth()]} ${weekStart.getDate()} \u2013 ${months[_clsAddDays(weekStart, 4).getMonth()]} ${_clsAddDays(weekStart, 4).getDate()}`;

  const classFilterHTML = `
    <select class="cls-att-class-filter" onchange="AppState._attendanceClassFilter = this.value; renderPeople();">
      <option value="">All Students</option>
      ${projects.map(p => `<option value="${p.id}" ${classFilter === p.id ? 'selected' : ''}>${_clsEscape(p.name)}</option>`).join('')}
    </select>
  `;

  const dayHeaders = days.map(d => `
    <th class="att-day-header ${d.isToday ? 'att-day-today' : ''} ${d.isFuture ? 'att-day-future' : ''}">
      <span class="att-day-name">${d.day}</span>
      <span class="att-day-num">${d.month} ${d.dayNum}</span>
    </th>
  `).join('');

  const dayStatsHTML = days.map(d => {
    let present = 0, total = 0;
    for (const m of displayMembers) {
      const key = `${m.id}_${d.iso}`;
      const val = AppState._attendanceData[key];
      if (val) {
        total++;
        if (val === 'present') present++;
      }
    }
    const rate = total > 0 ? Math.round((present / total) * 100) : null;
    return `<td class="att-day-stat ${d.isToday ? 'att-stat-today' : ''}">
      ${rate !== null ? `<span class="att-stat-rate">${rate}%</span>` : '<span class="att-stat-empty">&mdash;</span>'}
    </td>`;
  }).join('');

  const rows = displayMembers.map(m => {
    const initials = m.avatar_initials || '??';
    const cells = days.map(d => {
      const key = `${m.id}_${d.iso}`;
      const val = AppState._attendanceData[key] || '';

      const presentActive = val === 'present' ? 'att-btn-active att-btn-present' : '';
      const lateActive = val === 'late' ? 'att-btn-active att-btn-late' : '';
      const absentActive = val === 'absent' ? 'att-btn-active att-btn-absent' : '';

      return `<td class="${d.isToday ? 'att-cell-today' : ''} ${d.isFuture ? 'att-cell-future' : ''}">
        <div class="att-btn-group">
          <button class="att-mark-btn ${presentActive}" onclick="_clsMarkAttendance('${m.id}', '${d.iso}', 'present')" title="Present">\u2713</button>
          <button class="att-mark-btn ${lateActive}" onclick="_clsMarkAttendance('${m.id}', '${d.iso}', 'late')" title="Late">\u23F0</button>
          <button class="att-mark-btn ${absentActive}" onclick="_clsMarkAttendance('${m.id}', '${d.iso}', 'absent')" title="Absent">\u2717</button>
        </div>
      </td>`;
    }).join('');

    const memberKeys = Object.keys(AppState._attendanceData).filter(k => k.startsWith(m.id + '_'));
    const memberTotal = memberKeys.length;
    const memberPresent = memberKeys.filter(k => AppState._attendanceData[k] === 'present').length;
    const memberRate = memberTotal > 0 ? Math.round((memberPresent / memberTotal) * 100) : null;

    return `<tr>
      <td class="cls-att-name-cell">
        <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(m.name)}">${_clsEscape(initials)}</div>
        <span class="cls-att-student-name">${_clsEscape(m.name)}</span>
      </td>
      ${cells}
      <td class="att-rate-cell">
        ${memberRate !== null ? `
          <span class="att-rate-badge ${memberRate >= 90 ? 'att-rate-good' : memberRate >= 70 ? 'att-rate-warn' : 'att-rate-bad'}">${memberRate}%</span>
        ` : '<span class="att-rate-badge att-rate-na">N/A</span>'}
      </td>
    </tr>`;
  }).join('');

  const quickMarkHTML = days.map(d => `
    <td class="${d.isToday ? 'att-cell-today' : ''}">
      <button class="att-mark-all-btn" onclick="_clsMarkAllAttendance('${d.iso}', 'present')" title="Mark all present">\u2713 All</button>
    </td>
  `).join('');

  return `
    <div class="att-controls">
      ${classFilterHTML}
      <div class="att-nav-group">
        <button class="tl-nav-btn" onclick="_clsAttendanceNav(-1)" title="Previous week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="att-week-label">${weekLabel}</span>
        <button class="tl-nav-btn" onclick="_clsAttendanceNav(1)" title="Next week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="tl-today-btn" onclick="AppState._attendanceWeekOffset = 0; renderPeople();">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
          This Week
        </button>
      </div>
    </div>
    <div class="cls-table-wrap">
      <table class="cls-att-table">
        <thead>
          <tr>
            <th class="cls-att-th-name">Student</th>
            ${dayHeaders}
            <th class="att-th-rate">Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr class="att-stats-row">
            <td style="font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);">DAILY RATE</td>
            ${dayStatsHTML}
            <td></td>
          </tr>
          <tr class="att-quick-row">
            <td style="font-size: 0.6875rem; font-weight: 600; color: var(--text-muted);">QUICK MARK</td>
            ${quickMarkHTML}
            <td></td>
          </tr>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function _clsMarkAttendance(memberId, dateISO, status) {
  const key = `${memberId}_${dateISO}`;
  if (AppState._attendanceData[key] === status) {
    delete AppState._attendanceData[key];
  } else {
    AppState._attendanceData[key] = status;
  }
  renderPeople();
}

function _clsMarkAllAttendance(dateISO, status) {
  const members = AppState.timelineTeamMembers || [];
  for (const m of members) {
    AppState._attendanceData[`${m.id}_${dateISO}`] = status;
  }
  renderPeople();
}

function _clsAttendanceNav(direction) {
  AppState._attendanceWeekOffset = (AppState._attendanceWeekOffset || 0) + direction;
  renderPeople();
}

// ===== GRADE TRACKER VIEW =====

function _clsBuildGrades() {
  const members = AppState.timelineTeamMembers || [];
  const searchQ = (AppState.classesSearchQuery || '').toLowerCase();
  const filtered = searchQ ? members.filter(m => m.name.toLowerCase().includes(searchQ)) : members;
  const assignments = AppState._gradeAssignments || [];

  if (members.length === 0) {
    return `<div class="cls-empty"><p>No students added yet.</p></div>`;
  }

  const addAssignmentBtn = `
    <button class="cls-detail-add-btn" onclick="_clsAddAssignment()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Assignment
    </button>
  `;

  if (assignments.length === 0) {
    return `
      <div class="cls-empty" style="gap: 16px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p>No assignments created yet.</p>
        ${addAssignmentBtn}
      </div>
    `;
  }

  const assignmentHeaders = assignments.map(a => `
    <th class="grade-assign-header" title="${_clsEscape(a.name)}">
      <div class="grade-assign-name">${_clsEscape(a.name)}</div>
      <div class="grade-assign-max">/ ${a.maxScore}</div>
      <button class="grade-remove-btn" onclick="event.stopPropagation(); _clsRemoveAssignment('${a.id}')" title="Remove">&times;</button>
    </th>
  `).join('');

  const rows = filtered.map(m => {
    const initials = m.avatar_initials || '??';
    const cells = assignments.map(a => {
      const key = `${m.id}_${a.id}`;
      const score = AppState._gradesData[key];
      const hasScore = score !== undefined && score !== null && score !== '';
      const pct = hasScore ? Math.round((score / a.maxScore) * 100) : null;
      const gradeClass = pct !== null ? (pct >= 80 ? 'grade-high' : pct >= 60 ? 'grade-mid' : pct >= 40 ? 'grade-low' : 'grade-fail') : '';

      return `<td class="grade-cell">
        <div class="grade-input-wrap ${gradeClass}">
          <input type="number" class="grade-input" value="${hasScore ? score : ''}"
            min="0" max="${a.maxScore}" placeholder="\u2014"
            onchange="_clsSetGrade('${m.id}', '${a.id}', this.value, ${a.maxScore})">
          ${pct !== null ? `<span class="grade-pct">${pct}%</span>` : ''}
        </div>
      </td>`;
    }).join('');

    const studentScores = assignments.map(a => {
      const key = `${m.id}_${a.id}`;
      const score = AppState._gradesData[key];
      return score !== undefined && score !== null && score !== '' ? { score: Number(score), max: a.maxScore } : null;
    }).filter(Boolean);

    const avgPct = studentScores.length > 0
      ? Math.round(studentScores.reduce((sum, s) => sum + (s.score / s.max) * 100, 0) / studentScores.length)
      : null;
    const avgClass = avgPct !== null ? (avgPct >= 80 ? 'grade-high' : avgPct >= 60 ? 'grade-mid' : avgPct >= 40 ? 'grade-low' : 'grade-fail') : '';

    return `<tr>
      <td class="cls-att-name-cell">
        <div class="cls-detail-avatar" style="background: ${_clsAvatarColor(m.name)}">${_clsEscape(initials)}</div>
        <span class="cls-att-student-name">${_clsEscape(m.name)}</span>
      </td>
      ${cells}
      <td class="grade-avg-cell">
        ${avgPct !== null ? `<span class="grade-avg-badge ${avgClass}">${avgPct}%</span>` : '<span class="att-rate-badge att-rate-na">N/A</span>'}
      </td>
    </tr>`;
  }).join('');

  const classAvgsHTML = assignments.map(a => {
    const scores = filtered.map(m => {
      const key = `${m.id}_${a.id}`;
      const s = AppState._gradesData[key];
      return s !== undefined && s !== null && s !== '' ? Number(s) : null;
    }).filter(v => v !== null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;
    const pct = avg !== null ? Math.round((avg / a.maxScore) * 100) : null;
    return `<td class="grade-class-avg">
      ${avg !== null ? `<span>${avg}/${a.maxScore} (${pct}%)</span>` : '<span style="color:var(--text-muted);">&mdash;</span>'}
    </td>`;
  }).join('');

  return `
    <div class="cls-grade-toolbar">
      ${addAssignmentBtn}
      <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="cls-table-wrap">
      <table class="cls-att-table grade-table">
        <thead>
          <tr>
            <th class="cls-att-th-name">Student</th>
            ${assignmentHeaders}
            <th class="grade-th-avg">Avg</th>
          </tr>
        </thead>
        <tbody>
          <tr class="grade-class-avg-row">
            <td style="font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);">CLASS AVG</td>
            ${classAvgsHTML}
            <td></td>
          </tr>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function _clsSetGrade(memberId, assignmentId, value, maxScore) {
  const key = `${memberId}_${assignmentId}`;
  if (value === '' || value === null || value === undefined) {
    delete AppState._gradesData[key];
  } else {
    AppState._gradesData[key] = Math.min(Math.max(0, Number(value)), maxScore);
  }
  renderPeople();
}

function _clsAddAssignment() {
  const body = `
    <div class="form-group">
      <label class="form-label">Assignment Name</label>
      <input type="text" id="grade-new-name" class="form-input" placeholder="e.g. Homework 3, Quiz 1, Final Exam">
    </div>
    <div class="form-group">
      <label class="form-label">Maximum Score</label>
      <input type="number" id="grade-new-max" class="form-input" value="100" min="1" max="1000">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeTimelineModal()">Cancel</button>
    <button class="btn btn-primary" onclick="_clsSubmitAssignment()">Add Assignment</button>
  `;
  _tlShowModal(_tlModalShell('New Assignment', body, footer));
}

function _clsSubmitAssignment() {
  const name = document.getElementById('grade-new-name')?.value?.trim();
  const maxScore = parseInt(document.getElementById('grade-new-max')?.value) || 100;
  if (!name) { showNotification('Please enter an assignment name', 'warning'); return; }

  const id = 'assign_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  AppState._gradeAssignments.push({ id, name, maxScore, date: _clsDateToISO(new Date()) });
  closeTimelineModal();
  showNotification('Assignment added', 'success');
  renderPeople();
}

function _clsRemoveAssignment(assignmentId) {
  if (!confirm('Remove this assignment and all its grades?')) return;
  AppState._gradeAssignments = AppState._gradeAssignments.filter(a => a.id !== assignmentId);
  const keysToDelete = Object.keys(AppState._gradesData).filter(k => k.endsWith('_' + assignmentId));
  keysToDelete.forEach(k => delete AppState._gradesData[k]);
  showNotification('Assignment removed', 'success');
  renderPeople();
}

// ===== TOOLBAR =====

function _clsBuildToolbar() {
  const tab = AppState.classesTab || 'overview';

  const tabNames = ['overview', 'roster', 'attendance', 'grades'];
  const tabLabels = ['Overview', 'Class Roster', 'Attendance', 'Grades'];
  const pillIndex = Math.max(0, tabNames.indexOf(tab));

  return `
    <div class="cls-header">
      <div class="cls-header-top">
        <h2 class="cls-page-title">Classes</h2>
        <div class="cls-header-actions">
          <div class="cls-search-wrap">
            <svg class="cls-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="cls-search-input" placeholder="Search..." value="${_clsEscape(AppState.classesSearchQuery || '')}" oninput="_clsSearch(this.value)">
          </div>
          <button class="tl-action-btn tl-action-btn--secondary" onclick="openCreateMemberModal(); AppState._classesReturnAfterModal = true;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            New Student
          </button>
        </div>
      </div>
      <div class="cls-header-tabs">
        <div class="tl-pill-group" data-count="${tabNames.length}">
          <div class="tl-pill-slider" style="--pill-index: ${pillIndex}; --pill-count: ${tabNames.length};"></div>
          ${tabNames.map((t, i) => `<button class="tl-pill-btn ${tab === t ? 'active' : ''}" onclick="_clsSetTab('${t}')">${tabLabels[i]}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ===== MAIN RENDER =====

async function renderPeople() {
  const content = document.getElementById('content');
  if (!content) return;

  if (!AppState._classesInitialLoad) {
    AppState._classesInitialLoad = true;
    content.innerHTML = `<div class="animate-slide-up" style="padding: 48px; text-align: center;"><p style="color: var(--text-muted);">Loading class data...</p></div>`;
    await timelineRefreshData();
  }

  const tab = AppState.classesTab || 'overview';
  const toolbar = _clsBuildToolbar();

  let body = '';
  if (tab === 'overview') {
    body = _clsBuildOverviewStats() + _clsBuildClassCards();
  } else if (tab === 'roster') {
    body = _clsBuildRoster();
  } else if (tab === 'attendance') {
    body = _clsBuildAttendance();
  } else if (tab === 'grades') {
    body = _clsBuildGrades();
  }

  content.innerHTML = `
    <div class="animate-slide-up cls-view">
      ${toolbar}
      <div class="cls-body">${body}</div>
    </div>
  `;
}

// ===== Global Exports =====

if (typeof window !== 'undefined') {
  window.renderPeople = renderPeople;
  window._clsSetTab = _clsSetTab;
  window._clsSearch = _clsSearch;
  window._clsExpandClass = _clsExpandClass;
  window._clsOpenAddStudentsModal = _clsOpenAddStudentsModal;
  window._clsSubmitAddStudents = _clsSubmitAddStudents;
  window._clsRemoveStudentFromClass = _clsRemoveStudentFromClass;
  window._clsShowStudentMenu = _clsShowStudentMenu;
  window._clsHideStudentMenu = _clsHideStudentMenu;
  window._clsEditStudent = _clsEditStudent;
  window._clsSubmitEditStudent = _clsSubmitEditStudent;
  window._clsViewStudentLessons = _clsViewStudentLessons;
  window._clsDeleteStudent = _clsDeleteStudent;
  window._clsMarkAttendance = _clsMarkAttendance;
  window._clsMarkAllAttendance = _clsMarkAllAttendance;
  window._clsAttendanceNav = _clsAttendanceNav;
  window._clsSetGrade = _clsSetGrade;
  window._clsAddAssignment = _clsAddAssignment;
  window._clsSubmitAssignment = _clsSubmitAssignment;
  window._clsRemoveAssignment = _clsRemoveAssignment;
}
