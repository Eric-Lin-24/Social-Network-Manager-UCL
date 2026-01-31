// ============================================
// DOCUMENTS VIEW (TABS + FOLDER NAVIGATION)
// With file selection mode for scheduler
// ============================================

// Check if a file is selected for scheduler
function isFileSelectedForScheduler(fileId) {
  const selected = AppState.selectedCloudFilesForScheduler || [];
  return selected.some(f => f.id === fileId);
}

// Toggle file selection for scheduler
function toggleFileForScheduler(doc) {
  if (!AppState.fileSelectionMode) return;
  if (isFolderDoc(doc)) return; // Don't select folders

  const selected = AppState.selectedCloudFilesForScheduler || [];
  const existingIndex = selected.findIndex(f => f.id === doc.id);

  if (existingIndex >= 0) {
    // Remove from selection
    AppState.selectedCloudFilesForScheduler = selected.filter(f => f.id !== doc.id);
  } else {
    // Add to selection
    AppState.selectedCloudFilesForScheduler = [...selected, {
      id: doc.id,
      name: doc.title || doc.name,
      title: doc.title,
      source: doc.source || AppState.activeDocumentSource || 'onedrive',
      mimeType: doc.mimeType,
      size: doc.size
    }];
  }

  renderDocuments();
}

// Start selection mode from documents page
function startFileSelectionMode() {
  AppState.fileSelectionMode = true;
  AppState.fileSelectionStartedFromDocuments = true;
  AppState.selectedCloudFilesForScheduler = [];
  renderDocuments();
}

// Confirm selection and go to scheduler
function confirmFileSelectionAndReturn() {
  AppState.fileSelectionMode = false;
  AppState.fileSelectionStartedFromDocuments = false;
  navigateTo('scheduleMessage');
}

// Cancel selection
function cancelFileSelection() {
  AppState.fileSelectionMode = false;
  AppState.selectedCloudFilesForScheduler = [];

  // If started from documents, stay on documents; otherwise go back to scheduleMessage
  if (AppState.fileSelectionStartedFromDocuments) {
    AppState.fileSelectionStartedFromDocuments = false;
    renderDocuments();
  } else {
    navigateTo('scheduleMessage');
  }
}

function isFolderDoc(doc) {
  if (!doc) return false;
  // OneDrive mapping often uses "folder" or doc.folder presence.
  if (doc.mimeType === 'folder') return true;
  // Google Drive folder mime type
  if (doc.mimeType === 'application/vnd.google-apps.folder') return true;
  // fallback
  if (doc.folder) return true;
  return false;
}

function setActiveDocumentSource(source) {
  AppState.activeDocumentSource = source;
  renderDocuments();
}

function getDocsForActiveSource() {
  const src = AppState.activeDocumentSource || 'onedrive';
  const docs = AppState.documents || [];
  return docs.filter(d => (d.source || 'onedrive') === src);
}

function getFolderState() {
  const src = AppState.activeDocumentSource || 'onedrive';
  if (!AppState.documentNav) AppState.documentNav = {};
  if (!AppState.documentNav[src]) AppState.documentNav[src] = { folderId: 'root', stack: [] };
  return AppState.documentNav[src];
}

async function openFolder(folderId, folderName) {
  const src = AppState.activeDocumentSource || 'onedrive';
  const nav = getFolderState();
  nav.stack.push({ folderId: nav.folderId, name: folderName || 'Folder' });
  nav.folderId = folderId;

  await refreshCloudDocs({ source: src, folderId });
  renderDocuments();
}

async function goBackFolder() {
  const src = AppState.activeDocumentSource || 'onedrive';
  const nav = getFolderState();
  if (!nav.stack.length) return;

  const prev = nav.stack.pop();
  nav.folderId = prev.folderId || 'root';

  await refreshCloudDocs({ source: src, folderId: nav.folderId });
  renderDocuments();
}

function resetToRoot() {
  const src = AppState.activeDocumentSource || 'onedrive';
  const nav = getFolderState();
  nav.folderId = 'root';
  nav.stack = [];
  refreshCloudDocs({ source: src, folderId: 'root' });
  renderDocuments();
}

function updateDocumentSearch(query, cursorPos) {
  AppState.documentSearchQuery = query || '';
  renderDocuments();

  // Re-focus the search input and restore cursor position
  const searchInput = document.getElementById('document-search-input');
  if (searchInput) {
    searchInput.focus();
    if (typeof cursorPos === 'number') {
      searchInput.setSelectionRange(cursorPos, cursorPos);
    }
  }
}

