// Modal Management Module
// Handles modal creation, display, and interaction logic

// Store for cloud files selected for attachment
let selectedCloudFiles = [];

/**
 * Show a modal dialog
 */
function showModal(type) {
  if (type === 'newMessage') {
    navigateTo('scheduleMessage');
    return;
  }
  console.warn('Unknown modal type:', type);
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
 * Download file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} fileName - File name
 * @param {string} mimeType - File MIME type
 * @returns {Promise<File>} - Downloaded file as File object
 */
async function downloadFileFromGoogleDrive(fileId, fileName, mimeType) {
  try {
    const result = await window.electronAPI.downloadGoogleDriveFile(fileId, fileName, mimeType);
    const uint8Array = new Uint8Array(result.buffer);
    const blob = new Blob([uint8Array], { type: result.mimeType });
    return new File([blob], result.fileName, { type: result.mimeType });
  } catch (error) {
    throw new Error(`Failed to download "${fileName}" from Google Drive: ${error.message}`);
  }
}

// formatFileSize is now in utils.js — no duplicate needed here

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
        } catch (error) {
          console.error(`Failed to download ${cloudFile.name}:`, error);
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
  window.scheduleMessage = scheduleMessage;
}
