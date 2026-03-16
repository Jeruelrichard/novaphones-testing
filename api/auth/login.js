import { readJsonBody, buildSetCookie, sendJson } from '../../server/lib/http.js';
import { createToken } from '../../server/lib/token.js';
import { ADMIN_COOKIE } from '../../server/middleware/auth.js';
import { config, cookieSecure, isAuthConfigured, verifyAdminPassword } from '../_lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  if (!isAuthConfigured()) {
    sendJson(res, 500, { error: 'server_not_configured' });
    return;
  }

  const body = await readJsonBody(req, { maxBytes: 250_000 });
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  const ok = email === config.adminEmail && password && verifyAdminPassword(password);
  if (!ok) {
    sendJson(res, 401, { error: 'invalid_credentials' });
    return;
  }

  const token = createToken(
    {
      sub: config.adminEmail,
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    },
    config.authSecret
  );

  const setCookie = buildSetCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  sendJson(res, 200, { ok: true }, { 'Set-Cookie': setCookie });
}

