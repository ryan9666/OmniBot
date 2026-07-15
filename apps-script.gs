// ===== OmniBot 資料庫 - Google Apps Script =====
// 部署方式：工具 -> 指令碼編輯器 -> 貼上此程式碼 -> 部署 -> 新增部署 -> 網頁應用程式

const DB_SHEET = 'OmniBotDB';
const LOG_SHEET = 'MessageLog';

const API_TOKEN = PropertiesService.getScriptProperties().getProperty('API_TOKEN');

function doGet(e) {
  const token = e?.parameter?.token;
  if (API_TOKEN && token !== API_TOKEN) return json({ error: 'unauthorized' });

  const action = e?.parameter?.action;
  const guildId = e?.parameter?.guild;

  try {
    if (action === 'ping') return json({ status: 'ok' });

    if (action === 'get' && guildId) {
      const val = getProp(guildId);
      return json({ settings: val ? JSON.parse(val) : null });
    }

    if (action === 'getAll') {
      const all = getAllProps();
      return json({ allSettings: all });
    }

    if (action === 'debug') {
      const sheet = getSheet(DB_SHEET);
      const data = sheet.getDataRange().getValues();
      const rows = [];
      for (let i = 0; i < data.length; i++) {
        rows.push({ row: i, col0: data[i][0]?.slice(0,20), col1: data[i][1]?.slice(0,80), col1Len: data[i][1]?.length });
      }
      let parseOk = false, parseErr = '';
      if (data.length > 1 && data[1][1]) {
        try { JSON.parse(data[1][1]); parseOk = true; } catch (e) { parseErr = e.message; }
      }
      return json({ sheetName: DB_SHEET, totalRows: data.length, rows, parseOk, parseErr });
    }

    if (action === 'getLog') {
      const rows = getLogRows(e?.parameter?.guild, parseInt(e?.parameter?.limit) || 100);
      return json({ rows });
    }

    return json({ error: 'unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = typeof e?.postData?.contents === 'string'
      ? JSON.parse(e.postData.contents) : e?.parameter || {};

    const token = e?.parameter?.token || body?.token;
    if (API_TOKEN && token !== API_TOKEN) return json({ error: 'unauthorized' });

    const { guildId, settings, action, logEntry } = body;

    if (action === 'set' && guildId) {
      setProp(guildId, JSON.stringify(settings));
      return json({ success: true });
    }

    if (action === 'log' && logEntry) {
      addLogRow(logEntry);
      return json({ success: true });
    }

    if (action === 'logBatch' && Array.isArray(logEntry)) {
      for (const entry of logEntry) addLogRow(entry);
      return json({ success: true, count: logEntry.length });
    }

    return json({ error: 'unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ===== Settings (key-value) =====
function getProp(key) {
  const sheet = getSheet(DB_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) return data[i][1] || null;
  }
  return null;
}

function setProp(key, val) {
  const sheet = getSheet(DB_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(val);
      return;
    }
  }
  sheet.appendRow([key, val]);
}

function getAllProps() {
  const sheet = getSheet(DB_SHEET);
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        let raw = data[i][1] || '{}';
        raw = raw.replace(/\{\s*""\s*\}/g, '{}');
        result[String(data[i][0])] = JSON.parse(raw);
      } catch (e) {
        console.error(`Row ${i} JSON parse error: ${e.message}`);
      }
    }
  }
  return result;
}

// ===== Message Log =====
function addLogRow(entry) {
  const sheet = getSheet(LOG_SHEET);
  sheet.appendRow([
    entry.time || new Date().toISOString(),
    entry.guildId || '',
    entry.channelId || '',
    entry.channelName || '',
    entry.authorId || '',
    entry.authorTag || '',
    entry.content || '',
    entry.url || '',
  ]);
}

function getLogRows(guildId, limit) {
  const sheet = getSheet(LOG_SHEET);
  const data = sheet.getDataRange().getValues();
  const rows = [];
  const start = Math.max(1, data.length - limit);
  for (let i = start; i < data.length; i++) {
    const r = data[i];
    if (!guildId || String(r[1]) === String(guildId)) {
      rows.push({
        time: r[0], guildId: r[1], channelId: r[2],
        channelName: r[3], authorId: r[4], authorTag: r[5],
        content: r[6], url: r[7],
      });
    }
  }
  return rows;
}

// ===== Helpers =====
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === DB_SHEET) sheet.appendRow(['guild_id', 'settings_json']);
    if (name === LOG_SHEET) sheet.appendRow(['time', 'guildId', 'channelId', 'channelName', 'authorId', 'authorTag', 'content', 'url']);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
