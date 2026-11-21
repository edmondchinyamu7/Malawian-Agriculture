import crypto from 'crypto';

export const COOKIE_NAME = 'ulimi_admin_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours
export const SESSION_REFRESH_THRESHOLD_SECONDS = 4 * 60 * 60; // Refresh cookie when < 4h remaining

const DEFAULT_SUPABASE_URL = 'https://pwoyfialzlwxamhawfyy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_KBnv1nmCc_iKGcTro_Z-aQ_uhW8Qv5J';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory session revocation & failed-login rate limiting
const revokedSessions = new Map(); // jti -> exp (unix seconds)
const failedLoginAttempts = new Map(); // ip -> number[] (timestamps in ms)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 10;

export const getAdminUsername = () => (process.env.ADMIN_USERNAME || '').trim();
export const getAdminPassword = () => process.env.ADMIN_PASSWORD || '';
export const getSessionSecret = () => (process.env.ADMIN_SESSION_SECRET || '').trim();
export const hasValidSessionSecret = () => getSessionSecret().length >= 32;

export const getSupabaseUrl = () => (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL
).trim().replace(/\/+$/, '');

export const getSupabaseAnonKey = () => (
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY
).trim();

export const getSupabaseServiceRoleKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  const cleanUser = username.trim();
  if (!cleanUser || !password || cleanUser.length > 254 || password.length > 512) return false;

  const envUser = getAdminUsername().toLowerCase();
  const envPass = getAdminPassword();
  // Fail closed: no built-in/default administrator credentials.
  if (!envUser || !envPass) return false;
  return timingSafeCompare(cleanUser.toLowerCase(), envUser) && timingSafeCompare(password, envPass);
}

function pruneRevokedSessions(now) {
  if (revokedSessions.size < 100) return;
  for (const [jti, exp] of revokedSessions.entries()) {
    if (!exp || exp <= now) revokedSessions.delete(jti);
  }
}

