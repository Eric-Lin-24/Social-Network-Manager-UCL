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
  const startColDays = Math.round((startColData.end - startColData.start) / msPerDay) + 1;
  const endColDays   = Math.round((endColData.end   - endColData.start)   / msPerDay) + 1;

  // Fraction into start column where task begins
  const clampedStart = new Date(Math.max(tStart.getTime(), startColData.start.getTime()));
  const daysIntoStart = Math.round((clampedStart - startColData.start) / msPerDay);
  const startFraction = daysIntoStart / startColDays;

  // Fraction into end column where task ends (inclusive day)
  const clampedEnd = new Date(Math.min(tEnd.getTime(), endColData.end.getTime()));
  const daysIntoEnd = Math.round((clampedEnd - endColData.start) / msPerDay) + 1;
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
