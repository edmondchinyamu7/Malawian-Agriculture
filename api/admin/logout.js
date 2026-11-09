import { buildClearCookie } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', buildClearCookie(isSecure));

  return res.status(200).json({
    ok: true,
    message: 'Mwatuluka bwinobwino mu akaunti ya administrator. (Signed out successfully.)'
  });
}
