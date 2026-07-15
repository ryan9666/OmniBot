const client = require('./src/client');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { deploy } = require('./src/utils/deploy-commands');
const { registerCommands, registerEvents } = require('./src/utils/command-handler');
const logCapture = require('./src/utils/log-capture');
const settings = require('./src/services/settings');
const path = require('path');
const crypto = require('crypto');

registerCommands(client);
registerEvents(client);

async function startBot() {
  await settings.init();
  await deploy();
  await client.login(config.discord.token);
  logger.info('Bot 已上線');
}

startBot().catch(err => {
  logger.error('Bot 啟動失敗:', err);
  console.error('完整錯誤:', err.stack);
  process.exit(1);
});

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fs = require('fs');
const sessionDir = path.join(__dirname, 'data', 'sessions');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
let sessionSecret = process.env.SESSION_SECRET;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || (config.discord.redirectUri ? new URL(config.discord.redirectUri).origin : '');

if (!sessionSecret) {
  const secretFile = path.join(__dirname, 'data', 'session_secret.txt');
  if (fs.existsSync(secretFile)) {
    sessionSecret = fs.readFileSync(secretFile, 'utf8');
  } else {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, sessionSecret, 'utf8');
  }
}

if (isProduction && (!sessionSecret || !publicBaseUrl)) {
  throw new Error('正式環境必須設定 SESSION_SECRET 與 PUBLIC_BASE_URL');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'admin/views'));
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  store: new FileStore({ path: sessionDir, ttl: 86400 * 30, retries: 0, logFn: () => {} }),
  secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: isProduction,
    httpOnly: true,
  },
}));

function requireAuth(req, res, next) {
  if (req.session.authenticated && req.session.discordUser?.id) return next();
  res.redirect('/login');
}

function requireGuildAccess(level = 'mod') {
  return async (req, res, next) => {
    const guildId = req.params.guildId || req.params.id;
    if (!guildId) return res.status(400).send('缺少伺服器 ID');
    const access = await getGuildAccess(req, guildId);
    if (!access || !access[level]) {
      return res.status(403).send('你沒有管理此伺服器的權限');
    }
    req.guildAccess = access;
    next();
  };
}

const requireTopAdmin = requireGuildAccess('top');
const requireModerator = requireGuildAccess('mod');

function requireSameOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const source = req.get('origin') || (() => {
    const referer = req.get('referer');
    if (!referer) return '';
    try { return new URL(referer).origin; } catch { return ''; }
  })();
  const expected = publicBaseUrl || `${req.protocol}://${req.get('host')}`;

  if (source !== expected) return res.status(403).send('不接受跨網站請求');
  next();
}

app.use(requireSameOrigin);

async function getGuildAccess(req, guildId) {
  const userId = req.session.discordUser?.id;
  const guild = client.guilds.cache.get(guildId);
  if (!userId || !guild) return null;

  const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
  if (!member) return null;

  const gs = settings.getGuildSettings(guild.id);
  if ((gs.blockedUsers || []).includes(userId) && member.id !== guild.ownerId) return null;

  const { isTopAdmin, isModerator } = require('./src/utils/permissions');
  const top = member.id === guild.ownerId || isTopAdmin(member, gs.adminRoles?.topIds || []);
  const mod = top || isModerator(member, gs.adminRoles?.modIds || []);
  return { guild, member, settings: gs, top, mod };
}

async function getAccessibleGuilds(req, level = 'mod') {
  const entries = await Promise.all(
    [...client.guilds.cache.keys()].map(async id => ({ id, access: await getGuildAccess(req, id) }))
  );
  return entries.filter(entry => entry.access?.[level]).map(entry => entry.access);
}

function requireSystemAdmin(req, res, next) {
  const allowedIds = new Set((process.env.SYSTEM_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean));
  if (allowedIds.has(req.session.discordUser?.id)) return next();
  res.status(403).send('此功能僅限系統管理員使用');
}

