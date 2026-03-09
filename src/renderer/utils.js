// ============================================
// UTILITY FUNCTIONS
// Common helpers used across the application
// ============================================

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format a date string to locale date
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date string to locale time
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted time
 */
function formatTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a date string to locale date and time
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date and time
 */
function formatDateTime(dateString) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Escape HTML special characters (safe for inserting into HTML content)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for safe use inside inline onclick/attribute values
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {string} dateString - Date string
 * @returns {string} Relative time string
 */
function getRelativeTime(dateString) {
  if (!dateString) return '';

  const now = new Date();
  const date = new Date(dateString);
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  return formatDate(dateString);
}

/**
 * Pad a number to 2 digits
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Get start of day (midnight)
 * @param {Date} d
 * @returns {Date}
 */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Get end of day (23:59:59.999)
 * @param {Date} d
 * @returns {Date}
 */
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Get a local YYYY-MM-DD date key string
 * @param {Date} dateObj
 * @returns {string}
 */
function localDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Convert a Date to ISO date string (YYYY-MM-DD) in local time
 * @param {Date} date
 * @returns {string}
 */
function dateToLocalISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ============================================
// SHARED DRAFT STORAGE (localStorage per user)
// ============================================

function getDraftStorageKey() {
  return AppState.userId ? `message_drafts_${AppState.userId}` : 'message_drafts_guest';
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(getDraftStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts) {
  try {
    localStorage.setItem(getDraftStorageKey(), JSON.stringify(drafts || []));
  } catch (e) {
    console.warn('Failed to save drafts:', e);
  }
}

/**
 * Get human-readable recipient name from target_user_id
 * @param {string|string[]} targetUserId
 * @returns {string}
 */
function getRecipientName(targetUserId) {
  if (!targetUserId) return 'Unknown';

  if (Array.isArray(targetUserId)) {
    return targetUserId.map(id => {
      const chat = (AppState.subscribedChats || []).find(c => String(c.user_id) === String(id));
      if (chat) return chat.name || chat.chat_name || id;
      const emailUser = (AppState.subscribedEmailUsers || []).find(u => String(u.user_id) === String(id));
      if (emailUser) return emailUser.user_name || emailUser.email_address || id;
      return id;
    }).join(', ');
  }

  const chat = (AppState.subscribedChats || []).find(c => String(c.user_id) === String(targetUserId));
  if (chat) return chat.name || chat.chat_name || targetUserId;
  const emailUser = (AppState.subscribedEmailUsers || []).find(u => String(u.user_id) === String(targetUserId));
  if (emailUser) return emailUser.user_name || emailUser.email_address || targetUserId;
  return targetUserId || 'Unknown';
}

/**
 * Add days to a date (returns new Date)
 * @param {Date} date - The base date
 * @param {number} n - Number of days to add (can be negative)
 * @returns {Date} New date with days added
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.generateId = generateId;
  window.formatDate = formatDate;
  window.formatTime = formatTime;
  window.formatDateTime = formatDateTime;
  window.formatFileSize = formatFileSize;
  window.debounce = debounce;
  window.truncateText = truncateText;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.getRelativeTime = getRelativeTime;
  window.pad2 = pad2;
  window.startOfDay = startOfDay;
  window.endOfDay = endOfDay;
  window.localDateKey = localDateKey;
  window.dateToLocalISO = dateToLocalISO;
  window.getDraftStorageKey = getDraftStorageKey;
  window.loadDrafts = loadDrafts;
  window.saveDrafts = saveDrafts;
  window.getRecipientName = getRecipientName;
  window.addDays = addDays;
}