// simpleStore.js - Simple key-value store for Electron
// Used to persist authentication tokens and user data.
// String values are encrypted at rest using Electron's safeStorage API
// (Windows DPAPI / macOS Keychain / Linux secret service) when available.

const fs = require('fs');
const path = require('path');

class SimpleStore {
  constructor() {
    this.filePath = null;
    this.data = {};
    this.loaded = false;
  }

  getFilePath() {
    if (!this.filePath) {
      try {
        const { app } = require('electron');
        if (app.isReady()) {
          const userDataPath = app.getPath('userData');
          this.filePath = path.join(userDataPath, 'community-curator-store.json');
        } else {
          this.filePath = path.join(__dirname, '.temp-store.json');
        }
      } catch (error) {
        this.filePath = path.join(__dirname, '.temp-store.json');
      }
    }
    return this.filePath;
  }

  // Returns the safeStorage module if encryption is available, otherwise null.
  _safeStorage() {
    try {
      const { app, safeStorage } = require('electron');
      if (app.isReady() && safeStorage.isEncryptionAvailable()) {
        return safeStorage;
      }
    } catch (_) {}
    return null;
  }

  load() {
    try {
      const filePath = this.getFilePath();
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const ss = this._safeStorage();
        this.data = {};
        for (const [key, value] of Object.entries(raw)) {
          // Encrypted entries are stored as { _enc: true, d: '<base64>' }
          if (value && typeof value === 'object' && value._enc === true) {
            if (ss) {
              try {
                this.data[key] = ss.decryptString(Buffer.from(value.d, 'base64'));
              } catch (e) {
                console.warn(`Could not decrypt store key "${key}" — skipping`);
              }
            }
            // If safeStorage is unavailable we skip encrypted entries rather than
            // storing them as plaintext, forcing a fresh auth when needed.
          } else {
            // Plain value from an older store — keep as-is; will be encrypted on next save.
            this.data[key] = value;
          }
        }
        this.loaded = true;
        console.log('✓ Store loaded from:', filePath);
      } else {
        this.data = {};
        this.loaded = true;
        console.log('No existing store, starting fresh');
      }
    } catch (error) {
      console.error('Error loading store:', error);
      this.data = {};
      this.loaded = true;
    }
  }

  save() {
    try {
      const filePath = this.getFilePath();
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const ss = this._safeStorage();
      const serialisable = {};
      for (const [key, value] of Object.entries(this.data)) {
        if (typeof value === 'string' && ss) {
          // Encrypt string values using OS-level storage
          serialisable[key] = { _enc: true, d: ss.encryptString(value).toString('base64') };
        } else {
          serialisable[key] = value;
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(serialisable, null, 2), 'utf8');
      console.log('✓ Store saved to:', filePath);
    } catch (error) {
      console.error('✗ Error saving store:', error);
    }
  }

  get(key) {
    if (!this.loaded) {
      this.load();
    }
    return this.data[key];
  }

  set(key, value) {
    if (!this.loaded) {
      this.load();
    }
    this.data[key] = value;
    this.save();
  }

  delete(key) {
    if (!this.loaded) {
      this.load();
    }
    delete this.data[key];
    this.save();
  }

  clear() {
    if (!this.loaded) {
      this.load();
    }
    this.data = {};
    this.save();
  }

  has(key) {
    if (!this.loaded) {
      this.load();
    }
    return key in this.data;
  }

  getAll() {
    if (!this.loaded) {
      this.load();
    }
    return { ...this.data };
  }
}

module.exports = SimpleStore;