app.get('/', (req, res) => {
  if (req.session.authenticated) return res.redirect('/dashboard');
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((s, g) => s + g.memberCount, 0);
  res.render('landing', { guildCount, userCount, ping: client.ws.ping });
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

const axios = require('axios');

app.get('/auth/discord', (req, res) => {
  const clientId = config.discord.clientId;
  const redirectUri = config.discord.redirectUri;
  if (!clientId || !redirectUri) return res.render('login', { error: '未設定 Discord OAuth' });
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds&state=${state}`;
  res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.render('login', { error: '缺少授權碼' });
    if (!state || state !== req.session.oauthState) {
      return res.render('login', { error: '狀態驗證失敗，請重新登入' });
    }
    delete req.session.oauthState;

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.discord.redirectUri,
        scope: 'identify guilds',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const discordUser = userRes.data;

    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mutualGuilds = guildsRes.data
      .filter(g => client.guilds.cache.has(g.id))
      .map(g => g.id);

    let allowed = false;
    let adminLevel = null;
    const { isTopAdmin, isModerator } = require('./src/utils/permissions');

    for (const guildId of mutualGuilds) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      const member = guild.members.cache.get(discordUser.id) || await guild.members.fetch(discordUser.id).catch(() => null);
      if (!member) continue;

      const memberRoleIds = member.roles.cache.map(r => r.id);
      const gs = settings.getGuildSettings(guildId);
      const blockedUsers = Array.isArray(gs.blockedUsers) ? gs.blockedUsers : [];

      if (blockedUsers.includes(discordUser.id) && member.id !== guild.ownerId) {
        logger.info(`[封鎖] ${discordUser.username} 被封鎖於 ${guild.name}，跳過`);
        continue;
      }

      const topIds = gs.adminRoles?.topIds || [];
      const modIds = gs.adminRoles?.modIds || [];

      if (isTopAdmin(member) || memberRoleIds.some(r => topIds.includes(r))) {
        allowed = true;
        adminLevel = 'top';
        logger.info(`[登入] ${discordUser.username} 以 ${guild.name} 的 TOP 權限登入`);
        break;
      }
      if (isModerator(member) || memberRoleIds.some(r => modIds.includes(r))) {
        allowed = true;
        adminLevel = 'mod';
        logger.info(`[登入] ${discordUser.username} 以 ${guild.name} 的 MOD 權限登入`);
        break;
      }
    }

    if (!allowed) {
      return res.render('login', { error: '❌ 你沒有管理員權限（需要可愛的管管們或可惡的管管們身分組）' });
    }

    req.session.regenerate(err => {
      if (err) {
        logger.error('無法建立安全的登入工作階段:', err);
        return res.render('login', { error: '登入工作階段建立失敗，請稍後再試' });
      }
      req.session.authenticated = true;
      req.session.adminLevel = adminLevel;
      req.session.discordUser = { id: discordUser.id, username: discordUser.username, avatar: discordUser.avatar, global_name: discordUser.global_name };
      req.session.save(saveErr => {
        if (saveErr) return res.render('login', { error: '登入工作階段儲存失敗，請稍後再試' });
        res.redirect('/dashboard');
      });
    });
  } catch (err) {
    logger.error('Discord OAuth 失敗:', err.response?.data || err.message);
    res.render('login', { error: 'Discord 登入失敗，請稍後再試' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), bot: client.ws.status === 0 ? 'online' : 'offline' });
});

app.get('/export', requireAuth, requireSystemAdmin, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    const guildRows = [];
    for (const g of client.guilds.cache.values()) {
      const gs = settings.getGuildSettings(g.id);
      guildRows.push({
        '伺服器名稱': g.name,
        '伺服器 ID': g.id,
        '成員數': g.memberCount,
        '擁有者': g.members.cache.get(g.ownerId)?.user?.tag || '?',
        '歡迎頻道': gs.welcome?.channelId || '未設定',
        '告別頻道': gs.farewell?.channelId || '未設定',
        '可領取身分組數': gs.selfRoles?.length || 0,
        '自動審核': gs.autoMod?.enabled ? '啟用' : '停用',
        '過濾詞數': gs.autoMod?.words?.length || 0,
        '語音包房': gs.autoVoice?.channelId || '未設定',
        '工單分類': gs.ticket?.categoryId || '未設定',
      });
    }
    const ws1 = XLSX.utils.json_to_sheet(guildRows);
    XLSX.utils.book_append_sheet(wb, ws1, '伺服器');

    const allGuildSettings = settings.load();
    const settingRows = [];
    for (const [gid, data] of Object.entries(allGuildSettings)) {
      settingRows.push({ '伺服器 ID': gid, '設定內容': JSON.stringify(data, null, 2) });
    }
    const ws2 = XLSX.utils.json_to_sheet(settingRows);
    XLSX.utils.book_append_sheet(wb, ws2, '原始設定');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set('Content-Disposition', `attachment; filename="OmniBot_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    logger.error('匯出失敗:', err);
    res.status(500).send('匯出失敗');
  }
});

app.get('/privacy', (req, res) => {
  res.render('privacy');
});

app.get('/up', (req, res) => {
  res.send('ok');
});

app.get('/appeal', (req, res) => {
  if (!req.session.appealUser) return res.render('appeal', { user: null, error: null, query: req.query });
  res.render('appeal', { user: req.session.appealUser, error: null, query: {} });
});

app.get('/appeal/login', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  const appealRedirectUri = 'https://omnibot-yzti.onrender.com/appeal/callback';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(appealRedirectUri)}&response_type=code&scope=identify&state=${state}`;
  res.redirect(url);
});

app.get('/appeal/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect('/appeal?error=缺少授權碼');
    if (!state || state !== req.session.oauthState) return res.redirect('/appeal?error=驗證失敗');
    delete req.session.oauthState;

    const appealRedirectUri = 'https://omnibot-yzti.onrender.com/appeal/callback';

    const params = new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: appealRedirectUri,
      scope: 'identify',
    });

    logger.info(`[申訴] 交換 token: client_id=${config.discord.clientId}, secret=${config.discord.clientSecret ? '已設定' : '未設定'}`);

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }
    );

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    req.session.appealUser = {
      id: userRes.data.id,
      username: userRes.data.username,
      global_name: userRes.data.global_name,
      avatar: userRes.data.avatar,
    };

    res.redirect('/appeal');
  } catch (err) {
    logger.error(`[申訴] 登入失敗: ${err.response?.status} ${JSON.stringify(err.response?.data || err.message)}`);
    res.redirect('/appeal?error=login_failed');
  }
});

app.post('/api/appeal/submit', async (req, res) => {
  try {
    const { reason } = req.body;
    const appealUser = req.session.appealUser;

    if (!appealUser) return res.json({ success: false, error: '請先 Discord 登入' });
    if (!reason) return res.json({ success: false, error: '請填寫申訴原因' });

    let sent = false;
    for (const guild of client.guilds.cache.values()) {
      const gs = settings.getGuildSettings(guild.id);
      const chId = gs.appeal?.channelId;
      if (!chId) continue;
      const ch = guild.channels.cache.get(chId);
      if (!ch) continue;
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('📋 新的封禁申訴')
        .setThumbnail(`https://cdn.discordapp.com/avatars/${appealUser.id}/${appealUser.avatar}.png?size=128`)
        .addFields(
          { name: '使用者', value: `${appealUser.global_name || appealUser.username} (${appealUser.username})`, inline: true },
          { name: 'ID', value: appealUser.id, inline: true },
          { name: '申訴原因', value: reason },
        )
        .setTimestamp();
      await ch.send({ embeds: [embed] });
      sent = true;
    }
    if (!sent) return res.json({ success: false, error: '目前沒有伺服器開啟申訴功能' });
    res.json({ success: true });
  } catch (err) {
    logger.error('申訴送出失敗:', err.message);
    res.json({ success: false, error: '系統錯誤' });
  }
});

