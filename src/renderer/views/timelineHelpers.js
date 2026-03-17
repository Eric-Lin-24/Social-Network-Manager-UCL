// ============================================
// TIMELINE HELPERS
// Date helpers, Gantt column generation,
// task positioning, and shared utilities
// ============================================
// ===== Date Helpers =====

function _tlParseDate(str) {
  const parts = str.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function _tlWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
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

function _tlFormatWeekSpan(startDate, endDate) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${months[startDate.getMonth()]} ${startDate.getDate()}-${endDate.getDate()}`;
  } else {
    return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;
  }
}

const MONTH_NAMES_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

// ===== User-Driven Lane Grouping =====
// Tasks are grouped into lanes (shared rows) based on user placement.
// Lane assignments are stored in AppState._ganttLanes[projectId][taskId] = laneIndex.
// Tasks with the same lane index share a grid row.

function _ganttGetLaneIndex(projectId, taskId) {
  if (!AppState._ganttLanes) AppState._ganttLanes = {};
  if (!AppState._ganttLanes[projectId]) AppState._ganttLanes[projectId] = {};
  const lanes = AppState._ganttLanes[projectId];
  if (lanes[taskId] === undefined) {
    // Assign a new lane — find max existing + 1
    const existing = Object.values(lanes);
    lanes[taskId] = existing.length > 0 ? Math.max(...existing) + 1 : 0;
  }
  return lanes[taskId];
}

function _ganttSetLaneIndex(projectId, taskId, laneIdx) {
  if (!AppState._ganttLanes) AppState._ganttLanes = {};
  if (!AppState._ganttLanes[projectId]) AppState._ganttLanes[projectId] = {};
  AppState._ganttLanes[projectId][taskId] = laneIdx;
}

function _ganttNextLaneIndex(projectId) {
  if (!AppState._ganttLanes) AppState._ganttLanes = {};
  if (!AppState._ganttLanes[projectId]) AppState._ganttLanes[projectId] = {};
  const existing = Object.values(AppState._ganttLanes[projectId]);
  return existing.length > 0 ? Math.max(...existing) + 1 : 0;
}

function _ganttGroupByLane(taskList, projectId) {
  if (!taskList || taskList.length === 0) return [];

  // Ensure every task has a lane assignment
  for (const task of taskList) {
    _ganttGetLaneIndex(projectId, task.id);
  }

  // Group tasks by their lane index
  const laneMap = {};
  for (const task of taskList) {
    const idx = AppState._ganttLanes[projectId][task.id];
    if (!laneMap[idx]) laneMap[idx] = [];
    laneMap[idx].push(task);
  }

  // Return sorted by lane index
  const sortedKeys = Object.keys(laneMap).map(Number).sort((a, b) => a - b);
  return sortedKeys.map(k => ({ laneIdx: k, tasks: laneMap[k] }));
}

// ===== Gantt Column Generation =====

function _ganttGetColumns() {
  const zoom = AppState.timelineZoom || 'week';
  const startDate = AppState.timelineStartDate
    ? _tlParseDate(AppState.timelineStartDate)
    : addDays(new Date(), -3);

  const columns = [];
  const todayISO = dateToLocalISO(new Date());

  if (zoom === 'day') {
    for (let i = 0; i < 35; i++) {
      const d = addDays(startDate, i);
      columns.push({
        start: new Date(d),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        label: String(d.getDate()),
        iso: dateToLocalISO(d),
        isToday: dateToLocalISO(d) === todayISO,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        month: d.getMonth(),
        year: d.getFullYear()
      });
    }
  } else if (zoom === 'month') {
    const ms = _tlMonthStart(startDate);
    for (let i = 0; i < 12; i++) {
      const m = new Date(ms);
      m.setMonth(m.getMonth() + i);
      const mEnd = new Date(m);
      mEnd.setMonth(mEnd.getMonth() + 1);
      mEnd.setDate(mEnd.getDate() - 1);
      mEnd.setHours(23, 59, 59, 999);
      columns.push({
        start: new Date(m),
        end: mEnd,
        label: _tlFormatMonthYear(m),
        iso: dateToLocalISO(m),
        isToday: new Date().getMonth() === m.getMonth() && new Date().getFullYear() === m.getFullYear(),
        month: m.getMonth(),
        year: m.getFullYear()
      });
    }
  } else {
    const ws = _tlWeekStart(startDate);
    for (let i = 0; i < 16; i++) {
      const w = addDays(ws, i * 7);
      const wEnd = addDays(w, 6);
      wEnd.setHours(23, 59, 59, 999);
      columns.push({
        start: new Date(w),
        end: wEnd,
        label: _tlFormatWeekSpan(w, wEnd),
        iso: dateToLocalISO(w),
        isToday: todayISO >= dateToLocalISO(w) && todayISO <= dateToLocalISO(wEnd),
        month: w.getMonth(),
        year: w.getFullYear()
      });
    }
  }

  return columns;
}

function _ganttTaskSpan(task, columns) {
  const tStart = _tlParseDate(task.start_date);
  const tEnd = _tlParseDate(task.end_date);
  tEnd.setHours(23, 59, 59, 999);
  let startCol = -1, endCol = -1;
  for (let i = 0; i < columns.length; i++) {
    if (tStart <= columns[i].end && tEnd >= columns[i].start) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  return { startCol, endCol };
}

function _ganttTaskSegments(taskList, columns) {
  if (!taskList || taskList.length === 0) return [];

  const occupied = new Set();
  for (const task of taskList) {
    const span = _ganttTaskSpan(task, columns);
    if (span.startCol < 0 || span.endCol < 0) continue;
    for (let i = span.startCol; i <= span.endCol; i++) {
      occupied.add(i);
    }
  }

  const sorted = Array.from(occupied).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const segments = [];
  let startCol = sorted[0];
  let endCol = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === endCol + 1) {
      endCol = sorted[i];
      continue;
    }
    segments.push({ startCol, endCol });
    startCol = sorted[i];
    endCol = sorted[i];
  }
  segments.push({ startCol, endCol });
  return segments;
}

// Returns column span PLUS proportional pixel margins so bars
// accurately reflect the task's real duration within each column.
function _ganttTaskPosition(task, columns, colWidth) {
  const tStart = _tlParseDate(task.start_date);
  const tEnd   = _tlParseDate(task.end_date);
  tEnd.setHours(23, 59, 59, 999);

  let startCol = -1, endCol = -1;
  for (let i = 0; i < columns.length; i++) {
    if (tStart <= columns[i].end && tEnd >= columns[i].start) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  if (startCol < 0) return { startCol: -1, endCol: -1, marginLeft: 0, marginRight: 0 };

  const msPerDay = 86400000;
  const startColData = columns[startCol];
  const endColData   = columns[endCol];

  // Days in start / end columns
  // Math.round on a (N-days - 1ms) difference naturally rounds to N (e.g. 6.9999→7 for weeks).
  const startColDays = Math.round((startColData.end - startColData.start) / msPerDay);
  const endColDays   = Math.round((endColData.end   - endColData.start)   / msPerDay);

  // Fraction into start column where task begins
  const clampedStart = new Date(Math.max(tStart.getTime(), startColData.start.getTime()));
  const daysIntoStart = Math.round((clampedStart - startColData.start) / msPerDay);
  const startFraction = daysIntoStart / startColDays;

  // Fraction into end column where task ends (inclusive day)
  // end timestamps are 23:59:59.999 so Math.round(X.9999) = X+1, giving the correct ceiling count.
  const clampedEnd = new Date(Math.min(tEnd.getTime(), endColData.end.getTime()));
  const daysIntoEnd = Math.round((clampedEnd - endColData.start) / msPerDay);
  const endFraction = daysIntoEnd / endColDays;

  let marginLeft  = Math.round(startFraction * colWidth);
  let marginRight = Math.round((1 - endFraction) * colWidth);

  // Guarantee a minimum visible width (8 px)
  const totalSpan = (endCol - startCol + 1) * colWidth;
  const barWidth  = totalSpan - marginLeft - marginRight;
  if (barWidth < 8) {
    marginRight = Math.max(0, totalSpan - marginLeft - 8);
  }

  return { startCol, endCol, marginLeft, marginRight };
}

function _ganttMonthSpans(columns) {
  const spans = [];
  let cur = { month: -1, year: -1, start: 0, count: 0 };
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.month !== cur.month || col.year !== cur.year) {
      if (cur.count > 0) spans.push({ ...cur });
      cur = { month: col.month, year: col.year, start: i, count: 1 };
    } else {
      cur.count++;
    }
  }
  if (cur.count > 0) spans.push(cur);
  return spans;
}

// ===== Auto-Status Helper =====

function _tlAutoStatus(startDate, endDate) {
  const today = dateToLocalISO(new Date());
  if (today < startDate) return 'planned';
  if (today > endDate) return 'done';
  return 'in_progress';
}

// ===== Team Toggle Helper =====
// When a team checkbox is toggled, auto-check/uncheck all its member checkboxes

function _tlToggleTeamMembers(teamCheckbox, memberCheckboxName) {
  const memberIds = (teamCheckbox.dataset.memberIds || '').split(',').filter(Boolean);
  const isChecked = teamCheckbox.checked;
  teamCheckbox.parentElement.classList.toggle('selected', isChecked);

  memberIds.forEach(id => {
    const cb = document.querySelector(`input[name="${memberCheckboxName}"][value="${id}"]`);
    if (cb) {
      cb.checked = isChecked;
      cb.parentElement.classList.toggle('selected', isChecked);
    }
  });
}
