// ============================================
// AZURE VM API - Chat Subscriptions + Messaging
// ============================================

const AzureVMAPI = {
  _pollingInterval: null,

  _baseUrl() {
    if (!AppState.azureVmUrl) return '';
    return String(AppState.azureVmUrl).replace(/\/$/, '');
  },

  // -----------------------------
  // Normalization helpers
  // -----------------------------
  _normTarget(t) {
    if (Array.isArray(t)) return t.map(String).join(',');
    if (t == null) return '';
    return String(t);
  },

  _normText(s) {
    return String(s || '').trim();
  },

  _normTime(ts) {
    // Try hard to normalize different timestamp formats into the same ISO string
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (_) {}
    // If parsing failed, fallback to string
    return String(ts);
  },

  _sameTime(a, b) {
    // Compare normalized ISO time; if parsing fails, compare raw normalized strings
    const na = this._normTime(a);
    const nb = this._normTime(b);
    if (na && nb) return na === nb;

    // fallback
    return String(a || '') === String(b || '');
  },

  _sameTarget(a, b) {
    return this._normTarget(a) === this._normTarget(b);
  },

  _isSent(m) {
    return m?.status === 'sent' || m?.is_sent === true;
  },

  _mergeFiles(keep, incoming) {
    // Merge file_paths/file_urls (don’t lose attachments)
    const keepPaths = keep.file_paths || [];
    const keepUrls = keep.file_urls || [];
    const incPaths = incoming.file_paths || [];
    const incUrls = incoming.file_urls || [];

    if (incPaths.length > 0 && keepPaths.length === 0) keep.file_paths = incPaths;
    if (incUrls.length > 0 && keepUrls.length === 0) keep.file_urls = incUrls;
  },

  _chooseBetter(a, b) {
    // Keep sent over pending; merge attachments before choosing
    this._mergeFiles(a, b);
    this._mergeFiles(b, a);

    const aSent = this._isSent(a);
    const bSent = this._isSent(b);

    if (bSent && !aSent) return b;
    if (aSent && !bSent) return a;

    // If equal status, keep the one with newer sent_at/created_at if possible
    const aTime = Date.parse(a?.sent_at || a?.created_at || a?.scheduled_time || a?.scheduled_timestamp || 0) || 0;
    const bTime = Date.parse(b?.sent_at || b?.created_at || b?.scheduled_time || b?.scheduled_timestamp || 0) || 0;
    return bTime >= aTime ? b : a;
  },

  _contentKey(msg) {
    const content = this._normText(msg?.message_content || msg?.message || msg?.content || '');
    const when = this._normTime(msg?.scheduled_time || msg?.scheduled_timestamp || msg?.scheduledTs || '');
    const target = this._normTarget(msg?.target_user_id);
    return `${content}|${when}|${target}`;
  },

  async fetchSubscribedChats() {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    AppState.loadingSubscribedChats = true;

    try {
      const base = this._baseUrl();

      const response = await fetch(`${base}/subscribed-users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscribed chats: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      let rawChats = [];
      if (Array.isArray(data)) rawChats = data;
      else if (data && Array.isArray(data.chats)) rawChats = data.chats;
      else if (data && Array.isArray(data.users)) rawChats = data.users;
      else {
        throw new Error('Invalid response format from Azure VM');
      }

      const formattedChats = rawChats.map(chat => {
        return {
          id: chat.chat_id || chat.id,
          chat_id: chat.chat_id,
          name: chat.chat_name || chat.name || chat.chat_id || 'Unknown Chat',
          platform: chat.platform || 'whatsapp',
          type: chat.type || 'group',
          user_id: chat.user_id,
          from_sender: chat.from_sender || chat.user_id,
          created_at: chat.created_at
        };
      });

      AppState.subscribedChats = formattedChats;

      if (AppState.lastSync) {
        AppState.lastSync.subscribedChats = new Date().toISOString();
      }

      return formattedChats;
    } catch (error) {
      console.error('Error fetching subscribed chats:', error);
      throw error;
    } finally {
      AppState.loadingSubscribedChats = false;
    }
  },

  async refreshSubscribedChats() {
    try {
      showNotification('Fetching subscribed chats...', 'info');
      const chats = await this.fetchSubscribedChats();
      showNotification(`Loaded ${chats.length} subscribed chat(s)`, 'success');

      if (AppState.currentView === 'scheduling') {
        renderScheduling();
      }
    } catch (error) {
      showNotification('Failed to fetch subscribed chats: ' + error.message, 'error');
    }
  },

  async scheduleMessage(targetUserId, message, scheduledTimestamp, files = []) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    let targetUserIdStr = '';
    if (Array.isArray(targetUserId)) targetUserIdStr = targetUserId.join(',');
    else if (typeof targetUserId === 'string') targetUserIdStr = targetUserId;
    else if (targetUserId != null) targetUserIdStr = String(targetUserId);

    let scheduledTsStr = '';
    if (scheduledTimestamp instanceof Date) scheduledTsStr = scheduledTimestamp.toISOString();
    else if (typeof scheduledTimestamp === 'string') scheduledTsStr = scheduledTimestamp;
    else if (scheduledTimestamp != null) scheduledTsStr = String(scheduledTimestamp);

    const formData = new FormData();
    formData.append('target_user_id', targetUserIdStr);
    formData.append('message', message);
    formData.append('scheduled_timestamp', scheduledTsStr);
    formData.append('from_sender', AppState.userId);
    formData.append('username', AppState.username || '');

    if (files && files.length > 0) {
      Array.from(files).forEach(file => formData.append('files', file));
    }

    const endpoint = `${this._baseUrl()}/schedule-message`;

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
      } catch (e) {
        try {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        } catch (e2) {}
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  },

  async deleteMessage(messageId) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    if (!messageId) {
      throw new Error('messageId is required to delete a scheduled message');
    }

    const base = this._baseUrl();
    const deleteUrl = `${base}/delete-message?message_id=${encodeURIComponent(messageId)}`;

    try {
      let res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });

      if (res.status === 405) {
        console.warn('DELETE not allowed on server; attempting POST fallback');
        const formData = new FormData();
        formData.append('message_id', messageId);
        res = await fetch(`${base}/delete-message`, { method: 'POST', body: formData });
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data === true || data === 'true' || (data && data.deleted === true);
    } catch (err) {
      console.error('deleteMessage error:', err);
      throw err;
    }
  },

  async subscribeUser(chatId, chatName) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    const endpoint = `${this._baseUrl()}/subscribe-user`;
    try {
      const body = {
        chat_id: chatId,
        chat_name: chatName,
        from_sender: AppState.userId
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('subscribeUser error:', err);
      throw err;
    }
  },

  async getPendingMessages() {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    const endpoint = `${this._baseUrl()}/pending-messages?from_sender=${encodeURIComponent(AppState.userId)}`;

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('getPendingMessages error:', err);
      throw err;
    }
  },

  async syncMessagesFromServer() {
    try {
      if (!AppState.userId) return;

      const serverMessages = await this.getPendingMessages();

      if (!Array.isArray(serverMessages)) {
        console.warn('Server returned non-array for pending messages:', serverMessages);
        return;
      }

      AppState.scheduledMessages = AppState.scheduledMessages || [];

      const serverIdSet = new Set(serverMessages.map(m => String(m.id)));

      // --------------------------------------------
      // 1) Update/Remove local messages
      // --------------------------------------------
      const messagesToRemove = [];

      AppState.scheduledMessages.forEach((localMsg, index) => {
        const localId = localMsg?.server_id || localMsg?.id;
        const localIdStr = localId != null ? String(localId) : '';

        // Try ID match first
        let serverMsg =
          localIdStr
            ? serverMessages.find(s => String(s.id) === localIdStr)
            : null;

        // If no ID match, match by normalized content key
        if (!serverMsg) {
          const localKey = this._contentKey(localMsg);
          serverMsg = serverMessages.find(s => this._contentKey(s) === localKey);
        }

        if (serverMsg) {
          // Update status
          if (serverMsg.is_sent === true && localMsg.status !== 'sent') {
            localMsg.status = 'sent';
            localMsg.sent_at = serverMsg.sent_at || new Date().toISOString();
          }

          // Merge files from server if present
          if ((serverMsg.file_paths && serverMsg.file_paths.length > 0) || (serverMsg.file_urls && serverMsg.file_urls.length > 0)) {
            localMsg.file_paths = serverMsg.file_paths || localMsg.file_paths || [];
            localMsg.file_urls = serverMsg.file_urls || localMsg.file_urls || [];
          }

          // Store server_id and align id to server id
          localMsg.server_id = localMsg.server_id || serverMsg.id;
          localMsg.id = serverMsg.id;

          // Normalize these for consistent comparisons
          localMsg.scheduled_time = this._normTime(localMsg.scheduled_time);
          localMsg.scheduled_timestamp = this._normTime(localMsg.scheduled_timestamp || localMsg.scheduled_time);
          localMsg.target_user_id = this._normTarget(localMsg.target_user_id);
          localMsg.message_content = this._normText(localMsg.message_content);

        } else {
          // If it had a server_id and that ID is no longer on server → deleted
          if (localMsg.server_id && !serverIdSet.has(String(localMsg.server_id))) {
            messagesToRemove.push(index);
          }
        }
      });

      messagesToRemove.reverse().forEach(i => AppState.scheduledMessages.splice(i, 1));

      // --------------------------------------------
      // 2) Add server messages we don't have
      // --------------------------------------------
      let addedCount = 0;

      serverMessages.forEach(serverMsg => {
        const serverId = String(serverMsg.id);

        const existsById = AppState.scheduledMessages.some(m =>
          String(m.id) === serverId || String(m.server_id) === serverId
        );

        const serverKey = this._contentKey(serverMsg);
        const existsByKey = !existsById && AppState.scheduledMessages.some(m => this._contentKey(m) === serverKey);

        if (!existsById && !existsByKey) {
          // Name lookup (best effort)
          let displayName = null;
          const targetIdRaw = Array.isArray(serverMsg.target_user_id) ? serverMsg.target_user_id[0] : serverMsg.target_user_id;
          const targetId = targetIdRaw != null ? String(targetIdRaw) : '';

          if (targetId && AppState.subscribedChats) {
            const matchingChat = AppState.subscribedChats.find(chat => String(chat.user_id) === targetId);
            if (matchingChat) displayName = matchingChat.name || matchingChat.chat_name;
          }

          AppState.scheduledMessages.push({
            id: serverMsg.id,
            server_id: serverMsg.id,
            recipient: displayName || this._normTarget(serverMsg.target_user_id),
            message_content: this._normText(serverMsg.message),
            content: this._normText(serverMsg.message),
            scheduled_time: this._normTime(serverMsg.scheduled_timestamp),
            scheduled_timestamp: this._normTime(serverMsg.scheduled_timestamp),
            target_user_id: this._normTarget(serverMsg.target_user_id),
            status: serverMsg.is_sent ? 'sent' : 'pending',
            created_at: serverMsg.created_at || new Date().toISOString(),
            sent_at: serverMsg.sent_at,
            from_sender: AppState.userId,
            file_paths: serverMsg.file_paths || [],
            file_urls: serverMsg.file_urls || [],
            platform: 'whatsapp'
          });

          addedCount++;
        }
      });

      // --------------------------------------------
      // 3) FINAL DEDUPE PASS (ID-first, then key)
      // --------------------------------------------
      const before = AppState.scheduledMessages.length;

      // ID-first
      const byId = new Map();
      AppState.scheduledMessages.forEach(m => {
        const idKey = String(m.server_id || m.id || '');
        if (!idKey) return;

        if (!byId.has(idKey)) {
          byId.set(idKey, m);
        } else {
          const better = this._chooseBetter(byId.get(idKey), m);
          byId.set(idKey, better);
        }
      });

      // Key fallback (handles cases where local temp id differs but content same)
      const byKey = new Map();
      Array.from(byId.values()).forEach(m => {
        const k = this._contentKey(m);
        if (!byKey.has(k)) {
          byKey.set(k, m);
        } else {
          const better = this._chooseBetter(byKey.get(k), m);
          byKey.set(k, better);
        }
      });

      AppState.scheduledMessages = Array.from(byKey.values());

      const after = AppState.scheduledMessages.length;
      const deduped = Math.max(0, before - after);

      const totalChanges = messagesToRemove.length + addedCount + deduped;

      if (totalChanges > 0) {
        if (AppState.currentView === 'scheduling' && typeof renderScheduling === 'function') {
          renderScheduling();
        }
      }

      return serverMessages;
    } catch (error) {
      console.error('Error syncing messages from server:', error);
    }
  },

  startMessagePolling(intervalMs = 30000) {
    this.stopMessagePolling();

    this.syncMessagesFromServer();
    this.syncEmailsFromServer();

    this._pollingInterval = setInterval(() => {
      if (AppState.azureVmUrl) {
        this.syncMessagesFromServer();
        this.syncEmailsFromServer();
      }
    }, intervalMs);
  },

  stopMessagePolling() {
    clearInterval(this._pollingInterval);
    this._pollingInterval = null;
  },

  // ==================== EMAIL / GMAIL METHODS ====================

  async fetchSubscribedEmailUsers() {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    AppState.loadingSubscribedEmailUsers = true;

    try {
      const base = this._baseUrl();
      const response = await fetch(`${base}/subscribed-email-users`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscribed email users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      let rawUsers = [];
      if (Array.isArray(data)) rawUsers = data;
      else if (data && Array.isArray(data.users)) rawUsers = data.users;
      else {
        throw new Error('Invalid response format from server');
      }

      const formattedUsers = rawUsers.map(user => ({
        user_id: user.user_id,
        email_address: user.email_address,
        user_name: user.user_name || user.email_address,
        name: user.user_name || user.email_address,
        created_at: user.created_at,
        platform: 'email'
      }));

      AppState.subscribedEmailUsers = formattedUsers;
      return formattedUsers;
    } catch (error) {
      console.error('Error fetching subscribed email users:', error);
      throw error;
    } finally {
      AppState.loadingSubscribedEmailUsers = false;
    }
  },

  async refreshSubscribedEmailUsers() {
    try {
      showNotification('Fetching subscribed email users...', 'info');
      const users = await this.fetchSubscribedEmailUsers();
      showNotification(`Loaded ${users.length} subscribed email user(s)`, 'success');

      if (AppState.currentView === 'scheduling') {
        renderScheduling();
      }
    } catch (error) {
      showNotification('Failed to fetch email users: ' + error.message, 'error');
    }
  },

  async subscribeEmailUser(emailAddress, userName) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    const endpoint = `${this._baseUrl()}/subscribe-email-user`;
    try {
      const body = {
        email_address: emailAddress,
        user_name: userName
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('subscribeEmailUser error:', err);
      throw err;
    }
  },

  async scheduleEmail(targetUserId, subject, message, scheduledTimestamp, files = []) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    let targetUserIdStr = '';
    if (Array.isArray(targetUserId)) targetUserIdStr = targetUserId.join(',');
    else if (typeof targetUserId === 'string') targetUserIdStr = targetUserId;
    else if (targetUserId != null) targetUserIdStr = String(targetUserId);

    let scheduledTsStr = '';
    if (scheduledTimestamp instanceof Date) scheduledTsStr = scheduledTimestamp.toISOString();
    else if (typeof scheduledTimestamp === 'string') scheduledTsStr = scheduledTimestamp;
    else if (scheduledTimestamp != null) scheduledTsStr = String(scheduledTimestamp);

    const formData = new FormData();
    formData.append('target_user_id', targetUserIdStr);
    formData.append('subject', subject);
    formData.append('message', message);
    formData.append('scheduled_timestamp', scheduledTsStr);
    formData.append('from_sender', AppState.userId);

    if (files && files.length > 0) {
      Array.from(files).forEach(file => formData.append('files', file));
    }

    const endpoint = `${this._baseUrl()}/schedule-email`;

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
      } catch (e) {
        try {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        } catch (e2) {}
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  },

  async getPendingEmails() {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    const endpoint = `${this._baseUrl()}/pending-emails?from_sender=${encodeURIComponent(AppState.userId)}`;

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('getPendingEmails error:', err);
      throw err;
    }
  },

  async deleteEmail(emailId) {
    if (!AppState.azureVmUrl) {
      throw new Error('Azure VM URL not configured. Please set it in Settings.');
    }

    if (!AppState.userId) {
      throw new Error('User not authenticated. Please sign in.');
    }

    if (!emailId) {
      throw new Error('emailId is required to delete a scheduled email');
    }

    const base = this._baseUrl();
    const deleteUrl = `${base}/delete-email?email_id=${encodeURIComponent(emailId)}`;

    try {
      let res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });

      if (res.status === 405) {
        console.warn('DELETE not allowed on server; attempting POST fallback');
        const formData = new FormData();
        formData.append('email_id', emailId);
        res = await fetch(`${base}/delete-email`, { method: 'POST', body: formData });
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || data.message || msg;
        } catch (e) {
          try { const text = await res.text(); if (text) msg = text; } catch (_) {}
        }
        throw new Error(msg);
      }

      const data = await res.json();
      return data === true || data === 'true' || (data && data.deleted === true);
    } catch (err) {
      console.error('deleteEmail error:', err);
      throw err;
    }
  },

  async syncEmailsFromServer() {
    try {
      if (!AppState.userId) return;

      const serverEmails = await this.getPendingEmails();

      if (!Array.isArray(serverEmails)) {
        console.warn('Server returned non-array for pending emails:', serverEmails);
        return;
      }

      AppState.scheduledEmails = AppState.scheduledEmails || [];

      const serverIdSet = new Set(serverEmails.map(m => String(m.id)));

      // 1) Update/Remove local emails
      const emailsToRemove = [];

      AppState.scheduledEmails.forEach((localEmail, index) => {
        const localId = localEmail?.server_id || localEmail?.id;
        const localIdStr = localId != null ? String(localId) : '';

        let serverEmail = localIdStr
          ? serverEmails.find(s => String(s.id) === localIdStr)
          : null;

        if (serverEmail) {
          if (serverEmail.is_sent === true && localEmail.status !== 'sent') {
            localEmail.status = 'sent';
            localEmail.sent_at = serverEmail.sent_at || new Date().toISOString();
          }
          localEmail.server_id = localEmail.server_id || serverEmail.id;
          localEmail.id = serverEmail.id;
        } else {
          if (localEmail.server_id && !serverIdSet.has(String(localEmail.server_id))) {
            emailsToRemove.push(index);
          }
        }
      });

      emailsToRemove.reverse().forEach(i => AppState.scheduledEmails.splice(i, 1));

      // 2) Add server emails we don't have
      let addedCount = 0;

      serverEmails.forEach(serverEmail => {
        const serverId = String(serverEmail.id);
        const existsById = AppState.scheduledEmails.some(m =>
          String(m.id) === serverId || String(m.server_id) === serverId
        );

        if (!existsById) {
          let displayName = null;
          const targetIdRaw = Array.isArray(serverEmail.target_user_id) ? serverEmail.target_user_id[0] : serverEmail.target_user_id;
          const targetId = targetIdRaw != null ? String(targetIdRaw) : '';

          if (targetId && AppState.subscribedEmailUsers) {
            const match = AppState.subscribedEmailUsers.find(u => String(u.user_id) === targetId);
            if (match) displayName = match.user_name || match.email_address;
          }

          AppState.scheduledEmails.push({
            id: serverEmail.id,
            server_id: serverEmail.id,
            recipient: displayName || this._normTarget(serverEmail.target_user_id),
            subject: serverEmail.subject || '',
            message_content: this._normText(serverEmail.message),
            scheduled_time: this._normTime(serverEmail.scheduled_timestamp),
            scheduled_timestamp: this._normTime(serverEmail.scheduled_timestamp),
            target_user_id: this._normTarget(serverEmail.target_user_id),
            status: serverEmail.is_sent ? 'sent' : 'pending',
            created_at: serverEmail.created_at || new Date().toISOString(),
            sent_at: serverEmail.sent_at,
            from_sender: AppState.userId,
            file_paths: serverEmail.file_paths || [],
            platform: 'email'
          });

          addedCount++;
        }
      });

      // 3) Dedupe by ID
      const byId = new Map();
      AppState.scheduledEmails.forEach(m => {
        const idKey = String(m.server_id || m.id || '');
        if (!idKey) return;
        if (!byId.has(idKey)) {
          byId.set(idKey, m);
        } else {
          const better = this._chooseBetter(byId.get(idKey), m);
          byId.set(idKey, better);
        }
      });
      AppState.scheduledEmails = Array.from(byId.values());

      if (addedCount > 0 || emailsToRemove.length > 0) {
        if (AppState.currentView === 'scheduling' && typeof renderScheduling === 'function') {
          renderScheduling();
        }
      }

      return serverEmails;
    } catch (error) {
      console.error('Error syncing emails from server:', error);
    }
  },

  async syncTeamMemberEmails() {
    try {
      const teamMembers = AppState.timelineTeamMembers || [];
      const existingEmails = (AppState.subscribedEmailUsers || []).map(u =>
        (u.email_address || '').toLowerCase()
      );

      // Find team members with emails not yet subscribed
      const toSubscribe = teamMembers.filter(m =>
        m.email && m.email.trim() !== '' &&
        !existingEmails.includes(m.email.toLowerCase())
      );

      if (toSubscribe.length === 0) return;

      let added = 0;
      for (const member of toSubscribe) {
        try {
          await this.subscribeEmailUser(member.email, member.name);
          added++;
        } catch (err) {
          // 400 = already exists, which is fine
          if (!err?.message?.includes('already exists')) {
            console.warn(`Failed to subscribe ${member.name} (${member.email}):`, err?.message || err);
          }
        }
      }

      if (added > 0) {
        await this.fetchSubscribedEmailUsers();
      }
    } catch (error) {
      console.error('Error syncing team member emails:', error);
    }
  }
};

// Expose AzureVMAPI to global scope
if (typeof window !== 'undefined') {
  window.AzureVMAPI = AzureVMAPI;
}
