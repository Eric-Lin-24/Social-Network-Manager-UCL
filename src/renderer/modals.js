// Modal Management Module
// Handles modal creation, display, and interaction logic

// Store for cloud files selected for attachment
let selectedCloudFiles = [];

/**
 * Show a modal dialog
 * @param {string} type - Type of modal to show (e.g., 'newMessage')
 */
function showModal(type) {
  // Redirect to dedicated schedule message page instead of showing modal
  if (type === 'newMessage') {
    navigateTo('scheduleMessage');
    return;
  }

  let modalHtml = '';

  switch(type) {
    case 'newMessage_OLD':
      // Generate options for subscribed chats
      console.log('Generating chat options from:', AppState.subscribedChats); // Debug log

      const subscribedChatsOptions = AppState.subscribedChats.map((chat, index) => {
        // Robust field extraction
        const chatId = chat.id || chat.chat_id || `chat_${index}`;
        const chatName = chat.name || chat.chat_name || chatId;
        const platform = chat.platform || 'whatsapp';

        console.log(`Chat ${index}:`, { chatId, chatName, platform, raw: chat }); // Debug log

        return `<option value="${chatId}" data-platform="${platform}">${chatName} (${platform})</option>`;
      }).join('');

      console.log('Generated options HTML:', subscribedChatsOptions); // Debug log

      modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="if(event.target === this) hideModal()">
          <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 class="text-xl font-semibold mb-4">Schedule Message</h3>
            <form onsubmit="scheduleMessage(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Messaging Platform</label>
                <select
                  id="msg-platform"
                  required
                  onchange="toggleRecipientInput()"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="whatsapp" selected>WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <!-- Subscribed Chats Section -->
              <div id="subscribed-chats-section" class="mb-4">
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700">Subscribed Chats</label>
                  <button
                    type="button"
                    onclick="refreshSubscribedChatsInModal()"
                    class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    title="Refresh subscribed chats"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
                ${AppState.subscribedChats.length > 0 ? `
                  <select
                    id="msg-subscribed-chat"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    onchange="onSubscribedChatSelect()"
                  >
                    <option value="">-- Select from subscribed chats --</option>
                    ${subscribedChatsOptions}
                  </select>
                ` : `
                  <div class="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    ${AppState.azureVmUrl ? 'No subscribed chats found. Click refresh to load.' : 'Configure Azure VM URL in Settings to load subscribed chats.'}
                  </div>
                `}
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
                <input
                  type="text"
                  id="msg-recipient"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter recipient name or number"
                />
                <p class="text-xs text-gray-500 mt-1">Or select from subscribed chats above</p>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
                <textarea
                  id="msg-content"
                  rows="6"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter message content"
                ></textarea>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Attach Files (Optional)</label>

                <!-- File source tabs -->
                <div class="flex gap-2 mb-3">
                  <button
                    type="button"
                    onclick="switchFileSource('local')"
                    id="tab-local"
                    class="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white"
                  >
                    📁 Local Files
                  </button>
                  <button
                    type="button"
                    onclick="switchFileSource('cloud')"
                    id="tab-cloud"
                    class="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    ☁️ Cloud Storage
                  </button>
                </div>

                <!-- Local file upload -->
                <div id="local-file-section" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                  <input
                    type="file"
                    id="msg-attachments"
                    multiple
                    class="hidden"
                    onchange="handleFileSelect(event)"
                  />
                  <label for="msg-attachments" class="cursor-pointer block">
                    <div class="flex flex-col items-center justify-center">
                      <div class="p-3 bg-blue-100 rounded-full mb-3">
                        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p class="text-sm font-medium text-gray-700 mb-1">Click to upload from computer</p>
                      <p class="text-xs text-gray-500">PDF, DOC, Images (Max 10MB each)</p>
                    </div>
                  </label>
                </div>

                <!-- Cloud storage file picker -->
                <div id="cloud-file-section" class="hidden border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-sm font-medium text-gray-700">Select from Cloud Storage</p>
                    <button
                      type="button"
                      onclick="refreshCloudFilesForPicker()"
                      class="text-xs text-blue-600 hover:text-blue-700"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  <div id="cloud-file-list-picker" class="space-y-2">
                    <p class="text-sm text-gray-500 text-center py-4">Loading files...</p>
                  </div>
                </div>

                <!-- Selected files display -->
                <div id="file-list" class="mt-3 space-y-2"></div>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Schedule Date & Time</label>
                <input
                  type="datetime-local"
                  id="msg-schedule"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  onclick="hideModal()"
                  class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
    default:
      alert('Modal functionality coming soon: ' + type);
      return;
  }

  const modalContainer = document.createElement('div');
  modalContainer.id = 'modal-overlay';
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
}

