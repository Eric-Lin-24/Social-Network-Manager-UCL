// Helper Functions Module
// Contains utility functions for document management, subscribed chats, and help guide

/**
 * Get human-readable recipient name from target_user_id
 * @param {string|string[]} targetUserId - The target user ID(s)
 * @returns {string} Human-readable name or the user_id if not found
 */
function getRecipientName(targetUserId) {
  if (!targetUserId) return 'Unknown';

  // Handle array of user IDs
  if (Array.isArray(targetUserId)) {
    const names = targetUserId.map(id => {
      const chat = (AppState.subscribedChats || []).find(c => c.user_id === id);
      return chat ? (chat.name || chat.chat_name || id) : id;
    });
    return names.join(', ');
  }

  // Handle single user ID
  const chat = (AppState.subscribedChats || []).find(c => c.user_id === targetUserId);
  if (chat) {
    return chat.name || chat.chat_name || targetUserId;
  }

  return targetUserId;
}

/**
 * Switch between document sources (OneDrive or Google Drive)
 * @param {string} source - Document source ('onedrive' or 'googledrive')
 */
function switchDocumentSource(source) {
  if (source === 'googledrive' && !AppState.googleDriveConnected) {
    showNotification('Please connect to Google Drive first in Settings', 'warning');
    navigateTo('settings');
    return;
  }

  if (source === 'onedrive' && !AppState.isAuthenticated) {
    showNotification('Please sign in with Microsoft 365 first in Settings', 'warning');
    navigateTo('settings');
    return;
  }

  AppState.activeDocumentSource = source;

  // Just re-render to show the filtered documents
  renderDocuments();

  // Auto-sync if no documents from this source exist yet
  const hasSourceDocs = AppState.documents.some(d => d.source === source);
  if (!hasSourceDocs) {
    if (source === 'onedrive') {
      refreshOneDriveDocs();
    } else if (source === 'googledrive') {
      refreshGoogleDriveDocs();
    }
  }
}

/**
 * Refresh cloud documents based on active source
 */
async function refreshCloudDocs(opts = {}) {
  const source = opts.source || AppState.activeDocumentSource || 'onedrive';
  const folderId = opts.folderId || (AppState.documentNav?.[source]?.folderId) || 'root';

  try {
    // OneDrive (Graph)
    if (source === 'onedrive') {
      // IMPORTANT: update your OneDrive fetch to use folderId (root vs /items/{id}/children)
      const docs = await MicrosoftGraphAPI.getOneDriveFiles(folderId);
      AppState.documents = (AppState.documents || []).filter(d => (d.source || 'onedrive') !== 'onedrive')
        .concat(docs.map(d => ({ ...d, source: 'onedrive' })));
      AppState.lastSync.onedrive = new Date().toISOString();
    }

    // Google Drive
    if (source === 'googledrive') {
      // Ideally your Drive fetch supports folderId.
      // If not, keep folderId ignored until backend supports it.
      const docs = await GoogleDriveAPI.getGoogleDriveFiles(folderId);
      AppState.documents = (AppState.documents || []).filter(d => d.source !== 'googledrive')
        .concat(docs.map(d => ({ ...d, source: 'googledrive' })));
      AppState.lastSync.googledrive = new Date().toISOString();
    }

    showNotification('Documents synced', 'success');
  } catch (e) {
    console.error(e);
    showNotification('Sync failed: ' + (e?.message || e), 'error');
  }
}


/**
 * Refresh OneDrive documents
 */
async function refreshOneDriveDocs() {
  if (!AppState.isAuthenticated) {
    showNotification('Please sign in with Microsoft 365 first', 'warning');
    return;
  }

  showNotification('Syncing OneDrive files...', 'info');

  try {
    const files = await MicrosoftGraphAPI.getOneDriveFiles();

    // Remove old OneDrive files and add new ones
    AppState.documents = AppState.documents.filter(d => d.source !== 'onedrive');
    AppState.documents.push(...files);

    renderDocuments();
    showNotification(`Synced ${files.length} files from OneDrive`, 'success');
  } catch (error) {
    console.error('Error syncing OneDrive:', error);
    showNotification('Failed to sync OneDrive files', 'error');
  }
}

/**
 * Refresh Google Drive documents
 */
async function refreshGoogleDriveDocs() {
  if (!AppState.googleDriveConnected) {
    showNotification('Please connect to Google Drive first', 'warning');
    return;
  }

  showNotification('Syncing Google Drive files...', 'info');

  try {
    const files = await GoogleDriveAPI.getGoogleDriveFiles();

    // Remove old Google Drive files and add new ones
    AppState.documents = AppState.documents.filter(d => d.source !== 'googledrive');
    AppState.documents.push(...files);

    renderDocuments();
    showNotification(`Synced ${files.length} files from Google Drive`, 'success');
  } catch (error) {
    console.error('Error syncing Google Drive:', error);
    showNotification('Failed to sync Google Drive files', 'error');
  }
}

/**
 * Initialize subscribed chats on app startup
 * Loads Azure VM URL and fetches subscribed chats if available
 */
async function initializeSubscribedChats() {
  // Try to load Azure VM URL from localStorage
  const savedAzureUrl = localStorage.getItem('azureVmUrl');
  if (savedAzureUrl) {
    AppState.azureVmUrl = savedAzureUrl;

    // Attempt to fetch subscribed chats in background
    try {
      await AzureVMAPI.fetchSubscribedChats();
      console.log('Subscribed chats loaded:', AppState.subscribedChats.length);
    } catch (error) {
      console.warn('Could not load subscribed chats on init:', error.message);
    }
  }
}