app.post('/api/github-webhook', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const body = req.body;

    if (event === 'ping') return res.json({ ok: true });
    if (!['pull_request', 'pull_request_review', 'issues'].includes(event)) return res.status(200).json({ ignored: true });

    const action = body.action;
    const pr = body.pull_request || body.issue;
    if (!pr) return res.status(200).json({ ignored: true });

    let color = 0x888888;
    let title = '';
    let fields = [];

    if (event === 'pull_request') {
      if (action === 'opened') { color = 0x2ecc71; title = '🟢 PR 已建立'; fields.push({ name: '標題', value: pr.title }); }
      else if (action === 'closed' && pr.merged) { color = 0x9b59b6; title = '✅ PR 已合併'; fields.push({ name: '標題', value: pr.title }); }
      else if (action === 'closed') { color = 0xe74c3c; title = '❌ PR 已關閉'; fields.push({ name: '標題', value: pr.title }); }
      else return res.status(200).json({ ignored: true });
      fields.push({ name: '作者', value: pr.user?.login || '?', inline: true });
      fields.push({ name: '分支', value: `${pr.head?.ref || '?'} → ${pr.base?.ref || '?'}`, inline: true });
      if (pr.html_url) fields.push({ name: '連結', value: pr.html_url });
    } else if (event === 'pull_request_review' && action === 'submitted') {
      const review = body.review;
      if (review.state === 'approved') { color = 0x2ecc71; title = '✅ PR 審核通過'; }
      else if (review.state === 'changes_requested') { color = 0xe74c3c; title = '🔴 PR 需修改'; }
      else return res.status(200).json({ ignored: true });
      fields.push({ name: 'PR', value: body.pull_request?.title || '?' });
      fields.push({ name: '審核者', value: review.user?.login || '?', inline: true });
    } else if (event === 'issues' && action === 'opened') {
      color = 0xf39c12; title = '🟡 新 Issue';
      fields.push({ name: '標題', value: pr.title });
      fields.push({ name: '建立者', value: pr.user?.login || '?', inline: true });
      if (pr.html_url) fields.push({ name: '連結', value: pr.html_url });
    } else return res.status(200).json({ ignored: true });

    for (const guild of client.guilds.cache.values()) {
      const gs = settings.getGuildSettings(guild.id);
      const chId = gs.githubWebhook?.channelId;
      if (!chId) continue;
      const ch = guild.channels.cache.get(chId);
      if (!ch) continue;
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder().setColor(color).setTitle(title).addFields(fields).setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('GitHub Webhook 錯誤:', err.message);
    res.status(200).json({ ok: true });
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const accessible = await getAccessibleGuilds(req, 'mod');
  const guilds = accessible.map(acc => ({
    id: acc.guild.id, name: acc.guild.name, memberCount: acc.guild.memberCount,
    icon: acc.guild.icon ? `<img src="https://cdn.discordapp.com/icons/${acc.guild.id}/${acc.guild.icon}.png?size=48" style="width:48px;height:48px;border-radius:10px;">` : '🌐',
  }));
  const totalUsers = guilds.reduce((s, g) => s + g.memberCount, 0);
  res.render('dashboard', {
    online: client.ws.status === 0, guilds, totalUsers, ping: client.ws.ping,
    user: req.session.discordUser || null,
    adminLevel: req.session.adminLevel || null,
  });
});