/**
 * Hide the currently displayed modal
 */
function hideModal() {
  const modal = document.getElementById('modal-overlay');
  if (modal) {
    modal.remove();
  }

  // Clear cloud file selection
  selectedCloudFiles = [];
}

/**
 * Handle selection of a subscribed chat from dropdown
 * Populates recipient and platform fields
 */
function onSubscribedChatSelect() {
  const select = document.getElementById('msg-subscribed-chat');
  const recipientInput = document.getElementById('msg-recipient');
  const platformSelect = document.getElementById('msg-platform');

  if (select && recipientInput && select.value) {
    const selectedOption = select.options[select.selectedIndex];
    const chatId = select.value;
    const platform = selectedOption.getAttribute('data-platform') || 'whatsapp';

    // Find the chat object to get the full details
    const chat = AppState.subscribedChats.find(c => c.id === chatId);
    if (chat) {
      // Set recipient to chat name or ID
      recipientInput.value = chat.name || chat.id;

      // Set platform if it matches one of our options
      const platformLower = platform.toLowerCase();
      if (['whatsapp', 'sms', 'telegram', 'email'].includes(platformLower)) {
        platformSelect.value = platformLower;
      }
    }
  }
}

/**
 * Refresh subscribed chats in the modal
 */
async function refreshSubscribedChatsInModal() {
  try {
    showNotification('Refreshing subscribed chats...', 'info');
    await AzureVMAPI.fetchSubscribedChats();
    showNotification(`Loaded ${AppState.subscribedChats.length} subscribed chat(s)`, 'success');

    // Re-render the modal
    hideModal();
    showModal('newMessage');
  } catch (error) {
    showNotification('Failed to refresh: ' + error.message, 'error');
  }
}

/**
 * Toggle recipient input visibility (placeholder for platform-specific logic)
 */
function toggleRecipientInput() {
  // This can be expanded if needed for different platforms
  // For now, all platforms use the same recipient input
}

/**
 * Handle file selection from local file input
 * @param {Event} event - File input change event
 */
function handleFileSelect(event) {
  const files = event.target.files;
  const fileList = document.getElementById('file-list');

  if (!fileList) return;

  fileList.innerHTML = '';

  Array.from(files).forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow';
    fileItem.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="p-2 bg-blue-50 rounded-lg flex-shrink-0">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 truncate">${file.name}</p>
          <p class="text-xs text-gray-500 mt-0.5">${(file.size / 1024).toFixed(1)} KB</p>
        </div>
      </div>
      <button
        type="button"
        onclick="removeFile(${index})"
        class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
        title="Remove file"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    fileList.appendChild(fileItem);
  });
}

/**
 * Remove a file from local file selection
 * @param {number} index - Index of file to remove
 */
function removeFile(index) {
  const fileInput = document.getElementById('msg-attachments');
  if (!fileInput) return;

  const dt = new DataTransfer();
  const files = fileInput.files;

  for (let i = 0; i < files.length; i++) {
    if (i !== index) {
      dt.items.add(files[i]);
    }
  }

  fileInput.files = dt.files;
  handleFileSelect({ target: fileInput });
}

/**
 * Switch between local and cloud file sources
 * @param {string} source - 'local' or 'cloud'
 */
function switchFileSource(source) {
  const localSection = document.getElementById('local-file-section');
  const cloudSection = document.getElementById('cloud-file-section');
  const tabLocal = document.getElementById('tab-local');
  const tabCloud = document.getElementById('tab-cloud');

  if (source === 'local') {
    localSection.classList.remove('hidden');
    cloudSection.classList.add('hidden');
    tabLocal.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white';
    tabCloud.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200';
  } else {
    localSection.classList.add('hidden');
    cloudSection.classList.remove('hidden');
    tabLocal.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200';
    tabCloud.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white';

    // Load cloud files when switching to cloud tab
    loadCloudFilesForPicker();
  }
}

/**
 * Load cloud files into the picker
 */
