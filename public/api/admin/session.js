import { COOKIE_NAME, readCookie, verifySessionToken } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const token = readCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'No active administrator session.'
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      username: session.sub,
      role: session.role,
      expiresAt: session.exp
    }
  });
}
