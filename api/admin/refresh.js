import { handleAdminRefresh } from '../_auth.js';

export default async function handler(req, res) {
  return handleAdminRefresh(req, res);
}
