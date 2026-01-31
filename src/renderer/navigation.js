// ============================================
// NAVIGATION MODULE
// View routing and rendering orchestration
// ============================================

const viewMeta = {
  dashboard: {
    title: 'Dashboard',
    subtitle: "Welcome back! Here's your overview."
  },
  documents: {
    title: 'Documents',
    subtitle: 'Manage and sync your cloud files.'
  },
  scheduling: {
    title: 'Messages',
    subtitle: 'Schedule and manage automated updates.'
  },
  calendar: {
    title: 'Calendar',
    subtitle: 'See scheduled messages by day.'
  },
  scheduleMessage: {
    title: 'Compose Message',
    subtitle: 'Draft a new update for your community.'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Configure platform connections and preferences.'
  }
};

// ===== Loading Overlay (full-page spinner) =====
function ensureLoadingOverlayStyles() {
  if (document.getElementById('loading-overlay-styles')) return;

  const style = document.createElement('style');
  style.id = 'loading-overlay-styles';
  style.textContent = `
    @keyframes cc_spin { to { transform: rotate(360deg); } }
    .cc-loading-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    }
    .cc-loading-card {
      background: white;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 12px;
      max-width: 80vw;
    }
    .cc-loading-spinner {
      width: 22px; height: 22px;
      border-radius: 999px;
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      animation: cc_spin 0.8s linear infinite;
      flex: 0 0 auto;
    }
    .cc-loading-text {
      font-size: 14px;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 60vw;
    }
  `;
  document.head.appendChild(style);
}

function showLoadingOverlay(text = 'Syncing…') {
  ensureLoadingOverlayStyles();

  let overlay = document.getElementById('cc-loading-overlay');
  if (overlay) {
    const t = overlay.querySelector('.cc-loading-text');
    if (t) t.textContent = text;
    return;
  }

  overlay = document.createElement('div');
  overlay.id = 'cc-loading-overlay';
  overlay.className = 'cc-loading-overlay';
  overlay.innerHTML = `
    <div class="cc-loading-card">
      <div class="cc-loading-spinner"></div>
      <div class="cc-loading-text"></div>
    </div>
  `;
  overlay.querySelector('.cc-loading-text').textContent = text;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('cc-loading-overlay');
  if (overlay) overlay.remove();
}

function navigateTo(view) {
  AppState.currentView = view;

  const content = document.getElementById('content');

  if (content) {
    content.style.opacity = '0';
    content.style.transform = 'translateY(10px)';
    content.style.transition = 'opacity 0.15s ease, transform 0.15s ease';

    setTimeout(() => {
      renderApp();

      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      });
    }, 150);
  } else {
    renderApp();
  }
}

function renderApp() {
  // Update Sidebar Active State
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.dataset.view === AppState.currentView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Header
  const currentMeta = viewMeta[AppState.currentView] || viewMeta.dashboard;

  const titleEl = document.getElementById('view-title');
  const subEl = document.getElementById('view-subtitle');

  if (titleEl) titleEl.textContent = currentMeta.title;
  if (subEl) subEl.textContent = currentMeta.subtitle;

  // Update message badge
  const messageBadge = document.getElementById('message-badge');
  if (messageBadge) {
    const pendingCount = (AppState.scheduledMessages || []).filter(m => m.status !== 'sent').length;
    if (pendingCount > 0) {
      messageBadge.textContent = pendingCount;
      messageBadge.style.display = 'block';
    } else {
      messageBadge.style.display = 'none';
    }
  }

  // Update user card
  if (typeof updateUserCard === 'function') {
    updateUserCard();
  }

  // Render the specific view
  switch (AppState.currentView) {
    case 'dashboard':
      if (typeof renderDashboard === 'function') renderDashboard();
      break;

    case 'documents':
      if (typeof renderDocuments === 'function') renderDocuments();
      break;

    case 'scheduling':
      if (typeof renderScheduling === 'function') renderScheduling();
      break;

    case 'calendar':
      if (typeof renderCalendar === 'function') renderCalendar();
      else {
        // fallback
        AppState.currentView = 'dashboard';
        if (typeof renderDashboard === 'function') renderDashboard();
      }
      break;

    case 'scheduleMessage':
      AppState.currentView = 'scheduling';
      if (typeof renderScheduling === 'function') renderScheduling();
      break;


    case 'settings':
      if (typeof renderSettings === 'function') renderSettings();
      break;

    default:
      AppState.currentView = 'dashboard';
      if (typeof renderDashboard === 'function') renderDashboard();
  }
}

