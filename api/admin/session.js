import { handleAdminSession } from '../_auth.js';

export default async function handler(req, res) {
  return handleAdminSession(req, res);
}