function renderDocuments() {
  const content = document.getElementById('content');
  const src = AppState.activeDocumentSource || 'onedrive';
  const nav = getFolderState();
  const isSelectionMode = AppState.fileSelectionMode === true;
  const selectedFiles = AppState.selectedCloudFilesForScheduler || [];

  let documents = getDocsForActiveSource();

  // Search filtering
  const q = (AppState.documentSearchQuery || '').trim().toLowerCase();
  if (q) {
    documents = documents.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.content || '').toLowerCase().includes(q)
    );
  }

  // Folder-first ordering
  documents = documents.slice().sort((a, b) => {
    const af = isFolderDoc(a) ? 0 : 1;
    const bf = isFolderDoc(b) ? 0 : 1;
    if (af !== bf) return af - bf;
    return (a.title || '').localeCompare(b.title || '');
  });

  const isOneDrive = src === 'onedrive';
  const tabOneDriveClass = isOneDrive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  const tabGoogleClass = !isOneDrive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

  const breadcrumb = (nav.stack || []).map((x, idx) => {
    const safeName = (x.name || 'Folder').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="text-muted">/</span><span class="text-sm">${safeName}</span>`;
  }).join(' ');

  // Selection mode header (includes count and Done button)
  const selectionHeader = isSelectionMode ? `
    <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-primary-soft); border: 1px solid var(--accent-primary);">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--accent-primary); display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <p class="font-semibold" style="color: var(--accent-primary);">Select Files to Attach</p>
            <p class="text-xs text-muted">Click on files to select them for your message</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <!-- Selected count badge -->
          <div class="flex items-center gap-2" style="padding: 6px 12px; border-radius: 8px; background: var(--bg-secondary);">
            <div style="width: 24px; height: 24px; border-radius: 6px; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">
              ${selectedFiles.length}
            </div>
            <span class="text-sm">${selectedFiles.length === 1 ? 'file selected' : 'files selected'}</span>
          </div>
          <!-- Cancel button -->
          <button class="btn btn-ghost btn-sm" onclick="cancelFileSelection()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
          </button>
          <!-- Done button -->
          <button class="btn btn-primary btn-sm" onclick="confirmFileSelectionAndReturn()" ${selectedFiles.length === 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Done
          </button>
        </div>
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="animate-in">

      ${selectionHeader}

      <div class="flex justify-between items-center mb-6">
        <div class="flex gap-2">
          <button class="${tabOneDriveClass}" onclick="setActiveDocumentSource('onedrive')">
            <span style="color: ${isOneDrive ? 'white' : '#0078d4'};">●</span> OneDrive
          </button>
          <button class="${tabGoogleClass}" onclick="setActiveDocumentSource('googledrive')">
            <span style="color: ${!isOneDrive ? 'white' : '#4285f4'};">●</span> Google Drive
          </button>

          <div style="width: 16px;"></div>

          <div class="flex gap-2">
            <input
              id="document-search-input"
              type="text"
              placeholder="Search documents..."
              class="form-input"
              style="width: 280px;"
              value="${(AppState.documentSearchQuery || '').replace(/"/g, '&quot;')}"
              oninput="updateDocumentSearch(this.value, this.selectionStart)"
            >
            <button class="btn btn-secondary btn-sm" onclick="refreshCurrentView()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Sync
            </button>
          </div>
        </div>

        ${!isSelectionMode ? `
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="resetToRoot()">Root</button>
          <button class="btn btn-secondary btn-sm" onclick="goBackFolder()" ${nav.stack.length ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>Back</button>
          <button class="btn btn-secondary btn-sm" onclick="startFileSelectionMode()" title="Select files to attach to a message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Select
          </button>
          <button onclick="showNewDocumentModal()" class="btn btn-primary btn-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Upload
          </button>
        </div>
        ` : `
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="resetToRoot()">Root</button>
          <button class="btn btn-secondary btn-sm" onclick="goBackFolder()" ${nav.stack.length ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>Back</button>
        </div>
        `}
      </div>

      <div class="flex items-center gap-2 mb-4">
        <span class="text-xs text-muted">Location:</span>
        <span class="text-sm">${src === 'onedrive' ? 'OneDrive' : 'Google Drive'}</span>
        <span class="text-muted">/</span>
        <span class="text-sm">${nav.folderId === 'root' ? 'Root' : 'Folder'}</span>
        <span class="text-muted">${breadcrumb ? breadcrumb : ''}</span>
      </div>

      <div class="grid-cols-3">
        ${documents.length === 0 ? `
          <div class="card" style="grid-column: span 3; text-align: center; padding: 60px;">
            <div class="flex justify-center mb-4">
              <div class="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                <svg width="32" height="32" class="text-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-medium mb-2">No items here</h3>
            <p class="text-muted mb-6">${q ? 'Try a different search term.' : 'Sync your cloud storage to load items.'}</p>
            <button onclick="refreshCurrentView()" class="btn btn-primary">Sync Now</button>
          </div>
        ` : documents.map(doc => {
          const folder = isFolderDoc(doc);
          const title = (doc.title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const meta = folder ? 'Folder' : (doc.mimeType || 'File');
          const isSelected = !folder && isSelectionMode && isFileSelectedForScheduler(doc.id);
          const safeDocJson = JSON.stringify(doc).replace(/'/g, "\\'").replace(/"/g, '&quot;');

          // Different click handlers based on mode
          let clickHandler;
          if (isSelectionMode) {
            if (folder) {
              clickHandler = `openFolder('${doc.id}', '${title.replace(/'/g, "\\'")}')`;
            } else {
              clickHandler = `toggleFileForScheduler(JSON.parse(this.dataset.doc))`;
            }
          } else {
            clickHandler = folder
              ? `openFolder('${doc.id}', '${title.replace(/'/g, "\\'")}')`
              : `viewDocument('${doc.id}')`;
          }

          const rightAction = isSelectionMode
            ? (folder
                ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openFolder('${doc.id}', '${title.replace(/'/g, "\\'")}')">Open</button>`
                : '')
            : (folder
                ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openFolder('${doc.id}', '${title.replace(/'/g, "\\'")}')">Open</button>`
                : (doc.webUrl
                    ? `<a class="btn btn-secondary btn-sm" href="${doc.webUrl}" target="_blank" onclick="event.stopPropagation();">Open</a>`
                    : `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewDocument('${doc.id}')">View</button>`));

          const icon = folder
            ? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                 <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
               </svg>`
            : `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                 <polyline points="14 2 14 8 20 8"/>
               </svg>`;

          // Checkbox for selection mode (only for files, not folders)
          const checkbox = (isSelectionMode && !folder) ? `
            <div style="width: 24px; height: 24px; border-radius: 6px; border: 2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}; background: ${isSelected ? 'var(--accent-primary)' : 'transparent'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 8px;">
              ${isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          ` : '';

          return `
            <div class="card hover:border-primary/50 group cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}"
                 style="${isSelected ? 'background: var(--accent-primary-soft); border-color: var(--accent-primary);' : ''}"
                 data-doc="${safeDocJson}"
                 onclick="${clickHandler}">
              <div class="flex justify-between items-start mb-4">
                <div class="flex gap-3 items-center">
                  ${checkbox}
                  <div class="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-primary">
                    ${icon}
                  </div>
                  <div>
                    <div class="font-medium">${title}</div>
                    <div class="text-xs text-muted">${meta}${doc.size ? ' • ' + formatFileSize(doc.size) : ''}</div>
                  </div>
                </div>
                ${rightAction}
              </div>

              <div class="text-xs text-muted">
                ${doc.updated_at ? `Updated: ${new Date(doc.updated_at).toLocaleString()}` : (doc.created_at ? `Added: ${new Date(doc.created_at).toLocaleString()}` : '')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Export
if (typeof window !== 'undefined') {
  window.renderDocuments = renderDocuments;
  window.setActiveDocumentSource = setActiveDocumentSource;
  window.openFolder = openFolder;
  window.goBackFolder = goBackFolder;
  window.resetToRoot = resetToRoot;
  window.updateDocumentSearch = updateDocumentSearch;
  window.isFileSelectedForScheduler = isFileSelectedForScheduler;
  window.toggleFileForScheduler = toggleFileForScheduler;
  window.startFileSelectionMode = startFileSelectionMode;
  window.confirmFileSelectionAndReturn = confirmFileSelectionAndReturn;
  window.cancelFileSelection = cancelFileSelection;
}
