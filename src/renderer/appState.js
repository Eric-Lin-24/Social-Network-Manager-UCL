// ============================================
// APPLICATION STATE MANAGEMENT
// Central state object for the application
// ============================================

const AppState = {
  // Current view
  currentView: 'dashboard',

  // Documents
  documents: [],
  activeDocumentSource: 'onedrive', // 'onedrive' or 'googledrive'
  documentSearchQuery: '',
  // Folder navigation per provider
  documentNav: {
    onedrive: { folderId: 'root', stack: [] },
    googledrive: { folderId: 'root', stack: [] }
  },
  // Last successful sync times (used by Dashboard + Documents)
  lastSync: {
    onedrive: null,
    googledrive: null,
    subscribedChats: null
  },

  // Messaging (Telegram)
  scheduledMessages: [],
  subscribedChats: [],
  loadingSubscribedChats: false,

  // Messaging (Email / Gmail)
  scheduledEmails: [],
  subscribedEmailUsers: [],
  loadingSubscribedEmailUsers: false,
  composeChannel: 'email', // 'telegram' | 'email'

  // File selection mode (for scheduler -> documents flow)
  fileSelectionMode: false,
  selectedCloudFilesForScheduler: [],
  // ✅ Drafts (frontend-only, persisted in localStorage per user)
  messageDrafts: [],
  schedulingActiveTab: 'queue', // 'queue' | 'drafts'

  // ✅ Prefill support for scheduleMessage page
  scheduleMessagePrefill: null, // { target_user_id: string, message_content: string }

  // Forms
  microsoftForms: [],
  formSubmissions: [],
  selectedForm: null,

  // Microsoft Authentication
  isAuthenticated: false,
  accessToken: null,
  userProfile: null,

  // Google Drive
  googleDriveConnected: false,
  googleDriveEmail: '',

  // WhatsApp / Azure VM
  whatsappConnected: false,
  whatsappPhone: '',
  azureVmUrl: 'http://20.153.191.11:8000',

  // Custom User Authentication (Backend)
  userId: null, // User ID from backend authentication
  username: null, // Username from backend authentication
  authenticationUrl: 'http://20.153.191.11:8080', // Backend authentication URL
  customAuthToken: null, // Custom auth token (if needed in future)

  // Templates
  templates: [],

  // Connections
  connections: [],

  // Timeline / Resource Planning
  timelineProjects: [],
  timelineTeamMembers: [],
  timelineTasks: [],
  timelineViewMode: 'timeline',
  timelineZoom: 'week',
  timelineStartDate: null,
  timelineFilterProject: '',
  timelineFilterPerson: '',

  // Workspaces (User-facing: "Projects") - top-level grouping
  timelineWorkspaces: [],

  // Timeline Project Index
  timelineSelectedProject: null, // null = show project index, string = workspace id to show Gantt for
  timelineProjectSearch: '',
  timelineProjectViewMode: 'grid' // 'grid' | 'list'
};

// Export to global scope
if (typeof window !== 'undefined') {
  window.AppState = AppState;
}
