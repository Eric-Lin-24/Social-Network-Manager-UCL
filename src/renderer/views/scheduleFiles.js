// ============================================
// SCHEDULE MESSAGE - File Handling
// Cloud file downloaders, local file management,
// drag & drop, and file list rendering
// ============================================
async function downloadFileFromOneDrive(fileId, fileName) {
  try {
    if (!AppState.isAuthenticated) {
      throw new Error('Not authenticated with Microsoft. Please sign in.');
    }

    if (!window?.electronAPI?.downloadOneDriveFile) {
      throw new Error('downloadOneDriveFile IPC is not available. Add it to preload + main process.');
    }

    const result = await window.electronAPI.downloadOneDriveFile(fileId, fileName);

    if (!result || !result.buffer) {
      throw new Error('OneDrive download returned no data buffer.');
    }

    const uint8Array = new Uint8Array(result.buffer);
    const blob = new Blob([uint8Array], { type: result.mimeType || 'application/octet-stream' });
    return new File([blob], result.fileName || fileName, { type: result.mimeType || 'application/octet-stream' });
  } catch (error) {
    console.error('OneDrive download failed:', error.message);
    throw new Error(`Failed to download "${fileName}" from OneDrive: ${error.message}`);
  }
}

async function downloadFileFromGoogleDriveFixed(fileId, fileName, mimeType) {
  if (typeof window?.electronAPI?.downloadGoogleDriveFile !== 'function') {
    throw new Error('downloadGoogleDriveFile IPC is not available in this build.');
  }

  const result = await window.electronAPI.downloadGoogleDriveFile(fileId, fileName, mimeType);

  if (!result || !result.buffer) {
    throw new Error('Google Drive download returned no file buffer.');
  }

  const uint8Array = new Uint8Array(result.buffer);
  const blob = new Blob([uint8Array], { type: result.mimeType || mimeType || 'application/octet-stream' });
  return new File([blob], result.fileName || fileName || `gdrive_${fileId}`, {
    type: result.mimeType || mimeType || 'application/octet-stream'
  });
}

function handleLocalFileSelect(event) {
  const files = event.target.files;
  if (files) {
    Array.from(files).forEach(file => {
      if (!selectedLocalFiles.find(f => f.name === file.name && f.size === file.size)) {
        selectedLocalFiles.push(file);
      }
    });
    renderFileList();
  }
}

function removeLocalFile(index) {
  selectedLocalFiles.splice(index, 1);
  renderFileList();
}

// Navigate to documents page for cloud file selection
function goToDocumentsForSelection() {
  // Save current form state before navigating away
  const messageContent = document.getElementById('message-content')?.value || '';
  const time = document.getElementById('message-time')?.value || '';
  const emailSubject = document.getElementById('email-subject')?.value || '';

  AppState.schedulerFormState = {
    messageContent,
    time,
    emailSubject,
    channel: _getComposeChannel(),
    recipients: [...selectedRecipients],
    localFiles: [...selectedLocalFiles],
    selectedDays: [...(AppState.selectedScheduleDays || [])]
  };

  // Enable file selection mode
  AppState.fileSelectionMode = true;
  AppState.fileSelectionStartedFromDocuments = false; // Coming from scheduler
  // Navigate to documents
  navigateTo('documents');
}

// Remove a cloud file from selection
function removeCloudFileFromScheduler(fileId) {
  AppState.selectedCloudFilesForScheduler = (AppState.selectedCloudFilesForScheduler || []).filter(f => f.id !== fileId);
  renderFileList();
}

// Render combined file list (local + cloud from AppState)
function renderFileList() {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;

  const cloudFiles = AppState.selectedCloudFilesForScheduler || [];
  const allFiles = [];

  // Add local files
  selectedLocalFiles.forEach((file, index) => {
    allFiles.push({ type: 'local', index, name: file.name, size: file.size, source: 'Local', sourceRaw: 'local' });
  });

  // Add cloud files from AppState
  cloudFiles.forEach((file) => {
    const isOneDrive = file.source === 'onedrive';
    allFiles.push({
      type: 'cloud',
      id: file.id,
      name: file.name || file.title,
      size: file.size,
      source: isOneDrive ? 'OneDrive' : 'Google Drive',
      sourceRaw: file.source,
      mimeType: file.mimeType
    });
  });

  if (allFiles.length === 0) {
    fileList.innerHTML = '';
    return;
  }

  fileList.innerHTML = allFiles.map(file => {
    const isOneDrive = file.sourceRaw === 'onedrive';
    const isGoogleDrive = file.sourceRaw === 'googledrive';
    const sourceColor = isOneDrive ? '#0078d4' : (isGoogleDrive ? '#4285f4' : 'var(--text-muted)');

    return `
    <div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-subtle);">
      <!-- Icon -->
      <div style="width: 40px; height: 40px; border-radius: 10px; background: ${file.type === 'cloud' ? (isOneDrive ? 'rgba(0,120,212,0.1)' : 'rgba(66,133,244,0.1)') : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${file.type === 'cloud' ? sourceColor : 'var(--text-muted)'}" stroke-width="2">
          ${file.type === 'cloud'
            ? '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'
            : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
          }
        </svg>
      </div>

      <!-- File info -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${file.name}</p>
        <div class="flex items-center gap-2 mt-0.5">
          ${file.type === 'cloud' ? `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${sourceColor};"></span>` : ''}
          <span class="text-xs" style="color: ${file.type === 'cloud' ? sourceColor : 'var(--text-muted)'};">${file.source}</span>
          ${file.size ? `<span class="text-xs text-muted">•</span><span class="text-xs text-muted">${formatFileSize(file.size)}</span>` : ''}
        </div>
      </div>

      <!-- Remove button -->
      <button class="btn-icon" onclick="${file.type === 'local' ? `removeLocalFile(${file.index})` : `removeCloudFileFromScheduler('${file.id}')`}" style="width: 32px; height: 32px; border-radius: 8px; background: var(--bg-tertiary); color: var(--text-muted);" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--text-muted)'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `}).join('');
}

// Drag and drop
function setupDragAndDrop() {
  const dropZone = document.getElementById('file-drop-zone');
  if (!dropZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = 'var(--accent-primary)';
      dropZone.style.background = 'var(--accent-primary-soft)';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = 'var(--border-default)';
      dropZone.style.background = 'var(--bg-tertiary)';
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (!selectedLocalFiles.find(f => f.name === file.name && f.size === file.size)) {
          selectedLocalFiles.push(file);
        }
      });
      renderFileList();
    }
  });
}

// Quick schedule (uses time input + selected days)