/**
 * Show the help guide modal
 */
function showHelpGuide() {
  const modalHtml = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="if(event.target === this) closeHelpGuide()">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-3 bg-white bg-opacity-20 rounded-lg">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </div>
              <div>
                <h3 class="text-2xl font-bold text-white">Quick Start Guide</h3>
                <p class="text-blue-100 text-sm">Everything you need to get started</p>
              </div>
            </div>
            <button onclick="closeHelpGuide()" class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
          </div>
        </div>

        <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div class="space-y-6">
            <!-- Welcome Section -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 class="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Welcome to Community Curator!
              </h4>
              <p class="text-sm text-blue-800">
                This platform helps you manage documents, schedule messages, and collect responses from your community all in one place.
              </p>
            </div>

            <!-- Key Features -->
            <div>
              <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Key Features
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                      <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </div>
                    <div>
                      <h5 class="font-medium text-gray-800 mb-1">Documents</h5>
                      <p class="text-sm text-gray-600">Sync and manage SharePoint documents with search and filtering.</p>
                    </div>
                  </div>
                </div>

                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-green-50 rounded-lg flex-shrink-0">
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h6M5 21h14a2 2 0 002-2v-1a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8v1a2 2 0 01-2 2H5" />
                    </div>
                    <div>
                      <h5 class="font-medium text-gray-800 mb-1">Message Scheduling</h5>
                      <p class="text-sm text-gray-600">Schedule WhatsApp, SMS, and email messages to your community.</p>
                    </div>
                  </div>
                </div>

                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                      <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </div>
                    <div>
                      <h5 class="font-medium text-gray-800 mb-1">Microsoft Forms</h5>
                      <p class="text-sm text-gray-600">Create surveys and collect responses from community members.</p>
                    </div>
                  </div>
                </div>

                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-orange-50 rounded-lg flex-shrink-0">
                      <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0v-6" />
                    </div>
                    <div>
                      <h5 class="font-medium text-gray-800 mb-1">Dashboard</h5>
                      <p class="text-sm text-gray-600">Get an overview of all activities and upcoming tasks at a glance.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Getting Started Steps -->
            <div>
              <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Getting Started (3 Easy Steps)
              </h4>
              <div class="space-y-3">
                <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-1">Connect to Microsoft 365</h5>
                    <p class="text-sm text-gray-600 mb-2">Sign in with your Microsoft account to access SharePoint documents and Forms.</p>
                    <button onclick="closeHelpGuide(); navigateTo('settings');" class="text-sm text-blue-600 hover:text-blue-700 font-medium">Go to Settings →</button>
                  </div>
                </div>

                <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-1">Connect WhatsApp (Optional)</h5>
                    <p class="text-sm text-gray-600 mb-2">Link your WhatsApp Business account to start scheduling messages.</p>
                    <button onclick="closeHelpGuide(); navigateTo('settings');" class="text-sm text-blue-600 hover:text-blue-700 font-medium">Go to Settings →</button>
                  </div>
                </div>

                <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-1">Start Using Features</h5>
                    <p class="text-sm text-gray-600">Explore the dashboard, sync documents, schedule messages, or create forms!</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tips & Tricks -->
            <div>
              <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Quick Tips
              </h4>
              <div class="space-y-2">
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-sm text-gray-600">Use the <strong>Search</strong> and <strong>Filter</strong> options to quickly find documents and forms</p>
                </div>
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-sm text-gray-600">Click <strong>"Sync OneDrive"</strong> to refresh your documents from Microsoft 365</p>
                </div>
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-sm text-gray-600">Schedule messages in advance to automate your community communications</p>
                </div>
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-sm text-gray-600">View form responses in real-time to track community feedback</p>
                </div>
              </div>
            </div>

            <!-- Need More Help -->
            <div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
              <h4 class="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Need More Help?
              </h4>
              <p class="text-sm text-purple-800 mb-3">
                Access the Help button (?) in the top-right corner anytime to view this guide again.
              </p>
              <div class="flex gap-2">
                <a href="https://github.com/yourusername/community-curator" target="_blank" class="text-sm text-purple-700 hover:text-purple-900 font-medium flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Documentation
                </a>
                <span class="text-purple-300">•</span>
                <a href="#" onclick="alert('Contact support: support@communitycurator.org')" class="text-sm text-purple-700 hover:text-purple-900 font-medium">Contact Support</a>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button onclick="closeHelpGuide()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.id = 'help-guide-modal';
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
}

/**
 * Close the help guide modal
 */
function closeHelpGuide() {
  const modal = document.getElementById('help-guide-modal');
  if (modal) {
    modal.remove();
  }
}

// Export functions to global scope
if (typeof window !== 'undefined') {
  window.switchDocumentSource = switchDocumentSource;
  window.refreshCloudDocs = refreshCloudDocs;
  window.refreshOneDriveDocs = refreshOneDriveDocs;
  window.refreshGoogleDriveDocs = refreshGoogleDriveDocs;
  window.initializeSubscribedChats = initializeSubscribedChats;
  window.showHelpGuide = showHelpGuide;
  window.closeHelpGuide = closeHelpGuide;
}