async function loadCloudFilesForPicker() {
  const cloudFileList = document.getElementById('cloud-file-list-picker');

  if (!cloudFileList) return;

  cloudFileList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Loading files...</p>';

  try {
    // Get files from current source (OneDrive or Google Drive)
    let files = [];
    if (AppState.activeDocumentSource === 'googledrive' && AppState.googleDriveConnected) {
      files = await GoogleDriveAPI.getGoogleDriveFiles();
    } else if (AppState.isAuthenticated) {
      files = await MicrosoftGraphAPI.getOneDriveFiles();
    }

    if (files.length === 0) {
      cloudFileList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No files found. Please connect to OneDrive or Google Drive.</p>';
      return;
    }

    // Render file list
    cloudFileList.innerHTML = files.map(file => `
      <div class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded border border-gray-200 cursor-pointer" onclick="toggleCloudFileSelection('${file.id}', '${file.title.replace(/'/g, "\\'")}', '${file.source}')">
        <input type="checkbox" id="cloud-file-${file.id}" class="w-4 h-4 text-blue-600" onclick="event.stopPropagation(); toggleCloudFileSelection('${file.id}', '${file.title.replace(/'/g, "\\'")}', '${file.source}')">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 truncate">${file.title}</p>
          <p class="text-xs text-gray-500">${file.source === 'onedrive' ? 'OneDrive' : 'Google Drive'} • ${formatFileSize(file.size || 0)}</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading cloud files:', error);
    cloudFileList.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Failed to load files. Please try again.</p>';
  }
}

/**
 * Toggle cloud file selection
 * @param {string} fileId - File ID
 * @param {string} fileName - File name
 * @param {string} source - File source ('onedrive' or 'googledrive')
 */
function toggleCloudFileSelection(fileId, fileName, source) {
  console.log('toggleCloudFileSelection called:', { fileId, fileName, source });

  const checkbox = document.getElementById(`cloud-file-${fileId}`);
  if (!checkbox) {
    console.warn('Checkbox not found for fileId:', fileId);
    return;
  }

  // Toggle checkbox state
  checkbox.checked = !checkbox.checked;

  console.log('Checkbox state:', checkbox.checked);

  if (checkbox.checked) {
    // Add to selected files
    selectedCloudFiles.push({ id: fileId, name: fileName, source: source });
    console.log('✓ File added to selection:', fileName);
  } else {
    // Remove from selected files
    selectedCloudFiles = selectedCloudFiles.filter(f => f.id !== fileId);
    console.log('✗ File removed from selection:', fileName);
  }

  console.log('Total selected cloud files:', selectedCloudFiles.length, selectedCloudFiles);

  // Update file list display
  updateSelectedFilesDisplay();
}

/**
 * Update the display of selected files
 */
function updateSelectedFilesDisplay() {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;

  // Get local files
  const fileInput = document.getElementById('msg-attachments');
  const localFiles = fileInput ? Array.from(fileInput.files) : [];

  // Clear and rebuild
  fileList.innerHTML = '';

  // Show cloud files
  selectedCloudFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg';
    fileItem.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="p-2 bg-blue-100 rounded-lg flex-shrink-0">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 truncate">${file.name}</p>
          <p class="text-xs text-blue-600 mt-0.5">☁️ From ${file.source === 'onedrive' ? 'OneDrive' : 'Google Drive'}</p>
        </div>
      </div>
      <button
        type="button"
        onclick="removeCloudFile(${index})"
        class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
        title="Remove file"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    fileList.appendChild(fileItem);
  });

  // Show local files
  localFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow';
    fileItem.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="p-2 bg-gray-100 rounded-lg flex-shrink-0">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 truncate">${file.name}</p>
          <p class="text-xs text-gray-500 mt-0.5">📁 Local • ${(file.size / 1024).toFixed(1)} KB</p>
        </div>
      </div>
      <button
        type="button"
        onclick="removeFile(${index})"
        class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
        title="Remove file"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    fileList.appendChild(fileItem);
  });
}

/**
 * Remove cloud file from selection
 * @param {number} index - Index of cloud file to remove
 */
function removeCloudFile(index) {
  const file = selectedCloudFiles[index];
  selectedCloudFiles.splice(index, 1);

  // Uncheck the checkbox
  const checkbox = document.getElementById(`cloud-file-${file.id}`);
  if (checkbox) checkbox.checked = false;

  updateSelectedFilesDisplay();
}

/**
 * Refresh cloud files in picker
 */
async function refreshCloudFilesForPicker() {
  await loadCloudFilesForPicker();
  showNotification('Cloud files refreshed', 'success');
}

/**
 * Download file from OneDrive
 * @param {string} fileId - OneDrive file ID
 * @param {string} fileName - File name
 * @returns {Promise<File>} - Downloaded file as File object
 */
async function downloadFileFromOneDrive(fileId, fileName) {
  try {
    console.log('=== DOWNLOADING FROM ONEDRIVE (FIXED) ===');
    console.log('File ID:', fileId);
    console.log('File Name:', fileName);

    if (!AppState.isAuthenticated) {
      throw new Error('Not authenticated with Microsoft. Please sign in.');
    }

    // IMPORTANT: get a token (main process is the source of truth)
    const token = await window.electronAPI.getAccessToken();
    if (!token) {
      throw new Error('No Microsoft access token available. Please reconnect Microsoft.');
    }

    // Download content as a binary stream
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/octet-stream'
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to download file: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }

    const blob = await res.blob();
    console.log('Blob created:', blob.size, 'bytes, type:', blob.type);

    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

    console.log('✓ File object created:', file.name, file.size, 'bytes', file.type);
    return file;
  } catch (error) {
    console.error('✗ Error downloading from OneDrive:', error);
    throw error;
  }
}


/**
 * Download file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} fileName - File name
 * @param {string} mimeType - File MIME type
 * @returns {Promise<File>} - Downloaded file as File object
 */
async function downloadFileFromGoogleDrive(fileId, fileName, mimeType) {
  console.log('=== GOOGLE DRIVE DOWNLOAD START ===');
  console.log('File ID:', fileId);
  console.log('File Name:', fileName);
  console.log('MIME Type:', mimeType);

  try {
    // Let main process handle the download (it has the token)
    const result = await window.electronAPI.downloadGoogleDriveFile(fileId, fileName, mimeType);

    // Convert array back to Uint8Array
    const uint8Array = new Uint8Array(result.buffer);
    const blob = new Blob([uint8Array], { type: result.mimeType });
    const file = new File([blob], result.fileName, { type: result.mimeType });

    console.log('=== GOOGLE DRIVE DOWNLOAD COMPLETE ===');
    console.log('✓ File object created:', file.name, file.size, 'bytes', file.type);

    return file;
  } catch (error) {
    console.error('=== GOOGLE DRIVE DOWNLOAD FAILED ===');
    console.error('✗ Error:', error.message);
    throw new Error(`Failed to download "${fileName}" from Google Drive: ${error.message}`);
  }
}

/**
 * Helper function to format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Schedule a message with optional file attachments
 * @param {Event} event - Form submit event
 */
async function scheduleMessage(event) {
  event.preventDefault();

  if (!AppState.azureVmUrl) {
    showNotification('Please configure Azure VM URL in Settings first', 'error');
    return;
  }

  const platform = document.getElementById('msg-platform').value;
  const recipient = document.getElementById('msg-recipient').value;
  const content = document.getElementById('msg-content').value;
  const scheduledTime = document.getElementById('msg-schedule').value;
  const fileInput = document.getElementById('msg-attachments');
  const selectedChatSelect = document.getElementById('msg-subscribed-chat');

  // Validate inputs
  if (!content || !scheduledTime) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  // Get the target_user_id from selected chat
  let targetUserId = null;
  if (selectedChatSelect && selectedChatSelect.value) {
    const selectedChat = AppState.subscribedChats.find(c => c.id === selectedChatSelect.value);
    if (selectedChat && selectedChat.user_id) {
      targetUserId = selectedChat.user_id;
    }
  }

  // If no chat selected, try to find by chat_id from recipient
  if (!targetUserId && recipient) {
    const chatByName = AppState.subscribedChats.find(c =>
      c.name === recipient || c.id === recipient || c.chat_id === recipient
    );
    if (chatByName && chatByName.user_id) {
      targetUserId = chatByName.user_id;
    }
  }

  if (!targetUserId) {
    showNotification('Could not determine target user. Please select a chat from the dropdown.', 'error');
    return;
  }

  // Convert scheduled time to ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)
  const scheduledTimestamp = new Date(scheduledTime).toISOString();

  // Get local files (fileInput already declared above)
  const localFiles = fileInput && fileInput.files.length > 0 ? Array.from(fileInput.files) : [];

  // Show loading
  showNotification('Preparing files and scheduling message...', 'info');

  try {
    // Download cloud files if any are selected
    const downloadedCloudFiles = [];

    console.log('=== FILE PREPARATION ===');
    console.log('Selected cloud files:', selectedCloudFiles.length, selectedCloudFiles);
    console.log('Local files:', localFiles.length);

    // Inside scheduleMessage function, in the cloud files download loop
    if (selectedCloudFiles.length > 0) {
      showNotification(`Downloading ${selectedCloudFiles.length} file(s) from cloud storage...`, 'info');

      for (const cloudFile of selectedCloudFiles) {
        try {
          console.log(`Downloading cloud file: ${cloudFile.name} from ${cloudFile.source}`);

          let downloadedFile;

          if (cloudFile.source === 'onedrive') {
            // OneDrive download only needs fileId and fileName (already in cloudFile)
            downloadedFile = await downloadFileFromOneDrive(
              cloudFile.id,
              cloudFile.name
            );
          } else if (cloudFile.source === 'googledrive') {
            // Google Drive needs mimeType from full file metadata
            const fullFile = AppState.documents.find(d => d.id === cloudFile.id);
            if (!fullFile) {
              throw new Error(`File metadata not found for: ${cloudFile.name}`);
            }

            // Pass mimeType from the full file object
            downloadedFile = await downloadFileFromGoogleDrive(
              cloudFile.id,
              cloudFile.name,
              fullFile.mimeType
            );
          } else {
            throw new Error(`Unknown file source: ${cloudFile.source}`);
          }

          downloadedCloudFiles.push(downloadedFile);
          console.log(`✓ Downloaded: ${downloadedFile.name} (${downloadedFile.size} bytes)`);

        } catch (error) {
          console.error(`✗ Failed to download ${cloudFile.name}:`, error);
          showNotification(`Failed to download ${cloudFile.name}: ${error.message}`, 'error');
          // Continue with other files instead of stopping
        }
      }

      if (downloadedCloudFiles.length > 0) {
        showNotification(`Downloaded ${downloadedCloudFiles.length} file(s) successfully`, 'success');
      } else if (selectedCloudFiles.length > 0) {
        showNotification('All file downloads failed. Message will be scheduled without attachments.', 'warning');
      }
    }


    // Combine local and downloaded cloud files
    const allFiles = [...localFiles, ...downloadedCloudFiles];

    console.log('=== FINAL FILE COUNT ===');
    console.log('Total files to send:', allFiles.length);
    console.log('- Local files:', localFiles.length, localFiles.map(f => f.name));
    console.log('- Cloud files downloaded:', downloadedCloudFiles.length, downloadedCloudFiles.map(f => f.name));
    console.log('All files:', allFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

    showNotification('Scheduling message...', 'info');

    // Use AzureVMAPI to schedule the message with all files
    const result = await AzureVMAPI.scheduleMessage(targetUserId, content, scheduledTimestamp, allFiles);

    // Store message locally for UI display
    const newMessage = {
      id: result.id || result.message_id || generateId(),
      platform: platform,
      recipient: recipient,
      content: content,
      message_content: content,
      scheduled_time: scheduledTime,
      scheduled_timestamp: scheduledTimestamp,
      target_user_id: targetUserId,
      status: result.status || 'pending',
      created_at: new Date().toISOString(),
      from_sender: AppState.userId, // Track which user created this message
      server_response: result
    };

    AppState.scheduledMessages.push(newMessage);

    // Clear selected cloud files
    selectedCloudFiles = [];

    hideModal();
    renderScheduling();

    // Show success notification with file count
    const fileCountMsg = allFiles.length > 0 ? ` with ${allFiles.length} file(s)` : '';
    showNotification(
      `✓ Message scheduled successfully${fileCountMsg}! Will be sent ${formatDateTime(scheduledTime)}`,
      'success'
    );

    // Console confirmation of uploaded files
    if (allFiles.length > 0) {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║           FILES UPLOADED SUCCESSFULLY TO SERVER           ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      allFiles.forEach((file, index) => {
        console.log(`║ [${index + 1}] ${file.name.padEnd(45)} │ ${(file.size / 1024).toFixed(1).padStart(8)} KB ║`);
      });
      console.log('╚════════════════════════════════════════════════════════════╝');
    }
  } catch (error) {
    console.error('Error scheduling message:', error);
    showNotification('Failed to schedule message: ' + error.message, 'error');
  }
}

// Export functions to global scope
if (typeof window !== 'undefined') {
  window.showModal = showModal;
  window.hideModal = hideModal;
  window.onSubscribedChatSelect = onSubscribedChatSelect;
  window.refreshSubscribedChatsInModal = refreshSubscribedChatsInModal;
  window.toggleRecipientInput = toggleRecipientInput;
  window.handleFileSelect = handleFileSelect;
  window.removeFile = removeFile;
  window.switchFileSource = switchFileSource;
  window.loadCloudFilesForPicker = loadCloudFilesForPicker;
  window.toggleCloudFileSelection = toggleCloudFileSelection;
  window.updateSelectedFilesDisplay = updateSelectedFilesDisplay;
  window.removeCloudFile = removeCloudFile;
  window.refreshCloudFilesForPicker = refreshCloudFilesForPicker;
  window.downloadFileFromOneDrive = downloadFileFromOneDrive;
  window.downloadFileFromGoogleDrive = downloadFileFromGoogleDrive;
  window.formatFileSize = formatFileSize;
  window.scheduleMessage = scheduleMessage;
}