async function refreshCurrentView() {
  showLoadingOverlay('Syncing…');
  showNotification('Refreshing...', 'info');

  const maybeAwait = async (fn) => {
    if (typeof fn !== 'function') return;
    const r = fn();
    if (r && typeof r.then === 'function') await r;
  };

  try {
    switch (AppState.currentView) {
      case 'documents': {
        showLoadingOverlay('Syncing documents…');

        const src = AppState.activeDocumentSource || 'onedrive';
        const nav = (AppState.documentNav && AppState.documentNav[src])
          ? AppState.documentNav[src]
          : { folderId: 'root' };

        await maybeAwait(() => window.refreshCloudDocs({
          source: src,
          folderId: nav.folderId || 'root'
        }));

        if (typeof renderDocuments === 'function') renderDocuments();
        break;
      }

      case 'scheduling': {
        showLoadingOverlay('Syncing chats and messages…');

        if (window.AzureVMAPI) {
          await maybeAwait(AzureVMAPI.refreshSubscribedChats);

          if (typeof AzureVMAPI.syncMessagesFromServer === 'function') {
            await maybeAwait(AzureVMAPI.syncMessagesFromServer);
          }
        }

        if (typeof renderScheduling === 'function') renderScheduling();
        break;
      }

      case 'calendar': {
        showLoadingOverlay('Syncing calendar…');

        if (window.AzureVMAPI && typeof AzureVMAPI.syncMessagesFromServer === 'function') {
          await maybeAwait(AzureVMAPI.syncMessagesFromServer);
        }

        if (typeof renderCalendar === 'function') renderCalendar();
        break;
      }

      case 'scheduleMessage': {
        showLoadingOverlay('Syncing chats…');

        if (window.AzureVMAPI) {
          await maybeAwait(AzureVMAPI.refreshSubscribedChats);
          if (typeof AzureVMAPI.syncMessagesFromServer === 'function') {
            await maybeAwait(AzureVMAPI.syncMessagesFromServer);
          }
        }

        if (typeof renderScheduleMessagePage === 'function') {
          renderScheduleMessagePage();
        }
        break;
      }

      case 'dashboard': {
        showLoadingOverlay('Syncing dashboard…');

        const tasks = [];

        if (typeof window.refreshCloudDocs === 'function') {
          const src = AppState.activeDocumentSource || 'onedrive';
          const nav = (AppState.documentNav && AppState.documentNav[src])
            ? AppState.documentNav[src]
            : { folderId: 'root' };

          tasks.push(Promise.resolve().then(() => window.refreshCloudDocs({
            source: src,
            folderId: nav.folderId || 'root'
          })));
        }

        if (window.AzureVMAPI && typeof AzureVMAPI.refreshSubscribedChats === 'function') {
          tasks.push(Promise.resolve().then(() => AzureVMAPI.refreshSubscribedChats()));
        }
        if (window.AzureVMAPI && typeof AzureVMAPI.syncMessagesFromServer === 'function') {
          tasks.push(Promise.resolve().then(() => AzureVMAPI.syncMessagesFromServer()));
        }

        await Promise.all(tasks.map(p => p.catch(err => console.warn('Refresh task failed:', err))));

        if (typeof renderDashboard === 'function') renderDashboard();
        else renderApp();

        break;
      }

      default: {
        renderApp();
      }
    }

    showNotification('Refreshed', 'success');
  } catch (err) {
    console.error('Refresh failed:', err);
    showNotification('Refresh failed: ' + (err?.message || String(err)), 'error');
  } finally {
    hideLoadingOverlay();
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.navigateTo = navigateTo;
  window.renderApp = renderApp;
  window.refreshCurrentView = refreshCurrentView;
}
