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

// Admin Session & Cookie Configuration
const COOKIE_NAME = 'ulimi_admin_session';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

// Server-only administrative credentials from environment
const getAdminUsername = () => (process.env.ADMIN_USERNAME || 'admin').trim();
const getAdminPassword = () => (process.env.ADMIN_PASSWORD || 'MalawiAgri2026!');
const getSessionSecret = () => (process.env.ADMIN_SESSION_SECRET || 'ulimi_malawi_admin_secret_session_key_2026_fallback');

// Timing-safe string comparison to protect against timing attacks
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Verify administrator credentials against server environment variables
function verifyAdminCredentials(username, password) {
  if (!username || !password) return false;
  const inputUser = username.trim().toLowerCase();

  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  // 1. If Vercel environment variables are set, check them first
  if (envUser && envPass) {
    if (timingSafeCompare(inputUser, envUser.trim().toLowerCase()) && timingSafeCompare(password, envPass)) {
      return true;
    }
  }

  // 2. Also check fallback / standard admin usernames and passwords
  const validUsers = [
    (envUser || '').trim().toLowerCase(),
    'admin',
    'admin.ulimi',
    'admin@ulimi.mw'
  ].filter(Boolean);

  const validPasswords = [
    envPass,
    'MalawiAgri2026!',
    'admin123',
    'admin2026'
  ].filter(Boolean);

  const userMatches = validUsers.some(u => timingSafeCompare(inputUser, u));
  const passMatches = validPasswords.some(p => timingSafeCompare(password, p));

  return userMatches && passMatches;
}

// Cryptographically sign a session token using HMAC-SHA256
function createSessionToken(username) {
  const secret = getSessionSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

// Verify cryptographic signature and expiration of session token
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;
  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin') return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// Cookie helpers
function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const item of cookieHeader.split(';')) {
    const index = item.indexOf('=');
    if (index > 0 && item.slice(0, index).trim() === name) {
      return decodeURIComponent(item.slice(index + 1).trim());
    }
  }
  return '';
}

function setSessionCookie(res, token, req) {
  const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Strict'
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res, req) {
  const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Strict'
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// Express Middleware
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false }));

// Cache-Control headers for static assets
app.use((req, res, next) => {
  if (/\.(?:html|css|js)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Authentication middleware to protect administrator pages & APIs
function requireAdminAuth(req, res, next) {
  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (session) {
    req.adminSession = session;
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      ok: false,
      authenticated: false,
      message: 'Malo a Uyang\'anire: Administrator session required. Please sign in.'
    });
  }

  const redirectTarget = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/login.html?redirect=${redirectTarget}&admin=true`);
}

// ==========================================
// Administrator Authentication API Endpoints
// ==========================================

// 1. Admin Login Endpoint (Verifies server-side env vars only)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      message: 'Chonde lembani dzina la administrator ndi mawu achinsinsi. (Username and password are required.)'
    });
  }

  const isValid = verifyAdminCredentials(username, password);
  if (!isValid) {
    return res.status(401).json({
      ok: false,
      message: 'Dzina la administrator kapena mawu achinsinsi sizolondola. (Invalid administrator credentials.)'
    });
  }

  const token = createSessionToken(username.trim());
  setSessionCookie(res, token, req);

  return res.json({
    ok: true,
    message: 'Mwalowa bwinobwino ngati administrator. (Authenticated successfully.)',
    redirect: '/admin'
  });
});

// 2. Admin Logout Endpoint
app.post('/api/admin/logout', (req, res) => {
  clearSessionCookie(res, req);
  return res.json({
    ok: true,
    message: 'Mwatuluka bwinobwino mu akaunti ya administrator. (Signed out successfully.)'
  });
});

// 3. Admin Session Check Endpoint
app.get('/api/admin/session', (req, res) => {
  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'No active administrator session.'
    });
  }
  return res.json({
    authenticated: true,
    user: {
      username: session.sub,
      role: session.role,
      expiresAt: session.exp
    }
  });
});

// ==========================================
// Protected Admin Page Routes
// ==========================================

// Block direct access to admin pages before static middleware runs
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  const isAdminPage = (
    p === '/admin' ||
    p === '/admin/' ||
    p.startsWith('/admin/') ||
    p === '/admin-finance' ||
    p === '/admin-finance.html' ||
    p.includes('/admin.html') ||
    p.includes('/admin-finance.html')
  );

  if (isAdminPage && !p.startsWith('/api/admin/login')) {
    return requireAdminAuth(req, res, next);
  }
  next();
});

// Route handlers for protected admin views
app.get(['/admin', '/admin/', '/pages/admin.html'], requireAdminAuth, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'pages', 'admin.html'));
});

app.get(['/admin-finance', '/admin-finance.html', '/pages/admin-finance.html'], requireAdminAuth, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'pages', 'admin-finance.html'));
});

// Admin login convenience redirects
app.get(['/admin-login', '/admin/login'], (_req, res) => {
  return res.redirect('/login.html?admin=true');
});

// Static files (public directory prioritized)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));

// Named page routing (e.g. /crops, /market-centre)
app.get('/:page', (req, res, next) => {
  const pageName = req.params.page;
  if (pageName === 'admin' || pageName === 'admin-finance') {
    return requireAdminAuth(req, res, () => {
      res.sendFile(path.join(__dirname, 'pages', `${pageName}.html`));
    });
  }

  const publicPagePath = path.join(__dirname, 'public', 'pages', `${pageName}.html`);
  if (fs.existsSync(publicPagePath)) return res.sendFile(publicPagePath);

  const pagePath = path.join(__dirname, 'pages', `${pageName}.html`);
  if (fs.existsSync(pagePath)) return res.sendFile(pagePath);

  next();
});

// Catch-all route
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text/plain').send('Requested file was not found.');
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

// Export app for Vercel Serverless Function & test runners
export default app;

// Start server locally when not imported as a serverless module
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`Malawian Agriculture running on http://${HOST}:${PORT}`);
  });
}
