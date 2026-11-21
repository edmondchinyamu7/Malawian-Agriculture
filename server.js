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
app.set('trust proxy', 1);
const PORT = 3000;
const HOST = '0.0.0.0';

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
async function requireAdminAuth(req, res, next) {
  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (session) {
    if (session.authMethod === 'supabase' && session.uid) {
      const stillAdmin = await verifyActiveAdminRecordById(session.uid);
      if (!stillAdmin) {
        revokeSessionToken(token);
        res.setHeader('Set-Cookie', buildClearCookie(isHttpsRequest(req)));
        if (req.path.startsWith('/api/')) {
          setNoStoreHeaders(res);
          return res.status(403).json({
            ok: false,
            authenticated: false,
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

// Block direct access to admin pages (including extensionless /pages/admin*) before static middleware runs
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (p === '/admin/login') return next();

  const isAdminPage = (
    p === '/admin' ||
    p === '/admin/' ||
    p.startsWith('/admin/') ||
    p === '/admin-finance' ||
    p === '/admin-finance/' ||
    p === '/admin-finance.html' ||
    p === '/pages/admin' ||
    p === '/pages/admin/' ||
    p === '/pages/admin-finance' ||
    p === '/pages/admin-finance/' ||
    p.includes('/admin.html') ||
    p.includes('/admin-finance.html')
  );

  if (isAdminPage && !p.startsWith('/api/admin/login')) {
    return requireAdminAuth(req, res, next);
  }
  next();
});

// Prevent static middleware from exposing server code, config, or raw API source files
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  const isInternalFile = (
    p === '/server.js' ||
    p === '/package.json' ||
    p === '/package-lock.json' ||
    p === '/bun.lock' ||
    p === '/vercel.json' ||
    p === '/metadata.json' ||
    p === '/.env' ||
    p === '/.env.example' ||
    p === '/.npmrc' ||
    p.startsWith('/api/') ||
    p.startsWith('/scripts/') ||
    p.startsWith('/supabase/') ||
    p.startsWith('/workspace/')
  );
  if (isInternalFile) {
    return res.status(404).type('text/plain').send('Requested file was not found.');
  }
  next();
});

// Route handlers for protected admin views
app.get(['/admin', '/admin/', '/pages/admin', '/pages/admin/', '/pages/admin.html'], requireAdminAuth, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'pages', 'admin.html'));
});

app.get(['/admin-finance', '/admin-finance/', '/admin-finance.html', '/pages/admin-finance', '/pages/admin-finance/', '/pages/admin-finance.html'], requireAdminAuth, (_req, res) => {
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
