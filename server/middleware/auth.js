import { parseCookies, sendJson } from '../lib/http.js';
import { verifyToken } from '../lib/token.js';

export const ADMIN_COOKIE = 'np_admin';

export const getUserFromRequest = (req, secret) => {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  const result = verifyToken(token, secret);
  if (!result.ok) return null;
  return result.payload;
};

export const requireAdmin = (req, res, secret) => {
  const user = getUserFromRequest(req, secret);
  if (!user || user.role !== 'admin') {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  return user;
};

