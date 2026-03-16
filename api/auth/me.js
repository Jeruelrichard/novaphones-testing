import { sendJson } from '../../server/lib/http.js';
import { getUserFromRequest } from '../../server/middleware/auth.js';
import { config, isAuthConfigured } from '../_lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    return;
  }

  if (!isAuthConfigured()) {
    sendJson(res, 500, { error: 'server_not_configured' });
    return;
  }

  const user = getUserFromRequest(req, config.authSecret);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  sendJson(res, 200, { user: { email: user.sub, role: user.role } });
}