app.get('/logs', requireAuth, requireSystemAdmin, (req, res) => {
  res.render('logs', { logs: logCapture.getLogs(), user: req.session.discordUser || null, adminLevel: req.session.adminLevel || null });
});

app.get('/analytics', requireAuth, requireSystemAdmin, async (req, res) => {
  const guildData = [];
  for (const g of client.guilds.cache.values()) {
    await g.members.fetch().catch(() => {});
    const bots = g.members.cache.filter(m => m.user.bot).size;
    const total = g.memberCount;
    guildData.push({
      id: g.id, name: g.name, icon: g.icon || '',
      total, bots, humans: total - bots,
      channels: g.channels.cache.size,
      created: Math.floor(g.createdTimestamp / 1000),
      owner: g.members.cache.get(g.ownerId)?.user?.tag || '?',
    });
  }
  const totalHumans = guildData.reduce((s, g) => s + g.humans, 0);
  res.render('analytics', { guildData, totalHumans, totalGuilds: guildData.length, user: req.session.discordUser || null, adminLevel: req.session.adminLevel || null });
});

app.get('/api/logs/stream', requireAuth, requireSystemAdmin, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  let index = parseInt(req.query.index, 10) || 0;
  const interval = setInterval(() => {
    const newLogs = logCapture.getLogsSince(index);
    if (newLogs.length > 0) { index += newLogs.length; res.write(`data: ${JSON.stringify(newLogs)}\n\n`); }
  }, 1000);
  req.on('close', () => clearInterval(interval));
});