export function createSessionToken(identity) {
  const secret = getSessionSecret();
  if (!secret || secret.length < 32) {
    const err = new Error('ADMIN_SESSION_SECRET must be set to at least 32 characters.');
    err.code = 'ADMIN_SESSION_SECRET_MISSING';
    throw err;
  }

  const opts = (typeof identity === 'string')
    ? { sub: identity, uid: null, email: null, authMethod: 'env' }
    : (identity || {});

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(opts.sub || opts.email || opts.uid || 'admin'),
    uid: opts.uid || null,
    email: opts.email || null,
    authMethod: opts.authMethod || 'env',
    role: 'admin',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;
  if (!b64Header || !b64Payload || !signature) return null;

  const secret = getSessionSecret();
  if (!secret || secret.length < 32) return null;

  const expectedSig = crypto.createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const header = JSON.parse(Buffer.from(b64Header, 'base64url').toString('utf8'));
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin') return null;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || typeof payload.exp !== 'number' || payload.exp <= now) return null;

    if (payload.jti) {
      const revokedUntil = revokedSessions.get(payload.jti);
      if (revokedUntil && revokedUntil > now) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function revokeSessionToken(token) {
  const payload = verifySessionToken(token);
  if (!payload || !payload.jti) return false;
  const now = Math.floor(Date.now() / 1000);
  pruneRevokedSessions(now);
  revokedSessions.set(payload.jti, payload.exp || (now + SESSION_MAX_AGE_SECONDS));
  return true;
}

export function shouldRefreshSession(session) {
  if (!session || !session.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return (session.exp - now) < SESSION_REFRESH_THRESHOLD_SECONDS;
}

export function readCookie(req, name = COOKIE_NAME) {
  const cookieHeader = req?.headers?.cookie || '';
  for (const item of cookieHeader.split(';')) {
    const index = item.indexOf('=');
    if (index > 0 && item.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(item.slice(index + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function isHttpsRequest(req) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return true;
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  if (req?.secure) return true;
  return false;
}

export function buildSessionCookie(token, isSecure = false) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax'
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie(isSecure = false) {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax'
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

export function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function getClientIp(req) {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req?.ip || req?.socket?.remoteAddress || 'unknown';
}

export function checkLoginRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const recent = (failedLoginAttempts.get(ip) || []).filter(ts => (now - ts) < RATE_LIMIT_WINDOW_MS);
  if (recent.length > 0) {
    failedLoginAttempts.set(ip, recent);
  } else {
    failedLoginAttempts.delete(ip);
  }

  if (recent.length >= RATE_LIMIT_MAX_FAILURES) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const recent = (failedLoginAttempts.get(ip) || []).filter(ts => (now - ts) < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  failedLoginAttempts.set(ip, recent);
}

export function clearLoginFailures(req) {
  failedLoginAttempts.delete(getClientIp(req));
}

export function verifySameOrigin(req) {
  const fetchSite = String(req?.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') return false;

  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().toLowerCase();
  if (!host) return true;

  const origin = req?.headers?.origin;
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  const referer = req?.headers?.referer;
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  return true;
}

export function extractBearerToken(req, body = null) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  if (body && typeof body.accessToken === 'string' && body.accessToken.trim()) {
    return body.accessToken.trim();
  }
  return '';
}

export async function verifySupabaseAdminAccessToken(accessToken) {
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 8192) {
    return { ok: false, status: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token.' };
  }
  if (accessToken.split('.').length !== 3) {
    return { ok: false, status: 401, code: 'INVALID_TOKEN', message: 'Malformed authentication token.' };
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const authApiKey = serviceRoleKey || anonKey;

  let user;
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: authApiKey,
        Authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!userResp.ok) {
      return {
        ok: false,
        status: 401,
        code: 'SUPABASE_AUTH_INVALID',
        message: 'Supabase authentication session is invalid or expired. Please sign in again.'
      };
    }

    user = await userResp.json();
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'SUPABASE_UNAVAILABLE',
      message: 'Unable to reach authentication service to verify session.'
    };
  }

  if (!user || typeof user.id !== 'string' || !UUID_REGEX.test(user.id)) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_USER',
      message: 'Authenticated user identifier could not be verified.'
    };
  }

  // Verify administrator record in public.admin_access server-side.
  // Uses service role key when configured; otherwise uses the verified user JWT under RLS
  // where public.admin_access only permits selecting user_id = auth.uid().
  try {
    const restKey = serviceRoleKey || anonKey;
    const restBearer = serviceRoleKey || accessToken;
    const accessResp = await fetch(
      `${supabaseUrl}/rest/v1/admin_access?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: restKey,
          Authorization: `Bearer ${restBearer}`,
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!accessResp.ok) {
      return {
        ok: false,
        status: 503,
        code: 'ADMIN_ACCESS_CHECK_FAILED',
        message: 'Unable to verify administrator authorization record.'
      };
    }

    const rows = await accessResp.json();
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.user_id !== user.id) {
      return {
        ok: false,
        status: 403,
        code: 'NOT_AUTHORIZED',
        message: 'This account is not authorized for the administrator dashboard.'
      };
    }

    return {
      ok: true,
      user: {
        id: user.id,
        email: typeof user.email === 'string' ? user.email : null
      }
    };
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'ADMIN_ACCESS_UNAVAILABLE',
      message: 'Unable to reach database to confirm administrator access.'
    };
  }
}

export async function verifyActiveAdminRecordById(userId) {
  const serviceRoleKey = getSupabaseServiceRoleKey();

  // A signed browser session must never remain authorized when the server
  // cannot independently re-check the administrator allow-list.
  if (!serviceRoleKey) {
    return { ok: false, unavailable: true };
  }
  if (!userId || !UUID_REGEX.test(userId)) {
    return { ok: false, unavailable: false };
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/admin_access?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(6000)
      }
    );

    if (!resp.ok) {
      return { ok: false, unavailable: true };
    }

    const rows = await resp.json();
    return {
      ok: Array.isArray(rows) && rows.length === 1 && rows[0]?.user_id === userId,
      unavailable: false
    };
  } catch {
    return { ok: false, unavailable: true };
  }
}

export function formatSessionUser(session) {
  return {
    id: session.uid || null,
    username: session.sub,
    email: session.email || null,
    role: session.role,
    authMethod: session.authMethod || 'env',
    expiresAt: session.exp
  };
}

export async function parseJsonBody(req) {
  let body = req?.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (body && typeof body === 'object') return body;
  return {};
}

export async function handleAdminLogin(req, res) {
  res.setHeader('Content-Type', 'application/json');
  setNoStoreHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  if (!verifySameOrigin(req)) {
    return res.status(403).json({
      ok: false,
      code: 'CSRF_ORIGIN_MISMATCH',
      message: 'Cross-origin administrator sign-in request rejected.'
    });
  }

  const rate = checkLoginRateLimit(req);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      code: 'RATE_LIMITED',
      message: `Too many failed login attempts. Try again in ${rate.retryAfterSeconds} seconds.`
    });
  }

  const body = await parseJsonBody(req);
  const accessToken = extractBearerToken(req, body);
  const isSecure = isHttpsRequest(req);

  // Path 1: Supabase JWT + server-side public.admin_access verification
  if (accessToken) {
    const verified = await verifySupabaseAdminAccessToken(accessToken);
    if (!verified.ok) {
      if (verified.status === 401 || verified.status === 403) {
        recordLoginFailure(req);
        res.setHeader('Set-Cookie', buildClearCookie(isSecure));
      }
      return res.status(verified.status).json({
        ok: false,
        authenticated: false,
        code: verified.code,
        message: verified.message
      });
    }

    if (!getSupabaseServiceRoleKey()) {
      return res.status(503).json({
        ok: false,
        authenticated: false,
        code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'Server administrator authorization verification is not configured. Set SUPABASE_SERVICE_ROLE_KEY in the server environment.'
      });
    }

    const activeAdmin = await verifyActiveAdminRecordById(verified.user.id);
    if (activeAdmin.unavailable) {
      return res.status(503).json({
        ok: false,
        authenticated: false,
        code: 'ADMIN_ACCESS_CHECK_UNAVAILABLE',
        message: 'Unable to verify administrator access on the server. Please try again later.'
      });
    }
    if (!activeAdmin.ok) {
      recordLoginFailure(req);
      res.setHeader('Set-Cookie', buildClearCookie(isSecure));
      return res.status(403).json({
        ok: false,
        authenticated: false,
        code: 'NOT_AUTHORIZED',
        message: 'This account is not authorized for the administrator dashboard.'
      });
    }

    if (!hasValidSessionSecret()) {
      return res.status(503).json({
        ok: false,
        authenticated: false,
        code: 'ADMIN_SESSION_SECRET_MISSING',
        message: 'Server administrator session secret (ADMIN_SESSION_SECRET) is not configured.'
      });
    }

    clearLoginFailures(req);
    const sessionToken = createSessionToken({
      sub: verified.user.email || verified.user.id,
      uid: verified.user.id,
      email: verified.user.email,
      authMethod: 'supabase'
    });
    const payload = verifySessionToken(sessionToken);
    res.setHeader('Set-Cookie', buildSessionCookie(sessionToken, isSecure));

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: formatSessionUser(payload),
      message: 'Mwalowa bwinobwino ngati administrator. (Authenticated successfully.)',
      redirect: '/pages/admin.html'
    });
  }

  // Path 2: Server-only ADMIN_USERNAME / ADMIN_PASSWORD credentials fallback
  const { username, password } = body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({
      ok: false,
      message: 'Chonde lembani dzina la administrator ndi mawu achinsinsi. (Username and password or Supabase session required.)'
    });
  }

  const isValid = verifyAdminCredentials(username, password);
  if (!isValid) {
    recordLoginFailure(req);
    return res.status(401).json({
      ok: false,
      authenticated: false,
      message: 'Dzina la administrator kapena mawu achinsinsi sizolondola. (Invalid administrator credentials.)'
    });
  }

  if (!hasValidSessionSecret()) {
    return res.status(503).json({
      ok: false,
      authenticated: false,
      code: 'ADMIN_SESSION_SECRET_MISSING',
      message: 'Server administrator session secret (ADMIN_SESSION_SECRET) is not configured.'
    });
  }

  clearLoginFailures(req);
  const sessionToken = createSessionToken({
    sub: username.trim(),
    authMethod: 'env'
  });
  const payload = verifySessionToken(sessionToken);
  res.setHeader('Set-Cookie', buildSessionCookie(sessionToken, isSecure));

  return res.status(200).json({
    ok: true,
    authenticated: true,
    user: formatSessionUser(payload),
    message: 'Mwalowa bwinobwino ngati administrator. (Authenticated successfully.)',
    redirect: '/pages/admin.html'
  });
}

export async function handleAdminSession(req, res) {
  res.setHeader('Content-Type', 'application/json');
  setNoStoreHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ authenticated: false, message: 'Method Not Allowed' });
  }

  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  const isSecure = isHttpsRequest(req);

  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'No active administrator session.'
    });
  }

  if (session.authMethod === 'supabase' && session.uid) {
    const adminCheck = await verifyActiveAdminRecordById(session.uid);
    if (adminCheck.unavailable) {
      return res.status(503).json({
        authenticated: false,
        code: 'ADMIN_ACCESS_CHECK_UNAVAILABLE',
        message: 'Unable to verify administrator authorization right now. Please try again later.'
      });
    }
    if (!adminCheck.ok) {
      revokeSessionToken(token);
      res.setHeader('Set-Cookie', buildClearCookie(isSecure));
      return res.status(403).json({
        authenticated: false,
        code: 'ADMIN_ACCESS_REVOKED',
        message: 'Administrator access has been revoked.'
      });
    }
  }

  if (shouldRefreshSession(session) && hasValidSessionSecret()) {
    const renewed = createSessionToken({
      sub: session.sub,
      uid: session.uid || null,
      email: session.email || null,
      authMethod: session.authMethod || 'env'
    });
    revokeSessionToken(token);
    res.setHeader('Set-Cookie', buildSessionCookie(renewed, isSecure));
    const renewedPayload = verifySessionToken(renewed);
    return res.status(200).json({
      authenticated: true,
      user: formatSessionUser(renewedPayload)
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: formatSessionUser(session)
  });
}

export async function handleAdminRefresh(req, res) {
  res.setHeader('Content-Type', 'application/json');
  setNoStoreHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  if (!verifySameOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Cross-origin request rejected.' });
  }

  if (!hasValidSessionSecret()) {
    return res.status(503).json({
      ok: false,
      code: 'ADMIN_SESSION_SECRET_MISSING',
      message: 'Server administrator session secret (ADMIN_SESSION_SECRET) is not configured.'
    });
  }

  const isSecure = isHttpsRequest(req);
  const body = await parseJsonBody(req);
  const accessToken = extractBearerToken(req, body);

  if (accessToken) {
    const verified = await verifySupabaseAdminAccessToken(accessToken);
    if (!verified.ok) {
      if (verified.status === 401 || verified.status === 403) {
        res.setHeader('Set-Cookie', buildClearCookie(isSecure));
      }
      return res.status(verified.status).json({
        ok: false,
        authenticated: false,
        code: verified.code,
        message: verified.message
      });
    }

    const oldToken = readCookie(req, COOKIE_NAME);
    if (oldToken) revokeSessionToken(oldToken);

    const newToken = createSessionToken({
      sub: verified.user.email || verified.user.id,
      uid: verified.user.id,
      email: verified.user.email,
      authMethod: 'supabase'
    });
    const payload = verifySessionToken(newToken);
    res.setHeader('Set-Cookie', buildSessionCookie(newToken, isSecure));
    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: formatSessionUser(payload)
    });
  }

  const oldToken = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(oldToken);
  if (!session) {
    return res.status(401).json({
      ok: false,
      authenticated: false,
      message: 'No active administrator session to refresh.'
    });
  }

  if (session.authMethod === 'supabase' && session.uid) {
    const adminCheck = await verifyActiveAdminRecordById(session.uid);
    if (adminCheck.unavailable) {
      return res.status(503).json({
        ok: false,
        authenticated: false,
        code: 'ADMIN_ACCESS_CHECK_UNAVAILABLE',
        message: 'Unable to verify administrator authorization right now. Please try again later.'
      });
    }
    if (!adminCheck.ok) {
      revokeSessionToken(oldToken);
      res.setHeader('Set-Cookie', buildClearCookie(isSecure));
      return res.status(403).json({
        ok: false,
        authenticated: false,
        code: 'ADMIN_ACCESS_REVOKED',
        message: 'Administrator access has been revoked.'
      });
    }
  }

  revokeSessionToken(oldToken);
  const newToken = createSessionToken({
    sub: session.sub,
    uid: session.uid || null,
    email: session.email || null,
    authMethod: session.authMethod || 'env'
  });
  const payload = verifySessionToken(newToken);
  res.setHeader('Set-Cookie', buildSessionCookie(newToken, isSecure));
  return res.status(200).json({
    ok: true,
    authenticated: true,
    user: formatSessionUser(payload)
  });
}

export async function handleAdminLogout(req, res) {
  res.setHeader('Content-Type', 'application/json');
  setNoStoreHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  if (!verifySameOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Cross-origin logout request rejected.' });
  }

  const token = readCookie(req, COOKIE_NAME);
  if (token) revokeSessionToken(token);

  res.setHeader('Set-Cookie', buildClearCookie(isHttpsRequest(req)));

  return res.status(200).json({
    ok: true,
    authenticated: false,
    message: 'Mwatuluka bwinobwino mu akaunti ya administrator. (Signed out successfully.)'
  });
}
