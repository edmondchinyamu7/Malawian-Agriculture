import { verifyAdminCredentials, createSessionToken, buildSessionCookie } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const { username, password } = body || {};

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

  const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  const token = createSessionToken(username.trim());
  const cookieHeader = buildSessionCookie(token, isSecure);

  res.setHeader('Set-Cookie', cookieHeader);
  return res.status(200).json({
    ok: true,
    message: 'Mwalowa bwinobwino ngati administrator. (Authenticated successfully.)',
    redirect: '/admin'
  });
}
