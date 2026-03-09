// ============================================
// CALENDAR STYLES
// Injected CSS for the calendar view
// ============================================
function ensureCalendarStyles() {
  if (document.getElementById('calendar-view-styles')) return;

  const style = document.createElement('style');
  style.id = 'calendar-view-styles';
  style.textContent = `
    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .cal-title {
      font-weight: 600;
      font-size: 16px;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
    }

    .cal-dow {
      font-size: 12px;
      color: var(--text-muted);
      padding: 0 6px;
      font-weight: 600;
    }

    .cal-cell {
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 10px;
      min-height: 84px;
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      user-select: none;
    }

    .cal-cell:hover {
      transform: translateY(-1px);
      border-color: var(--border-default);
      background: var(--bg-secondary);
    }

    .cal-cell.is-outside { opacity: 0.55; }

    .cal-cell.is-today {
      border-color: var(--accent-primary);
      background: var(--accent-primary-soft);
    }

    .cal-cell.is-selected {
      border: 2px solid var(--accent-primary);
      background: var(--accent-primary);
      box-shadow: 0 0 0 4px var(--accent-primary-soft), 0 6px 16px rgba(0,0,0,0.3);
      transform: scale(1.03);
      z-index: 2;
    }
    .cal-cell.is-selected .cal-daynum,
    .cal-cell.is-selected .cal-chip,
    .cal-cell.is-selected .text-muted {
      color: white !important;
      border-color: rgba(255,255,255,0.3) !important;
    }
    .cal-cell.is-selected .cal-badge {
      background: rgba(255,255,255,0.25);
      border-color: rgba(255,255,255,0.4);
      color: white;
    }

    .cal-cell.is-task-highlight {
      border-color: var(--cal-highlight-color, rgba(99, 102, 241, 0.6));
      border-width: 2px;
      background: var(--cal-highlight-bg, rgba(99, 102, 241, 0.15));
      box-shadow: inset 0 0 0 1px var(--cal-highlight-color, rgba(99, 102, 241, 0.3));
    }
    .cal-cell.is-task-highlight:hover {
      background: var(--cal-highlight-bg-hover, rgba(99, 102, 241, 0.22));
      box-shadow: inset 0 0 0 1px var(--cal-highlight-color, rgba(99, 102, 241, 0.5));
    }

    .cal-daynum {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .cal-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(0,0,0,0.06);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .cal-chip {
      display: block;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: rgba(0,0,0,0.03);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    .cal-chip.sent { opacity: 0.8; }

    .cal-chip.pending {
      border-color: rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.10);
    }

    .cal-footer-note {
      margin-top: 14px;
      font-size: 12px;
      color: var(--text-muted);
    }

    /* ---- Task Dots on Calendar ---- */
    .cal-task-dots {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
      position: absolute;
      top: 6px;
      right: 8px;
    }
    .cal-task-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      position: relative;
    }
    .cal-task-dot:hover {
      transform: scale(1.5);
      box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
      z-index: 5;
    }
    .cal-task-dot.is-done {
      opacity: 0.4;
    }
    .cal-task-dots-overflow {
      font-size: 9px;
      color: var(--text-muted);
      font-weight: 600;
      line-height: 1;
    }

    /* ---- Task Tooltip ---- */
    .cal-task-tooltip {
      position: fixed;
      z-index: 99999;
      background: var(--bg-primary);
      border: 1px solid var(--border-default);
      border-radius: 10px;
      padding: 10px 12px;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      pointer-events: none;
      animation: calTooltipIn 0.12s ease;
    }
    @keyframes calTooltipIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .cal-task-tooltip-title {
      font-weight: 700;
      font-size: 13px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .cal-task-tooltip-project {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .cal-task-tooltip-meta {
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .cal-task-tooltip-meta span {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* ---- Task rows in day modal ---- */
    .cal-task-row {
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cal-task-row-color {
      width: 4px;
      height: 36px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .cal-task-row-info {
      flex: 1;
      min-width: 0;
    }
    .cal-task-row-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .cal-task-row-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cal-task-row-status {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      flex-shrink: 0;
    }

    /* ---- Day Details Modal ---- */
    .cal-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    }

    .cal-modal {
      width: min(720px, 96vw);
      max-height: 86vh;
      overflow: auto;
      background: var(--bg-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      padding: 16px;
    }

    .cal-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .cal-modal-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
    }

    .cal-modal-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .cal-modal-close {
      border: none;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      cursor: pointer;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-primary);
    }

    .cal-modal-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }

    .cal-msg-row {
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .cal-msg-left {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cal-msg-topline {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .cal-pill {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      color: var(--text-muted);
      text-transform: lowercase;
    }

    .cal-pill.sent {
      border-color: rgba(34,197,94,0.35);
      background: rgba(34,197,94,0.10);
      color: var(--success);
    }

    .cal-pill.pending {
      border-color: rgba(245,158,11,0.35);
      background: rgba(245,158,11,0.10);
      color: var(--warning);
    }

    .cal-msg-text {
      font-size: 13px;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .cal-msg-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .cal-modal-footer {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .cal-msg-actions {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .cal-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-tertiary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.12s ease, border-color 0.12s ease;
    }

    .cal-icon-btn:hover {
      transform: translateY(-1px);
      border-color: var(--border-default);
    }

    .cal-icon-btn.danger {
      color: var(--error);
      border-color: rgba(239,68,68,0.35);
      background: rgba(239,68,68,0.08);
    }
  `;
  document.head.appendChild(style);
}