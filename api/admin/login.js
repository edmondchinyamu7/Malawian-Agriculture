import { handleAdminLogin } from '../_auth.js';

export default async function handler(req, res) {
  return handleAdminLogin(req, res);
}
