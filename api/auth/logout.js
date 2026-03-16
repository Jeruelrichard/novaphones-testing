import { buildSetCookie, sendJson } from '../../server/lib/http.js';
import { ADMIN_COOKIE } from '../../server/middleware/auth.js';
import { cookieSecure } from '../_lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  const setCookie = buildSetCookie(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure,
    path: '/',
    maxAge: 0,
  });
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': setCookie });
}

