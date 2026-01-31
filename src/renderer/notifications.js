// Notifications and Theme Management Module
// Handles toast notifications and theme switching

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'success', 'error', 'warning')
 */
function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };

  const color = colors[type] || colors.info;

  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${color} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('animate-fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Initialize theme from localStorage
 * Called on app startup
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
}

/**
 * Apply a theme to the application
 * @param {string} theme - Theme to apply ('light', 'dark', 'auto')
 */
function applyTheme(theme) {
  const body = document.body;

  if (theme === 'dark') {
    body.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
  } else if (theme === 'light') {
    body.classList.remove('dark-mode');
    localStorage.setItem('theme', 'light');
  } else if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', 'auto');
  }
}

/**
 * Handle theme change event from settings
 * @param {Event} event - Change event from theme select
 */
function handleThemeChange(event) {
  const theme = event.target.value;
  applyTheme(theme);
  showNotification(`Theme changed to ${theme} mode`, 'success');
}

// Listen for system theme changes (for auto mode)
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });
}

// Export functions to global scope
if (typeof window !== 'undefined') {
  window.showNotification = showNotification;
  window.initializeTheme = initializeTheme;
  window.applyTheme = applyTheme;
  window.handleThemeChange = handleThemeChange;
}