app.get('/cmd', requireAuth, (req, res) => {
  const commands = [];
  for (const [, cmd] of client.commands) commands.push({ name: cmd.data.name, desc: cmd.data.description });
  res.render('cmd', { commands, user: req.session.discordUser || null, adminLevel: req.session.adminLevel || null });
});

app.get('/server/:id', requireAuth, requireGuildAccess('mod'), async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).send('找不到伺服器');

    const gs = settings.getGuildSettings(guild.id);

    await guild.channels.fetch().catch(() => {});
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }));
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).map(c => ({ id: c.id, name: c.name }));
    const categories = guild.channels.cache.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name }));
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && r.name !== '@everyone' && r.position < guild.members.me.roles.highest.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const owner = guild.members.cache.get(guild.ownerId);

    res.set('Cache-Control', 'no-store');
    const userGuilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.icon }));
    res.render('server', {
      userGuilds,
      adminLevel: req.session.adminLevel || null,
      guild: {
        id: guild.id, name: guild.name, icon: guild.icon || '',
        memberCount: guild.memberCount,
        roleCount: roles.length,
        ownerTag: owner?.user?.tag || '未知',
        channels,
        voiceChannels,
        categories,
        roles,
        selfRoles: gs.selfRoles || [],
        autoVoice: gs.autoVoice || { channelId: '', categoryId: '', nameTemplate: '', userLimit: 0, bitrate: 64000, rtcRegion: '', logging: false },
        ticket: gs.ticket || { categoryId: '', roleIds: [], channelId: '' },
        autoMod: gs.autoMod || { enabled: false, words: [], regexWords: [], blockLinks: false, logChannelId: '', punishment: 'delete', timeoutMinutes: 10, logLevel: 'all' },
        roleGive: gs.roleGive || { channelId: '' },
        messageLog: gs.messageLog || { channelId: '' },
        messageLogAll: gs.messageLogAll || { enabled: false },
        inviteGuard: gs.inviteGuard || { enabled: false, whitelist: [], logChannelId: '' },
        appeal: gs.appeal || { channelId: '' },
        githubWebhook: gs.githubWebhook || { channelId: '' },
        antiRaid: gs.antiRaid || { enabled: false, joinThreshold: 5, joinWindow: 10, spamThreshold: 5, spamWindow: 5, spamTimeout: 1, action: 'kick', logChannelId: '' },
        inviteLog: gs.inviteLog || { channelId: '' },
        welcome: gs.welcome || { enabled: false, channelId: '', message: '' },
        farewell: gs.farewell || { enabled: false, channelId: '', message: '' },
      },
    });
  } catch (err) {
    logger.error('伺服器頁面錯誤:', err.message);
    res.status(500).send('載入伺服器資料時發生錯誤');
  }
});

app.post('/api/cmd/info', requireAuth, (req, res) => {
  const cmd = client.commands.get(req.body.command);
  if (!cmd) return res.json({ error: '未知指令' });
  res.json({ success: true, data: { name: cmd.data.name, description: cmd.data.description, options: cmd.data.options?.map(o => ({ name: o.name, description: o.description, required: o.required })) || [] } });
});

app.get('/settings', requireAuth, async (req, res) => {
  const guilds = [];
  for (const g of client.guilds.cache.values()) {
    await g.channels.fetch();
    const gs = settings.getGuildSettings(g.id);
    const allRoles = g.roles.cache
      .filter(r => r.id !== g.id && r.name !== '@everyone' && r.position < g.members.me.roles.highest.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));
    guilds.push({
      id: g.id, name: g.name,
      channels: g.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
      allRoles,
      selfRoles: gs.selfRoles || [],
      welcomeChannel: gs?.welcome?.channelId || '',
      welcomeMessage: gs?.welcome?.message || '',
      welcomeEnabled: gs?.welcome?.enabled || false,
      farewellChannel: gs?.farewell?.channelId || '',
      farewellMessage: gs?.farewell?.message || '',
      farewellEnabled: gs?.farewell?.enabled || false,
    });
  }
  res.render('settings', { guilds });
});

