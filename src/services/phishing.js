const axios = require('axios');
const logger = require('../utils/logger');

const SCAM_PATTERNS = [
  /discordgift[^\s]*/i, /steamcommunity\.com\/offer/i, /free\s*steam/i,
  /nitro\s*generator/i, /free\s*nitro/i, /giveaway\s*nitro/i,
  /gift\s*nitro/i, /claim\s*nitro/i, /steam\.gift/i,
  /discord\.gift(?!\s)/i,
];

let cachedDomains = [];
let lastFetch = 0;

async function refreshDomains() {
  if (Date.now() - lastFetch < 600000) return cachedDomains;
  try {
    const res = await axios.get('https://openphish.com/feed.txt', { timeout: 10000 });
    cachedDomains = res.data.split('\n').filter(Boolean).map(u => {
      try {
        const urlStr = u.includes('://') ? u : `http://${u}`;
        return new URL(urlStr).hostname;
      } catch { return null; }
    }).filter(Boolean);
    lastFetch = Date.now();
    logger.info(`釣魚資料庫已更新: ${cachedDomains.length} 個惡意網域`);
  } catch { logger.warn('釣魚資料庫更新失敗'); }
  return cachedDomains;
}

function extractDomains(text) {
  const urls = text.match(/https?:\/\/[^\s]+/gi) || [];
  return urls.map(u => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean);
}

function checkScamPatterns(text) {
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

module.exports = {
  async check(text) {
    const hasScamPattern = checkScamPatterns(text);
    if (hasScamPattern) return { flagged: true, reason: '疑似詐騙/釣魚訊息' };

    const domains = extractDomains(text);
    if (domains.length === 0) return { flagged: false };

    const list = await refreshDomains();
    for (const domain of domains) {
      if (list.includes(domain)) return { flagged: true, reason: `惡意網域: ${domain}` };
    }
    return { flagged: false };
  },
};
