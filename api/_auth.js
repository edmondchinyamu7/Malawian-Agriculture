import crypto from 'crypto';

export const COOKIE_NAME = 'ulimi_admin_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

export const getAdminUsername = () => (process.env.ADMIN_USERNAME || '').trim();
export const getAdminPassword = () => process.env.ADMIN_PASSWORD || '';
export const getSessionSecret = () => process.env.ADMIN_SESSION_SECRET || '';

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
  if (!username || !password) return false;
  const inputUser = username.trim().toLowerCase();

  const envUser = getAdminUsername().toLowerCase();
  const envPass = getAdminPassword();

  // Fail closed: no built-in/default administrator credentials.
  if (!envUser || !envPass) return false;
  return timingSafeCompare(inputUser, envUser) && timingSafeCompare(password, envPass);
}

export function createSessionToken(username) {
  const secret = getSessionSecret();
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must be set to at least 32 characters.');
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

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;
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
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin') return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(req, name) {
  const cookieHeader = req.headers?.cookie || '';
  for (const item of cookieHeader.split(';')) {
    const index = item.indexOf('=');
    if (index > 0 && item.slice(0, index).trim() === name) {
      return decodeURIComponent(item.slice(index + 1).trim());
    }
  }
  return '';
}

export function buildSessionCookie(token, isSecure = false) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Strict'
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
    'SameSite=Strict'
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}