app.post('/api/settings/:guildId', requireAuth, requireTopAdmin, (req, res) => {
  const { type, channelId, message, enabled, _tab } = req.body;
  const gs = settings.getGuildSettings(req.params.guildId);
  gs[type] = { channelId: channelId || '', message: message || '', enabled: enabled === '1' || enabled === true, image: req.body.image || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#${_tab || ''}`);
});

app.post('/api/settings/:guildId/roles', requireAuth, requireTopAdmin, (req, res) => {
  const selected = req.body.roles;
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.selfRoles = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#roles`);
});

app.post('/api/settings/:guildId/automod', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  const words = req.body.words ? req.body.words.split(',').map(w => w.trim()).filter(Boolean) : [];
  const regexWords = req.body.regexWords ? req.body.regexWords.split('\n').map(r => r.trim()).filter(Boolean) : [];
  gs.autoMod = {
    enabled: String(req.body.enabled).includes('1'),
    words,
    regexWords,
    blockLinks: String(req.body.blockLinks).includes('1'),
    phishingProtection: String(req.body.phishingProtection).includes('1'),
    logChannelId: req.body.logChannelId || '',
    punishment: req.body.punishment || 'delete',
    timeoutMinutes: parseInt(req.body.timeoutMinutes, 10) || 10,
    logLevel: req.body.logLevel || 'all',
    strikes: {},
    strikeResetHours: parseInt(req.body.strikeResetHours, 10) || 24,
    userStrikes: gs.autoMod?.userStrikes || {},
  };
  if (req.body.strikeResetHours) {
    gs.autoMod.strikeResetHours = parseInt(req.body.strikeResetHours, 10) || 24;
  }
  for (let i = 2; i <= 5; i++) {
    const action = req.body[`strike_action_${i}`];
    const dur = parseInt(req.body[`strike_duration_${i}`], 10) || 10;
    if (action) {
      gs.autoMod.strikes[i] = { action, duration: dur };
    } else {
      delete gs.autoMod.strikes[i];
    }
  }
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#automod`);
});

app.post('/api/settings/:guildId/autovoice', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.autoVoice = {
    channelId: req.body.channelId || '',
    categoryId: req.body.categoryId || '',
    nameTemplate: req.body.nameTemplate || '',
    userLimit: parseInt(req.body.userLimit, 10) || 0,
    bitrate: parseInt(req.body.bitrate, 10) || 64000,
    rtcRegion: req.body.rtcRegion || '',
    logging: String(req.body.logging).includes('1'),
  };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#voice`);
});

app.get('/api/channels', requireAuth, async (req, res) => {
  const result = [];
  for (const g of client.guilds.cache.values()) {
    await g.channels.fetch();
    result.push({
      id: g.id, name: g.name,
      channels: g.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
    });
  }
  res.json(result);
});

app.get('/announce', requireAuth, async (req, res) => {
  const guilds = [];
  for (const g of client.guilds.cache.values()) {
    await g.channels.fetch();
    guilds.push({
      id: g.id, name: g.name,
      channels: g.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
    });
  }
  res.render('announce', { guilds });
});

app.post('/api/announce/send', requireAuth, async (req, res) => {
  const { channelId, title, message, color } = req.body;
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return res.json({ success: false, error: '找不到頻道' });
    const guildId = channel.guild.id;
    const access = await getGuildAccess(req, guildId);
    if (!access || !access.top) return res.status(403).json({ success: false, error: '你沒有在此伺服器發送公告的權限' });
    if (!channel) return res.json({ success: false, error: '找不到頻道' });
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(parseInt(color?.replace('#', ''), 16) || 0x7c6ff0)
      .setTitle(title || '📢 公告')
      .setDescription(message)
      .setFooter({ text: `OmniBot · ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}` });
    await channel.send({ embeds: [embed] });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/settings/:guildId/ticket', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds : (req.body.roleIds ? [req.body.roleIds] : []);
  gs.ticket = { categoryId: req.body.categoryId || '', roleIds, channelId: '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#ticket`);
});

app.post('/api/settings/:guildId/rolegive', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.roleGive = { channelId: req.body.channelId || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#rolegive`);
});

app.post('/api/settings/:guildId/messagelog', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  if (req.body.channelId !== undefined) {
    gs.messageLog = { channelId: req.body.channelId || '' };
  }
  if (req.body.messageLogAllEnabled !== undefined) {
    gs.messageLogAll = { enabled: String(req.body.messageLogAllEnabled).includes('1') };
  }
  if (!gs.blockedUsers) gs.blockedUsers = [];
  if (!gs.adminRoles) gs.adminRoles = { topIds: [], modIds: [] };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#${req.body._tab || 'messagelog'}`);
});

