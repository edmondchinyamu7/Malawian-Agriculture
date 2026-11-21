import { handleAdminLogout } from '../_auth.js';

export default async function handler(req, res) {
  return handleAdminLogout(req, res);
}
