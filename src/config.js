/**
 * ============================================================
 * CONFIG.JS - Central Configuration Manager
 * Location: src/config.js
 * ============================================================
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ─── Directory Structure ─────────────────────────────────────
const DIRS = {
  data:      path.join(__dirname, '../data'),
  users:     path.join(__dirname, '../data/users'),
  sessions:  path.join(__dirname, '../data/sessions'),
  whatsapp:  path.join(__dirname, '../data/whatsapp'),
  logs:      path.join(__dirname, '../data/logs'),
  backups:   path.join(__dirname, '../data/backups'),
  config:    path.join(__dirname, '../data/config'),
  tickets:   path.join(__dirname, '../data/tickets'),
  broadcast: path.join(__dirname, '../data/broadcast'),
};

// ─── Create All Directories ──────────────────────────────────
Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ─── Default Settings ────────────────────────────────────────
const DEFAULT_SETTINGS = {
  app: {
    name: process.env.APP_NAME || 'TeleMonitor Pro',
    version: process.env.APP_VERSION || '1.0.0',
    support_username: '@admin',
    footer_text: '🤖 Powered by TeleMonitor Pro',
    welcome_message: '👋 Welcome to TeleMonitor Pro!\nMonitor your Telegram messages in real-time.',
    maintenance_mode: false,
    maintenance_message: '🔧 System under maintenance. Please try again later.',
  },
  features: {
    force_join: false,
    bio_verification: false,
    personal_whatsapp: true,
    admin_whatsapp: false,
    support_system: true,
    broadcast_system: true,
    keyword_alerts: true,
    silent_mode: true,
  },
  bio: {
    required_text: '@YourBotName',
    check_interval_hours: 24,
    bypass_premium: true,
    whitelisted_users: [],
  },
  force_join: {
    channels: [],
    message: '📢 Please join our required channels to use this bot!',
    verify_message: '✅ Verification successful! You can now use the bot.',
    cache_duration_minutes: 30,
  },
  alerts: {
    cooldown_seconds: 5,
    max_alerts_per_minute: 20,
    duplicate_window_seconds: 30,
    admin_wa_number: process.env.ADMIN_WA_NUMBER || '',
    admin_wa_display: '',
    admin_wa_enabled: false,
    wa_optin_required: true,
  },
  branding: {
    logo_emoji: '🔔',
    alert_emoji: '⚡',
    success_emoji: '✅',
    error_emoji: '❌',
    warning_emoji: '⚠️',
    info_emoji: 'ℹ️',
  },
  rate_limit: {
    commands_per_minute: 20,
    messages_per_minute: 10,
    tickets_per_hour: 3,
    broadcast_delay_ms: 100,
  },
  admin: {
    ids: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
    owner_id: parseInt(process.env.OWNER_ID) || 0,
    roles: {},
  },
};

// ─── Default User Template ───────────────────────────────────
const DEFAULT_USER = (userId) => ({
  user_id: userId,
  username: null,
  first_name: null,
  last_name: null,
  created_at: new Date().toISOString(),
  last_seen: new Date().toISOString(),
  is_banned: false,
  ban_reason: null,
  is_premium: false,
  premium_expires: null,
  bio_verified: false,
  bio_verified_at: null,
  bio_whitelisted: false,
  force_join_verified: false,
  force_join_verified_at: null,
  telegram: {
    logged_in: false,
    api_id: null,
    api_hash: null,
    phone: null,
    session_string: null,
    login_at: null,
    monitoring_active: false,
    monitoring_started_at: null,
    client_connected: false,
  },
  whatsapp: {
    mode: 'none',
    receive_mode: 'none',
    receive_number: null,
    personal_connected: false,
    personal_number: null,
    personal_connected_at: null,
    admin_mode_enabled: false,
    optin_status: null,
    optin_verified: false,
    optin_requested_at: null,
    optin_verified_at: null,
    custom_number_set_at: null,
  },
  alerts: {
    enabled: true,
    dm_alerts: true,
    mention_alerts: true,
    reply_alerts: true,
    group_alerts: true,
    silent_mode: false,
    keyword_alerts: false,
    keywords: [],
    ignored_chats: [],
    ignored_users: [],
    priority_only: false,
    mentions_only: false,
    groups_only: false,
    private_only: false,
  },
  stats: {
    total_alerts_sent: 0,
    total_messages_monitored: 0,
    sessions_created: 0,
    last_alert_at: null,
  },
  cooldowns: {
    last_command: null,
    last_alert: null,
    last_ticket: null,
    command_count: 0,
    alert_count: 0,
  },
  login_state: {
    step: null,
    api_id: null,
    api_hash: null,
    phone: null,
    phone_code_hash: null,
    awaiting: null,
  },
  support: {
    tickets: [],
    is_spam_banned: false,
  },
});

// ─── Config Manager Class ────────────────────────────────────
class ConfigManager {
  constructor() {
    this.settingsPath = path.join(DIRS.config, 'settings.json');
    this.settings = null;
    this.loadSettings();
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        const saved = JSON.parse(raw);
        this.settings = this.deepMerge(DEFAULT_SETTINGS, saved);
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
        this.saveSettings();
      }
    } catch (err) {
      console.error('[CONFIG] Error loading settings:', err.message);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.settings.admin.ids = (process.env.ADMIN_IDS || '')
      .split(',').map(id => parseInt(id.trim())).filter(Boolean);
    this.settings.admin.owner_id = parseInt(process.env.OWNER_ID) || 0;
    return this.settings;
  }

  saveSettings() {
    try {
      const tmp = this.settingsPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2));
      fs.renameSync(tmp, this.settingsPath);
      return true;
    } catch (err) {
      console.error('[CONFIG] Error saving settings:', err.message);
      return false;
    }
  }

  get(keyPath, defaultValue = null) {
    const keys = keyPath.split('.');
    let current = this.settings;
    for (const key of keys) {
      if (current === undefined || current === null) return defaultValue;
      current = current[key];
    }
    return current !== undefined ? current : defaultValue;
  }

  set(keyPath, value) {
    const keys = keyPath.split('.');
    let current = this.settings;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    this.saveSettings();
    return this;
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  isAdmin(userId) {
    return this.settings.admin.ids.includes(parseInt(userId));
  }

  isOwner(userId) {
    return parseInt(userId) === this.settings.admin.owner_id;
  }

  getAll() {
    return this.settings;
  }

  reload() {
    return this.loadSettings();
  }
}

const config = new ConfigManager();

module.exports = {
  config,
  DIRS,
  DEFAULT_USER,
  DEFAULT_SETTINGS,
  isAdmin: (id) => config.isAdmin(id),
  isOwner: (id) => config.isOwner(id),
  getSetting: (key, def) => config.get(key, def),
  setSetting: (key, val) => config.set(key, val),
};