app.post('/api/settings/:guildId/inviteguard', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  const words = req.body.whitelist ? req.body.whitelist.split(',').map(w => w.trim()).filter(Boolean) : [];
  gs.inviteGuard = { enabled: req.body.enabled === '1', whitelist: words, logChannelId: req.body.logChannelId || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#inviteguard`);
});

app.post('/api/settings/:guildId/appeal', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.appeal = { channelId: req.body.channelId || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#appeal`);
});

app.post('/api/settings/:guildId/antiraid', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  const enabled = req.body.enabled !== undefined ? String(req.body.enabled).includes('1') : gs.antiRaid?.enabled;
  gs.antiRaid = {
    enabled,
    joinThreshold: parseInt(req.body.joinThreshold, 10) || 5,
    joinWindow: parseInt(req.body.joinWindow, 10) || 10,
    spamThreshold: parseInt(req.body.spamThreshold, 10) || 5,
    spamWindow: parseInt(req.body.spamWindow, 10) || 5,
    spamTimeout: parseInt(req.body.spamTimeout, 10) || 1,
    action: req.body.action || 'kick',
    logChannelId: req.body.logChannelId || '',
  };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#antiraid`);
});

app.post('/api/settings/:guildId/invitelog', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.inviteLog = { channelId: req.body.channelId || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#invitelog`);
});

app.post('/api/settings/:guildId/githubwebhook', requireAuth, requireTopAdmin, (req, res) => {
  const gs = settings.getGuildSettings(req.params.guildId);
  gs.githubWebhook = { channelId: req.body.channelId || '' };
  settings.updateGuildSettings(req.params.guildId, gs);
  res.redirect(`/server/${req.params.guildId}#githubwebhook`);
});

app.post('/api/server/:id/send-ticket-panel', requireAuth, requireTopAdmin, async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ success: false, error: '找不到伺服器' });
    const channel = guild.channels.cache.get(req.body.channelId);
    if (!channel) return res.json({ success: false, error: '找不到頻道' });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎫 建立工單').setDescription('點擊下方按鈕建立工單，管理員將為你協助');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('📩 建立工單').setStyle(ButtonStyle.Primary)
    );
    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/server/:id/send-panel', requireAuth, requireTopAdmin, async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ success: false, error: '找不到伺服器' });

    const channel = guild.channels.cache.get(req.body.channelId);
    if (!channel) return res.json({ success: false, error: '找不到頻道' });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const gs = settings.getGuildSettings(guild.id);
    const allowedIds = gs.selfRoles || [];

    const roles = allowedIds.map(id => guild.roles.cache.get(id)).filter(Boolean).slice(0, 25);
    if (roles.length === 0) return res.json({ success: false, error: '尚未設定可領取的身分組' });

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎭 自助領取身分組')
      .setDescription('點擊下方按鈕領取或移除身分組')
      .setFooter({ text: guild.name })
      .setTimestamp();

    const rows = [];
    let row = new ActionRowBuilder();
    for (const role of roles) {
      const btn = new ButtonBuilder()
        .setCustomId(`role_toggle_${guild.id}_${role.id}`)
        .setLabel(role.name.length > 25 ? role.name.slice(0, 22) + '...' : role.name)
        .setStyle(ButtonStyle.Secondary);
      if (row.components.length >= 5) { rows.push(row); row = new ActionRowBuilder(); }
      row.addComponents(btn);
    }
    if (row.components.length > 0) rows.push(row);

    await channel.send({ embeds: [embed], components: rows });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`管理後臺已啟動: 端口 ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('未捕捉的 Promise 拒絕:', err);
});
