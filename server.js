import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const COOKIE_NAME = 'ulimi_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

app.use(express.json({ limit: '20kb' }));

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}
function makeSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function validSession(req) {
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
  const token = cookies[COOKIE_NAME] || '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Date.now();
  } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (validSession(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, message: 'Please sign in again.' });
  return res.redirect('/admin-login.html');
}

app.post('/api/admin/login', (req, res) => {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    return res.status(503).json({ ok: false, message: 'Admin sign-in is not configured yet. Set the required Vercel environment variables.' });
  }
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, message: 'The username or password is incorrect.' });
  }
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(makeSession())}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`);
  return res.json({ ok: true });
});
app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ ok: true }));
app.post('/api/admin/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

// These routes must be registered BEFORE static hosting so the private page
// cannot be fetched directly without a valid signed, HttpOnly session cookie.
app.get(['/admin', '/admin/'], requireAdmin, (_req, res) => res.sendFile(path.join(__dirname, 'pages', 'admin.html')));
app.get('/pages/admin.html', requireAdmin, (_req, res) => res.sendFile(path.join(__dirname, 'pages', 'admin.html')));
app.get('/admin-login', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));

// Serve the site's existing files after private admin routes.
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));
app.get('/:page', (req, res, next) => {
  const pagePath = path.join(__dirname, 'pages', `${req.params.page}.html`);
  if (fs.existsSync(pagePath) && req.params.page !== 'admin') return res.sendFile(pagePath);
  next();
});
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).type('text/plain').send('Requested file was not found.');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, HOST, () => console.log(`Malawian Agriculture running on http://${HOST}:${PORT}`));
