const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const googleDb = require('./google-db');

const SETTINGS_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

let cache = null;
let useGoogle = false;
let writeQueue = Promise.resolve();

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    logger.info(`建立資料目錄: ${SETTINGS_DIR}`);
  }
}

function getDefaults() {
  return {
    welcome: { enabled: false, channelId: '', message: '', image: '' },
    farewell: { enabled: false, channelId: '', message: '' },
    selfRoles: [],
    roleGroups: [],
    autoVoice: { channelId: '', categoryId: '', nameTemplate: '', userLimit: 0, bitrate: 64000, rtcRegion: '', logging: false },
    ticket: { categoryId: '', roleIds: [], channelId: '' },
    autoMod: { enabled: false, words: [], regexWords: [], blockLinks: false, phishingProtection: false, logChannelId: '', punishment: 'delete', timeoutMinutes: 10, logLevel: 'all', strikes: {}, strikeResetHours: 24, userStrikes: {} },
    roleGive: { channelId: '' },
    messageLog: { channelId: '' },
    messageLogAll: { enabled: false },
    inviteGuard: { enabled: false, whitelist: [], logChannelId: '' },
    appeal: { channelId: '' },
    githubWebhook: { channelId: '' },
    antiRaid: { enabled: false, joinThreshold: 5, joinWindow: 10, spamThreshold: 5, spamWindow: 5, spamTimeout: 1, action: 'kick', logChannelId: '' },
    inviteLog: { channelId: '' },
    adminRoles: { topIds: [], modIds: [] },
    blockedUsers: [],
    customCommands: {},
    autoRoleId: '',
    warnings: {},
    verification: { channelId: '', roleId: '', messageId: '', enabled: false },
    modLog: { channelId: '' },
    tempBans: {},
    autoNick: { enabled: false, template: '', roles: {} },
  };
}

async function loadFromGoogle() {
  try {
    logger.info('[GSheet] 正在從 Google Sheets 載入設定...');
    const all = await googleDb.getAll();
    const keys = all ? Object.keys(all) : [];
    logger.info(`[GSheet] Google Sheets 回傳 ${keys.length} 個伺服器`);
    if (keys.length > 0) {
      cache = {};
      for (const [gid, data] of Object.entries(all)) {
        cache[gid] = { ...getDefaults(), ...data };
      }
      save();
      logger.info(`[GSheet] 從 Google Sheets 載入 ${keys.length} 個伺服器設定`);
      return true;
    }
    logger.warn('[GSheet] Google Sheets 中無設定資料');
    await syncToGoogle();
  } catch (err) {
    logger.error('[GSheet] loadFromGoogle 失敗:', err.message);
  }
  return false;
}

async function syncToGoogle() {
  try {
    load();
    const keys = Object.keys(cache || {});
    logger.info(`[GSheet] syncToGoogle: 本地有 ${keys.length} 個伺服器`);
    if (keys.length === 0) return;
    let count = 0;
    for (const [gid, data] of Object.entries(cache)) {
      const ok = await googleDb.set(gid, data);
      if (ok) count++;
      else logger.error(`[GSheet] syncToGoogle: ${gid} 寫入失敗`);
    }
    logger.info(`[GSheet] syncToGoogle 完成: ${count}/${keys.length} 個伺服器已上傳`);
  } catch (err) {
    logger.error('[GSheet] syncToGoogle 失敗:', err.message);
  }
}

function load() {
  if (cache) return cache;
  ensureDir();
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      cache = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } else {
      cache = {};
      save();
    }
  } catch (err) {
    logger.error('讀取設定檔失敗:', err.message);
    cache = {};
  }
  return cache;
}

function save() {
  ensureDir();
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    logger.error('儲存設定檔失敗:', err.message);
  }
}

function getGuildSettings(guildId) {
  const data = load();
  if (!data[guildId]) {
    data[guildId] = { ...getDefaults() };
    save();
  }
  return data[guildId];
}

function updateGuildSettings(guildId, settings) {
  const data = load();
  data[guildId] = { ...data[guildId], ...settings };
  save();
  if (useGoogle) {
    writeQueue = writeQueue.then(() =>
      googleDb.set(guildId, data[guildId]).catch(err => logger.warn('settings Google Sheets 同步失敗:', err.message))
    );
  }
  return data[guildId];
}

async function init() {
  const url = process.env.GOOGLE_DB_URL;
  logger.info(`[GSheet] GOOGLE_DB_URL = ${url ? '已設定' : '未設定'}`);
  if (url) {
    googleDb.setUrl(url);
    logger.info('[GSheet] 正在連線 Google Sheets...');
    const ok = await googleDb.health();
    logger.info(`[GSheet] 連線結果: ${ok ? '成功' : '失敗'}`);
    if (ok) {
      useGoogle = true;
      logger.info('[GSheet] 正在從 Google Sheets 載入設定...');
      const loaded = await loadFromGoogle();
      logger.info(`[GSheet] 載入結果: ${loaded ? '成功' : '無資料，使用本地 JSON'}`);
      startSync();
    } else {
      logger.warn('Google Sheets 連線失敗，使用本地 JSON');
    }
  }
}

let syncTimer = null;

function startSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    try {
      const fresh = await googleDb.getAll();
      if (fresh && Object.keys(fresh).length > 0) {
        const data = load();
        const oldKeys = Object.keys(data);
        let changed = 0;
        for (const [gid, gs] of Object.entries(fresh)) {
          if (!data[gid]) {
            data[gid] = { ...getDefaults(), ...gs };
            changed++;
          } else {
            const merged = { ...data[gid], ...gs };
            if (JSON.stringify(merged) !== JSON.stringify(data[gid])) {
              data[gid] = merged;
              changed++;
            }
          }
        }
        save();
        if (changed > 0) logger.info(`Google Sheets 同步完成，${changed} 個伺服器有更新`);
      }
    } catch (err) {
      logger.error(`Google Sheets 同步失敗:`, err.message);
    }
  }, 5 * 60 * 1000);
}

module.exports = { load, getGuildSettings, updateGuildSettings, init };
