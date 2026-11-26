import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  COOKIE_NAME,
  readCookie,
  verifySessionToken,
  verifyActiveAdminRecordById,
  revokeSessionToken,
  buildClearCookie,
  isHttpsRequest,
  setNoStoreHeaders,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminSession,
  handleAdminRefresh
} from './api/_auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env file in development if present (without overwriting existing env vars)
const localEnvPath = path.join(__dirname, '.env');
if (!process.env.VERCEL && fs.existsSync(localEnvPath)) {
  try {
    const lines = fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) {}
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = 3000;
const HOST = '0.0.0.0';
const PUBLIC_PAGES_DIR = path.resolve(__dirname, 'public', 'pages');
const SOURCE_PAGES_DIR = path.resolve(__dirname, 'pages');
const SAFE_PAGE_SLUG_REGEX = /^[a-z0-9-]+$/i;

function resolveConfinedFile(baseDir, fileName) {
  const resolved = path.resolve(baseDir, fileName);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

// Express Middleware
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false }));

// Global baseline security headers & cache-control for static assets
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (/\.(?:html|css|js)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

const PROTECTED_ADMIN_PAGES = new Set([
  'admin',
  'admin-bot',
  'admin-content',
  'admin-crops-prices',
  'admin-farmers',
  'admin-finance',
  'admin-messages',
  'admin-settings',
  'admin-submissions',
  'admin-suggestions'
]);

function resolveProtectedAdminFile(reqPath) {
  const normalized = String(reqPath || '').toLowerCase().replace(/\/+$/, '');
  const stripped = normalized
    .replace(/^\/pages\//, '/')
    .replace(/\.html$/i, '')
    .replace(/^\//, '');
  if (PROTECTED_ADMIN_PAGES.has(stripped)) {
    return resolveConfinedFile(SOURCE_PAGES_DIR, `${stripped}.html`);
  }
  return null;
}

// Authentication middleware to protect administrator pages & APIs
async function requireAdminAuth(req, res, next) {
  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (session) {
    if (session.authMethod === 'supabase' && session.uid) {
      const adminCheck = await verifyActiveAdminRecordById(session.uid);
      if (adminCheck?.unavailable) {
        if (req.path.startsWith('/api/')) {
          setNoStoreHeaders(res);
          return res.status(503).json({
            ok: false,
            authenticated: false,
            code: 'ADMIN_ACCESS_CHECK_UNAVAILABLE',
            message: 'Unable to verify administrator authorization right now. Please try again later.'
          });
        }
        setNoStoreHeaders(res);
        return res
          .status(503)
          .type('html')
          .send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Verification Unavailable</title></head><body style="font-family:system-ui,sans-serif;padding:32px;background:#f3f7f3;color:#173e2c"><h1>Administrator verification temporarily unavailable</h1><p>The server could not verify your administrator record right now. Please retry or sign in again.</p><p><a href="/login.html?admin=true">Return to Admin Sign In</a></p></body></html>');
      }
      if (!adminCheck?.ok) {
        revokeSessionToken(token);
        res.setHeader('Set-Cookie', buildClearCookie(isHttpsRequest(req)));
        if (req.path.startsWith('/api/')) {
          setNoStoreHeaders(res);
          return res.status(403).json({
            ok: false,
            authenticated: false,
            code: 'ADMIN_ACCESS_REVOKED',
            message: 'Administrator access has been revoked.'
          });
        }
        const redirectTarget = encodeURIComponent(req.originalUrl || '/pages/admin.html');
        return res.redirect(`/login.html?redirect=${redirectTarget}&admin=true`);
      }
    }
    req.adminSession = session;
    return next();
  }

  if (req.path.startsWith('/api/')) {
    setNoStoreHeaders(res);
    return res.status(401).json({
      ok: false,
      authenticated: false,
      message: 'Malo a Uyang\'anire: Administrator session required. Please sign in.'
    });
  }

  const redirectTarget = encodeURIComponent(req.originalUrl || '/pages/admin.html');
  return res.redirect(`/login.html?redirect=${redirectTarget}&admin=true`);
}

// ==========================================
// Administrator Authentication API Endpoints
// ==========================================

app.post('/api/admin/login', handleAdminLogin);
app.post('/api/admin/logout', handleAdminLogout);
app.get('/api/admin/session', handleAdminSession);
app.post('/api/admin/refresh', handleAdminRefresh);

// Catch any other /api/admin/* requests and enforce admin session auth
app.all('/api/admin/*', requireAdminAuth, (_req, res) => {
  setNoStoreHeaders(res);
  return res.status(404).json({ ok: false, message: 'Admin API endpoint not found.' });
});

// ==========================================
// Protected Admin Page Routes
// ==========================================

// Reject malformed encodings or dot-segment traversal before any routing or static middleware
app.use((req, res, next) => {
  let decodedPath = req.path;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).type('text/plain').send('Invalid request path.');
  }

  if (
    decodedPath.includes('\0') ||
    decodedPath.includes('\\') ||
    req.path.includes('\\') ||
    /(?:^|\/)\.\.(?:\/|$)/.test(decodedPath) ||
    /%2e%2e/i.test(req.originalUrl || '')
  ) {
    return res.status(404).type('text/plain').send('Requested file was not found.');
  }

  req.canonicalPath = path.posix.normalize(decodedPath);
  next();
});

// Block direct access to ALL admin pages (including extensionless & /pages/admin-*) before static middleware runs
app.use((req, res, next) => {
  const p = (req.canonicalPath || req.path).toLowerCase();
  if (p === '/admin/login' || p === '/admin-login' || p === '/admin-login/') return next();

  const isAdminRoute = (
    Boolean(resolveProtectedAdminFile(p)) ||
    p.startsWith('/admin/') ||
    p.startsWith('/pages/admin')
  );

  if (isAdminRoute && !p.startsWith('/api/admin/login')) {
    return requireAdminAuth(req, res, next);
  }
  next();
});

// Prevent static middleware from exposing server code, config, docs, or raw API source files
app.use((req, res, next) => {
  const p = (req.canonicalPath || req.path).toLowerCase();
  const isDotfile = p.split('/').some(seg => seg.startsWith('.') && seg.length > 1);
  const isInternalFile = (
    isDotfile ||
    p === '/server.js' ||
    p === '/package.json' ||
    p === '/package-lock.json' ||
    p === '/bun.lock' ||
    p === '/vercel.json' ||
    p === '/metadata.json' ||
    p === '/readme.md' ||
    p === '/walkthrough.md' ||
    p.startsWith('/api/') ||
    p.startsWith('/scripts/') ||
    p.startsWith('/supabase/') ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    p.startsWith('/workspace/')
  );
  if (isInternalFile) {
    return res.status(404).type('text/plain').send('Requested file was not found.');
  }
  next();
});

// Admin login convenience redirects (must precede protected /admin/* file routing)
app.get(['/admin-login', '/admin-login/', '/admin/login', '/admin/login/'], (_req, res) => {
  return res.redirect('/login.html?admin=true');
});

// Protected route handlers for all dedicated admin views
app.get(['/admin*', '/pages/admin*'], requireAdminAuth, (req, res, next) => {
  const targetFile = resolveProtectedAdminFile(req.canonicalPath || req.path);
  if (targetFile && fs.existsSync(targetFile)) {
    setNoStoreHeaders(res);
    return res.sendFile(targetFile);
  }
  return next();
});

// Static files (public directory prioritized; fallback only to explicit public asset directories & root HTML entry points)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], dotfiles: 'deny' }));
for (const dir of ['assets', 'css', 'data', 'js', 'partials']) {
  app.use(`/${dir}`, express.static(path.join(__dirname, dir), { dotfiles: 'deny' }));
}
app.get(['/', '/index.html', '/login.html', '/modules.html', '/profile.html', '/reset-password.html'], (req, res) => {
  const target = req.path === '/' ? 'index.html' : req.path.slice(1);
  const publicTarget = path.join(__dirname, 'public', target);
  if (fs.existsSync(publicTarget)) return res.sendFile(publicTarget);
  return res.sendFile(path.join(__dirname, target));
});
app.get('/pages/:slug', (req, res, next) => {
  const rawSlug = String(req.params.slug || '').replace(/\.html$/i, '');
  if (!SAFE_PAGE_SLUG_REGEX.test(rawSlug) || PROTECTED_ADMIN_PAGES.has(rawSlug.toLowerCase())) {
    return next();
  }
  const publicPage = resolveConfinedFile(PUBLIC_PAGES_DIR, `${rawSlug}.html`);
  if (publicPage && fs.existsSync(publicPage)) return res.sendFile(publicPage);
  const sourcePage = resolveConfinedFile(SOURCE_PAGES_DIR, `${rawSlug}.html`);
  if (sourcePage && fs.existsSync(sourcePage)) return res.sendFile(sourcePage);
  return next();
});

// Named page routing (e.g. /crops, /market-centre)
app.get('/:page', (req, res, next) => {
  const pageName = req.params.page;
  const protectedFile = resolveProtectedAdminFile('/' + pageName);
  if (protectedFile) {
    return requireAdminAuth(req, res, () => {
      setNoStoreHeaders(res);
      return res.sendFile(protectedFile);
    });
  }

  if (!SAFE_PAGE_SLUG_REGEX.test(pageName)) {
    return next();
  }

  const publicPagePath = resolveConfinedFile(PUBLIC_PAGES_DIR, `${pageName}.html`);
  if (publicPagePath && fs.existsSync(publicPagePath)) return res.sendFile(publicPagePath);

  const pagePath = resolveConfinedFile(SOURCE_PAGES_DIR, `${pageName}.html`);
  if (pagePath && fs.existsSync(pagePath)) return res.sendFile(pagePath);

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
