// simpleStore.js - Simple key-value store for Electron
// Used to persist authentication tokens and user data

const fs = require('fs');
const path = require('path');

class SimpleStore {
  constructor() {
    // Use a simple path that works immediately
    // Will be updated to userData path when app is ready
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
          // Use temp path until app is ready
          this.filePath = path.join(__dirname, '.temp-store.json');
        }
      } catch (error) {
        this.filePath = path.join(__dirname, '.temp-store.json');
      }
    }
    return this.filePath;
  }

  load() {
    try {
      const filePath = this.getFilePath();
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        this.data = JSON.parse(fileData);
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

      const jsonData = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
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
