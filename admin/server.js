const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const config = require('../src/config');
const logger = require('../src/utils/logger');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'omnibot-admin-session-fallback-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect('/login');
}

app.get('/', (req, res) => {
  if (req.session.authenticated) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const isProduction = process.env.NODE_ENV === 'production';
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (isProduction && (!adminUser || !adminPass)) {
    return res.render('login', { error: '安全限制：生產環境必須設定 ADMIN_USERNAME 與 ADMIN_PASSWORD' });
  }

  const finalUser = adminUser || 'admin';
  const finalPass = adminPass || 'admin123';

  if (username === finalUser && password === finalPass) {
    req.session.authenticated = true;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: '帳號或密碼錯誤' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    online: false, guilds: [], totalUsers: 0, commands: [],
    ping: 0, uptimeFormatted: '0m', nodeVersion: process.version,
  });
});

const MUSIC_API = `http://localhost:${process.env.MUSIC_API_PORT || 3001}`;

app.get('/music', requireAuth, (req, res) => {
  res.render('music');
});

app.get('/api/guilds', requireAuth, (req, res) => {
  http.get(`${MUSIC_API}/api/guilds`, (proxy) => {
    let data = '';
    proxy.on('data', chunk => data += chunk);
    proxy.on('end', () => res.json(JSON.parse(data)));
  }).on('error', () => res.json([]));
});

app.get('/api/music/:guildId', requireAuth, (req, res) => {
  http.get(`${MUSIC_API}/api/music/${req.params.guildId}`, (proxy) => {
    let data = '';
    proxy.on('data', chunk => data += chunk);
    proxy.on('end', () => res.json(JSON.parse(data)));
  }).on('error', () => res.json({ playing: false, songs: [] }));
});

app.post('/api/music/:guildId/control', requireAuth, express.json(), (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: 'localhost',
    port: process.env.MUSIC_API_PORT || 3001,
    path: `/api/music/${req.params.guildId}/control`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const proxy = http.request(opts, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => res.status(proxyRes.statusCode).json(JSON.parse(data)));
  });
  proxy.on('error', () => res.status(502).json({ error: 'Bot API offline' }));
  proxy.write(body);
  proxy.end();
});

app.listen(PORT, () => {
  logger.info(`管理員後臺已啟動: http://localhost:${PORT}`);
});

module.exports = app;
