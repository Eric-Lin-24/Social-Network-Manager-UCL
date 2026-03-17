// ============================================
// CALENDAR PROJECTS
// Projects/tasks section, message sending for
// projects, and task tooltips
// ============================================
// -----------------------------------------------
// Projects & Tasks Section (from Timeline data)
// -----------------------------------------------
function _calBuildProjectsSection(isSelectionMode) {
  const workspaces = (typeof AppState !== 'undefined' && AppState.timelineWorkspaces) || [];
  const projects = (typeof AppState !== 'undefined' && AppState.timelineProjects) || [];
  const tasks = (typeof AppState !== 'undefined' && AppState.timelineTasks) || [];
  const members = (typeof AppState !== 'undefined' && AppState.timelineTeamMembers) || [];

  if (workspaces.length === 0 && projects.length === 0) return '';

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const groupedHTML = workspaces.map(ws => {
    const wsProjects = projects.filter(p => p.workspace_id === ws.id);
    if (wsProjects.length === 0) return '';

    const projectRows = wsProjects.map(proj => {
      const subtasks = tasks.filter(t => t.project_id === proj.id);
      const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
      const assigneeNames = assigneeIds.map(id => {
        const m = members.find(mm => mm.id === id);
        return m ? escapeHtml(m.name) : null;
      }).filter(Boolean);

      let dateRange = 'No subtasks';
      if (subtasks.length > 0) {
        let minS = subtasks[0].start_date, maxE = subtasks[0].end_date;
        for (const t of subtasks) {
          if (t.start_date < minS) minS = t.start_date;
          if (t.end_date > maxE) maxE = t.end_date;
        }
        const s = new Date(minS + 'T00:00:00');
        const e = new Date(maxE + 'T00:00:00');
        dateRange = `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      }

      const doneCount = subtasks.filter(t => t.status === 'done').length;
      const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

      let statusLabel = 'Empty';
      let statusColor = '#5a6480';
      if (subtasks.length > 0) {
        const ipCount = subtasks.filter(t => t.status === 'in_progress').length;
        if (doneCount === subtasks.length) { statusLabel = 'Completed'; statusColor = '#10b981'; }
        else if (ipCount > 0 || doneCount > 0) { statusLabel = 'In Progress'; statusColor = '#3b82f6'; }
        else { statusLabel = 'Planned'; statusColor = '#f59e0b'; }
      }

      return `
        <div class="cal-project-row" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-secondary);border-radius:12px;">
          <div style="width:6px;height:40px;border-radius:3px;background:${proj.color || ws.color};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:600;font-size:14px;color:var(--text-primary);">${escapeHtml(proj.name)}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">${statusLabel}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:4px;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--text-muted);">${dateRange}</span>
              ${subtasks.length > 0 ? `<span style="font-size:12px;color:var(--text-muted);">${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}</span>` : ''}
              ${assigneeNames.length > 0 ? `<span style="font-size:12px;color:var(--text-muted);">${assigneeNames.join(', ')}</span>` : ''}
            </div>
            ${subtasks.length > 0 ? `
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <div style="flex:1;height:4px;border-radius:2px;background:var(--bg-tertiary);overflow:hidden;"><div style="width:${progress}%;height:100%;border-radius:2px;background:${proj.color || ws.color};"></div></div>
                <span style="font-size:11px;color:var(--text-muted);">${progress}%</span>
              </div>
            ` : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="flex-shrink:0;display:flex;align-items:center;gap:6px;" onclick="sendMessageForProject('${proj.id}')" title="Send message to people assigned to this task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Message
          </button>
        </div>
      `;
    }).join('');

    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${ws.color};"></div>
          <h4 style="font-weight:600;font-size:14px;color:var(--text-primary);margin:0;">${escapeHtml(ws.name)}</h4>
          <span style="font-size:12px;color:var(--text-muted);">${wsProjects.length} task${wsProjects.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${projectRows}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  // Also include orphan projects (not assigned to any workspace)
  const orphanProjects = projects.filter(p => !workspaces.find(ws => ws.id === p.workspace_id));
  let orphanHTML = '';
  if (orphanProjects.length > 0) {
    const orphanRows = orphanProjects.map(proj => {
      const subtasks = tasks.filter(t => t.project_id === proj.id);
      const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
      const assigneeNames = assigneeIds.map(id => {
        const m = members.find(mm => mm.id === id);
        return m ? escapeHtml(m.name) : null;
      }).filter(Boolean);

      let dateRange = 'No subtasks';
      if (subtasks.length > 0) {
        let minS = subtasks[0].start_date, maxE = subtasks[0].end_date;
        for (const t of subtasks) {
          if (t.start_date < minS) minS = t.start_date;
          if (t.end_date > maxE) maxE = t.end_date;
        }
        const s = new Date(minS + 'T00:00:00');
        const e = new Date(maxE + 'T00:00:00');
        dateRange = `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      }

      return `
        <div class="cal-project-row" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-secondary);border-radius:12px;">
          <div style="width:6px;height:40px;border-radius:3px;background:${proj.color || '#6b7280'};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <span style="font-weight:600;font-size:14px;color:var(--text-primary);">${escapeHtml(proj.name)}</span>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${dateRange}${assigneeNames.length > 0 ? ' \u00b7 ' + assigneeNames.join(', ') : ''}</div>
          </div>
          <button class="btn btn-primary btn-sm" style="flex-shrink:0;display:flex;align-items:center;gap:6px;" onclick="sendMessageForProject('${proj.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Message
          </button>
        </div>
      `;
    }).join('');

    orphanHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:3px;background:#6b7280;"></div>
          <h4 style="font-weight:600;font-size:14px;color:var(--text-primary);margin:0;">Unassigned</h4>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">${orphanRows}</div>
      </div>
    `;
  }

  if (!groupedHTML && !orphanHTML) return '';

  return `
    <div class="card" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h3 class="font-semibold" style="margin:0;">Tasks</h3>
          <p class="text-sm text-muted" style="margin:2px 0 0;">Tasks from your workspaces. Click \u201cSend Message\u201d to message the assigned people.</p>
        </div>
      </div>
      ${groupedHTML}
      ${orphanHTML}
    </div>
  `;
}

// -----------------------------------------------
// Send Message for a Project (Task)
// Uses Gmail/Email by default, auto-pulls team member emails
// -----------------------------------------------
async function sendMessageForProject(projectId) {
  const projects = AppState.timelineProjects || [];
  const tasks = AppState.timelineTasks || [];
  const members = AppState.timelineTeamMembers || [];

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    if (typeof showNotification === 'function') showNotification('Project not found', 'error');
    return;
  }

  // Collect all assignee IDs from subtasks of this project
  const subtasks = tasks.filter(t => t.project_id === projectId);
  const assigneeIds = [...new Set(subtasks.flatMap(t => t.assignee_id ? t.assignee_id.split(',') : []).filter(Boolean))];
  const assigneeMembers = assigneeIds.map(id => members.find(m => m.id === id)).filter(Boolean);

  // Filter to only members who have an email address
  const membersWithEmail = assigneeMembers.filter(m => m.email && m.email.trim() !== '');

  // Auto-subscribe team member emails if not already subscribed
  if (membersWithEmail.length > 0 && typeof AzureVMAPI !== 'undefined') {
    try {
      await AzureVMAPI.syncTeamMemberEmails();
      // Refresh subscribed email users so we have the latest user_ids
      await AzureVMAPI.fetchSubscribedEmailUsers();
    } catch (err) {
      console.warn('Failed to sync team member emails:', err);
    }
  }

  // Match team members to subscribed email users by email address
  const subscribedEmailUsers = AppState.subscribedEmailUsers || [];
  const matchedRecipients = [];
  const unmatchedMembers = [];

  for (const member of membersWithEmail) {
    const memberEmail = member.email.toLowerCase().trim();
    const emailUser = subscribedEmailUsers.find(u =>
      (u.email_address || '').toLowerCase().trim() === memberEmail
    );
    if (emailUser) {
      matchedRecipients.push({
        userId: emailUser.user_id || '',
        chatId: emailUser.user_id || '',
        chatName: member.name + ' (' + member.email + ')',
        platform: 'email'
      });
    } else {
      unmatchedMembers.push(member);
    }
  }

  // Also note members without email
  const membersWithoutEmail = assigneeMembers.filter(m => !m.email || m.email.trim() === '');

  // Set compose channel to email
  AppState.composeChannel = 'email';

  // Store the prefill recipients in AppState for the scheduling page to pick up
  AppState.calendarPrefillRecipients = matchedRecipients;
  AppState.calendarPrefillProjectName = project.name;

  // Build notification message
  if (matchedRecipients.length > 0) {
    const names = matchedRecipients.map(r => r.chatName);
    let msg = `${matchedRecipients.length} email recipient${matchedRecipients.length !== 1 ? 's' : ''} matched: ${names.join(', ')}`;
    if (membersWithoutEmail.length > 0) {
      msg += `. ${membersWithoutEmail.length} member(s) have no email: ${membersWithoutEmail.map(m => m.name).join(', ')}`;
    }
    if (typeof showNotification === 'function') showNotification(msg, 'success');
  } else if (membersWithEmail.length > 0) {
    if (typeof showNotification === 'function') {
      showNotification(
        `Could not match emails for: ${membersWithEmail.map(m => m.name).join(', ')}. Recipients can be selected manually.`,
        'info'
      );
    }
  } else if (assigneeMembers.length > 0) {
    if (typeof showNotification === 'function') {
      showNotification(
        `No team members with email addresses found for: ${assigneeMembers.map(m => m.name).join(', ')}. Add emails in the People tab.`,
        'info'
      );
    }
  } else {
    if (typeof showNotification === 'function') {
      showNotification('No one is assigned to this task yet.', 'info');
    }
  }

  // Store project ID for highlighting task-span days on the calendar
  AppState.calendarHighlightProjectId = projectId;

  // Enter day selection mode on the calendar
  AppState.daySelectionMode = true;
  AppState.selectedScheduleDays = [];

  // Navigate to calendar if we're not already there
  if (AppState.currentView !== 'calendar') {
    navigateTo('calendar');
  } else {
    renderCalendar();
  }
}

// -----------------------------------------------
// Task Tooltip (hover on calendar task bars)
// -----------------------------------------------
function _calShowTaskTooltip(event, taskId) {
  _calHideTaskTooltip();
  const tasks = AppState.timelineTasks || [];
  const projects = AppState.timelineProjects || [];
  const members = AppState.timelineTeamMembers || [];

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const project = projects.find(p => p.id === task.project_id);
  const assigneeIds = task.assignee_id ? task.assignee_id.split(',').filter(Boolean) : [];
  const assigneeNames = assigneeIds.map(id => {
    const m = members.find(mm => mm.id === id);
    return m ? escapeHtml(m.name) : null;
  }).filter(Boolean);

  const statusMap = { done: 'Completed', in_progress: 'In Progress', planned: 'Planned' };
  const statusLabel = statusMap[task.status] || task.status || 'Unknown';

  const tooltip = document.createElement('div');
  tooltip.id = 'cal-task-tooltip';
  tooltip.className = 'cal-task-tooltip';
  tooltip.innerHTML = `
    <div class="cal-task-tooltip-title">${escapeHtml(task.title)}</div>
    ${project ? `<div class="cal-task-tooltip-project" style="color:${project.color};">${escapeHtml(project.name)}</div>` : ''}
    <div class="cal-task-tooltip-meta">
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${escapeHtml(task.start_date)} → ${escapeHtml(task.end_date)}
      </span>
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${task.hours_per_week || 0}h/week · ${statusLabel}
      </span>
      ${assigneeNames.length > 0 ? `<span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 19c0-4-3.5-7-8-7s-8 3-8 7"/></svg>
        ${assigneeNames.join(', ')}
      </span>` : ''}
      ${task.description ? `<span style="margin-top:2px;opacity:0.8;">${escapeHtml(task.description.length > 120 ? task.description.substring(0,120) + '...' : task.description)}</span>` : ''}
    </div>
  `;

  document.body.appendChild(tooltip);

  // Position near cursor
  const rect = tooltip.getBoundingClientRect();
  const x = Math.min(event.clientX + 12, window.innerWidth - rect.width - 16);
  const y = Math.min(event.clientY - 8, window.innerHeight - rect.height - 16);
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = Math.max(8, y) + 'px';
}

function _calHideTaskTooltip() {
  const existing = document.getElementById('cal-task-tooltip');
  if (existing) existing.remove();
}
