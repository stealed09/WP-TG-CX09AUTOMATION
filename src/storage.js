/**
 * ============================================================
 * STORAGE.JS - JSON Storage Engine
 * Location: src/storage.js
 * ============================================================
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Mutex } = require('async-mutex');
const { DIRS, DEFAULT_USER } = require('./config');

// ─── Mutex Map ───────────────────────────────────────────────
const mutexMap = new Map();

function getMutex(filePath) {
  if (!mutexMap.has(filePath)) {
    mutexMap.set(filePath, new Mutex());
  }
  return mutexMap.get(filePath);
}

// ─── Safe Read ───────────────────────────────────────────────
async function safeReadJSON(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = await fsp.readFile(filePath, 'utf8');
    if (!raw || raw.trim() === '') return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[STORAGE] Read error for ${filePath}:`, err.message);
    const backupPath = filePath + '.bak';
    if (fs.existsSync(backupPath)) {
      try {
        const raw = await fsp.readFile(backupPath, 'utf8');
        return JSON.parse(raw);
      } catch (_) {}
    }
    return defaultValue;
  }
}

// ─── Safe Write ──────────────────────────────────────────────
async function safeWriteJSON(filePath, data) {
  const mutex = getMutex(filePath);
  return await mutex.runExclusive(async () => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fsp.mkdir(dir, { recursive: true });
    }
    const tmp = filePath + '.tmp';
    try {
      const json = JSON.stringify(data, null, 2);
      await fsp.writeFile(tmp, json, 'utf8');
      if (fs.existsSync(filePath)) {
        await fsp.copyFile(filePath, filePath + '.bak');
      }
      await fsp.rename(tmp, filePath);
      return true;
    } catch (err) {
      console.error(`[STORAGE] Write error for ${filePath}:`, err.message);
      if (fs.existsSync(tmp)) {
        try { await fsp.unlink(tmp); } catch (_) {}
      }
      return false;
    }
  });
}

// ─── User Storage Class ──────────────────────────────────────
class UserStorage {
  constructor(userId) {
    this.userId = String(userId);
    this.filePath = path.join(DIRS.users, `${this.userId}.json`);
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = 5000;
  }

  getPath() { return this.filePath; }

  async load() {
    const now = Date.now();
    if (this._cache && (now - this._cacheTime) < this._cacheTTL) {
      return this._cache;
    }
    let data = await safeReadJSON(this.filePath, null);
    if (!data) {
      data = DEFAULT_USER(parseInt(this.userId));
      await this.save(data);
    }
    data = this._mergeWithDefault(data);
    this._cache = data;
    this._cacheTime = now;
    return data;
  }

  async save(data) {
    this._cache = data;
    this._cacheTime = Date.now();
    return await safeWriteJSON(this.filePath, data);
  }

  async update(updates) {
    const data = await this.load();
    const updated = this._deepUpdate(data, updates);
    updated.last_seen = new Date().toISOString();
    return await this.save(updated);
  }

  async get(keyPath) {
    const data = await this.load();
    return this._getByPath(data, keyPath);
  }

  async set(keyPath, value) {
    const data = await this.load();
    this._setByPath(data, keyPath, value);
    data.last_seen = new Date().toISOString();
    return await this.save(data);
  }

  async delete() {
    this._cache = null;
    if (fs.existsSync(this.filePath)) {
      await fsp.unlink(this.filePath);
    }
    const bak = this.filePath + '.bak';
    if (fs.existsSync(bak)) {
      await fsp.unlink(bak);
    }
  }

  exists() {
    return fs.existsSync(this.filePath);
  }

  _mergeWithDefault(data) {
    const def = DEFAULT_USER(parseInt(this.userId));
    return this._deepMerge(def, data);
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  _deepUpdate(obj, updates) {
    for (const key in updates) {
      if (updates[key] !== null && typeof updates[key] === 'object' &&
          !Array.isArray(updates[key]) && obj[key] !== undefined) {
        obj[key] = this._deepUpdate(obj[key] || {}, updates[key]);
      } else {
        obj[key] = updates[key];
      }
    }
    return obj;
  }

  _getByPath(obj, path) {
    return path.split('.').reduce((curr, key) =>
      curr && curr[key] !== undefined ? curr[key] : undefined, obj);
  }

  _setByPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((curr, key) => {
      if (!curr[key]) curr[key] = {};
      return curr[key];
    }, obj);
    target[last] = value;
  }

  invalidate() {
    this._cache = null;
    this._cacheTime = 0;
  }
}

// ─── Global Storage ──────────────────────────────────────────
class GlobalStorage {
  constructor(filename) {
    this.filePath = path.join(DIRS.config, filename);
    this._cache = null;
  }

  async load(defaultValue = {}) {
    if (!this._cache) {
      this._cache = await safeReadJSON(this.filePath, defaultValue);
    }
    return this._cache;
  }

  async save(data) {
    this._cache = data;
    return await safeWriteJSON(this.filePath, data);
  }

  async update(updates) {
    const data = await this.load();
    Object.assign(data, updates);
    return await this.save(data);
  }

  async get(key, defaultValue = null) {
    const data = await this.load();
    return data[key] !== undefined ? data[key] : defaultValue;
  }

  async set(key, value) {
    const data = await this.load();
    data[key] = value;
    return await this.save(data);
  }

  invalidate() { this._cache = null; }
}

// ─── Ticket Storage ──────────────────────────────────────────
class TicketStorage {
  constructor() {
    this.dir = DIRS.tickets;
    this.indexPath = path.join(this.dir, 'index.json');
  }

  async createTicket(userId, username, subject, message) {
    const index = await safeReadJSON(this.indexPath, { tickets: [], last_id: 0 });
    const ticketId = `TKT-${String(++index.last_id).padStart(5, '0')}`;
    const ticket = {
      id: ticketId,
      user_id: userId,
      username: username,
      subject,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [{ from: 'user', text: message, at: new Date().toISOString() }],
    };
    const ticketPath = path.join(this.dir, `${ticketId}.json`);
    await safeWriteJSON(ticketPath, ticket);
    index.tickets.push({
      id: ticketId,
      user_id: userId,
      status: 'open',
      created_at: ticket.created_at
    });
    await safeWriteJSON(this.indexPath, index);
    return ticket;
  }

  async getTicket(ticketId) {
    const ticketPath = path.join(this.dir, `${ticketId}.json`);
    return await safeReadJSON(ticketPath, null);
  }

  async updateTicket(ticketId, updates) {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return null;
    Object.assign(ticket, updates, { updated_at: new Date().toISOString() });
    const ticketPath = path.join(this.dir, `${ticketId}.json`);
    await safeWriteJSON(ticketPath, ticket);
    await this._updateIndex(ticketId, { status: ticket.status });
    return ticket;
  }

  async addMessage(ticketId, from, text) {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return null;
    ticket.messages.push({ from, text, at: new Date().toISOString() });
    ticket.updated_at = new Date().toISOString();
    if (from === 'admin') ticket.status = 'replied';
    const ticketPath = path.join(this.dir, `${ticketId}.json`);
    await safeWriteJSON(ticketPath, ticket);
    return ticket;
  }

  async getAllTickets(status = null) {
    const index = await safeReadJSON(this.indexPath, { tickets: [] });
    if (status) return index.tickets.filter(t => t.status === status);
    return index.tickets;
  }

  async getUserTickets(userId) {
    const index = await safeReadJSON(this.indexPath, { tickets: [] });
    return index.tickets.filter(t => t.user_id === userId);
  }

  async _updateIndex(ticketId, updates) {
    const index = await safeReadJSON(this.indexPath, { tickets: [] });
    const ticket = index.tickets.find(t => t.id === ticketId);
    if (ticket) Object.assign(ticket, updates);
    await safeWriteJSON(this.indexPath, index);
  }
}

// ─── Logger ──────────────────────────────────────────────────
class Logger {
  constructor() {
    this.logDir = DIRS.logs;
  }

  async log(type, data) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `${type}-${date}.json`);
    const mutex = getMutex(logFile);
    await mutex.runExclusive(async () => {
      let logs = await safeReadJSON(logFile, []);
      logs.push({ timestamp: new Date().toISOString(), ...data });
      if (logs.length > 1000) logs = logs.slice(-1000);
      await safeWriteJSON(logFile, logs);
    });
  }

  async error(message, error, extra = {}) {
    await this.log('error', {
      message,
      error: error?.message,
      stack: error?.stack,
      ...extra
    });
  }

  async activity(userId, action, extra = {}) {
    await this.log('activity', { user_id: userId, action, ...extra });
  }

  async alert(userId, type, extra = {}) {
    await this.log('alerts', { user_id: userId, type, ...extra });
  }

  async broadcast(broadcastId, extra = {}) {
    await this.log('broadcast', { broadcast_id: broadcastId, ...extra });
  }

  async getRecentLogs(type, limit = 50) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `${type}-${date}.json`);
    const logs = await safeReadJSON(logFile, []);
    return logs.slice(-limit);
  }
}

// ─── Backup System ───────────────────────────────────────────
class BackupSystem {
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(DIRS.backups, timestamp);
    await fsp.mkdir(backupDir, { recursive: true });

    const usersBackup = path.join(backupDir, 'users');
    await fsp.mkdir(usersBackup, { recursive: true });
    const userFiles = fs.readdirSync(DIRS.users).filter(f => f.endsWith('.json'));
    for (const file of userFiles) {
      await fsp.copyFile(
        path.join(DIRS.users, file),
        path.join(usersBackup, file)
      );
    }

    const configBackup = path.join(backupDir, 'config');
    await fsp.mkdir(configBackup, { recursive: true });
    if (fs.existsSync(DIRS.config)) {
      const configFiles = fs.readdirSync(DIRS.config).filter(f => f.endsWith('.json'));
      for (const file of configFiles) {
        await fsp.copyFile(
          path.join(DIRS.config, file),
          path.join(configBackup, file)
        );
      }
    }

    console.log(`[BACKUP] Created: ${timestamp}`);
    return { timestamp, dir: backupDir };
  }

  async getBackups() {
    if (!fs.existsSync(DIRS.backups)) return [];
    const dirs = fs.readdirSync(DIRS.backups);
    return dirs.map(d => ({ name: d, path: path.join(DIRS.backups, d) }));
  }

  async cleanOldBackups(keepLast = 5) {
    const backups = await this.getBackups();
    if (backups.length <= keepLast) return;
    const toDelete = backups.slice(0, backups.length - keepLast);
    for (const backup of toDelete) {
      await fsp.rm(backup.path, { recursive: true, force: true });
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────
async function getAllUsers() {
  if (!fs.existsSync(DIRS.users)) return [];
  const files = fs.readdirSync(DIRS.users)
    .filter(f => f.endsWith('.json') && !f.endsWith('.bak'));
  const users = [];
  for (const file of files) {
    const userId = file.replace('.json', '');
    const storage = new UserStorage(userId);
    const data = await storage.load();
    if (data) users.push(data);
  }
  return users;
}

function countUsers() {
  if (!fs.existsSync(DIRS.users)) return 0;
  return fs.readdirSync(DIRS.users)
    .filter(f => f.endsWith('.json') && !f.endsWith('.bak')).length;
}

// ─── Exports ─────────────────────────────────────────────────
module.exports = {
  UserStorage,
  GlobalStorage,
  TicketStorage,
  Logger,
  BackupSystem,
  safeReadJSON,
  safeWriteJSON,
  getAllUsers,
  countUsers,
  logger: new Logger(),
  backup: new BackupSystem(),
  tickets: new TicketStorage(),
  globalStore: new GlobalStorage('global.json'),
  broadcastStore: new GlobalStorage('broadcast.json'),
};
