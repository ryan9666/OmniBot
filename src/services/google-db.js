const axios = require('axios');
const logger = require('../utils/logger');

let WEB_APP_URL = process.env.GOOGLE_DB_URL || '';

const API = {
  setUrl(url) { WEB_APP_URL = url; },

  async get(guildId) {
    if (!WEB_APP_URL) return null;
    try {
      const token = process.env.GOOGLE_DB_TOKEN || '';
      const { data } = await axios.get(`${WEB_APP_URL}?guild=${guildId}&action=get&token=${encodeURIComponent(token)}`, { timeout: 10000 });
      return data.settings || null;
    } catch { return null; }
  },

  async set(guildId, settings) {
    if (!WEB_APP_URL) { logger.info('[GSheet] set: WEB_APP_URL 未設定'); return false; }
    try {
      const token = process.env.GOOGLE_DB_TOKEN || '';
      await axios.post(WEB_APP_URL, { guildId, settings, action: 'set', token }, { timeout: 10000 });
      return true;
    } catch (err) {
      logger.error(`[GSheet] set(${guildId}) 失敗:`, err.message);
      return false;
    }
  },

  async getAll() {
    if (!WEB_APP_URL) { logger.info('[GSheet] WEB_APP_URL 未設定'); return {}; }
    try {
      const token = process.env.GOOGLE_DB_TOKEN || '';
      const { data } = await axios.get(`${WEB_APP_URL}?action=getAll&token=${encodeURIComponent(token)}`, { timeout: 15000 });
      return data.allSettings || {};
    } catch (err) {
      logger.error('[GSheet] getAll 失敗:', err.message);
      return {};
    }
  },

  async health() {
    if (!WEB_APP_URL) return false;
    try {
      const token = process.env.GOOGLE_DB_TOKEN || '';
      const { data } = await axios.get(`${WEB_APP_URL}?action=ping&token=${encodeURIComponent(token)}`, { timeout: 5000 });
      return data.status === 'ok';
    } catch { return false; }
  },
};

module.exports = API;
