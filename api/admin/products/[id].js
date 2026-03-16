import { sendJson } from '../../../server/lib/http.js';
import { requireAdmin } from '../../../server/middleware/auth.js';
import { productStore } from '../../../server/services/productStore.js';
import { config, isAuthConfigured } from '../../_lib/config.js';

export default async function handler(req, res) {
  if (!isAuthConfigured()) {
    sendJson(res, 500, { error: 'server_not_configured' });
    return;
  }

  const user = requireAdmin(req, res, config.authSecret);
  if (!user) return;

  if (req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'DELETE' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const fallbackId = url.pathname.split('/').filter(Boolean).pop() || '';
  const id = String(req.query?.id || fallbackId).trim();
  if (!id) {
    sendJson(res, 400, { error: 'missing_id' });
    return;
  }

  try {
    const ok = await productStore.remove(id);
    if (!ok) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'server_error' });
  }
}
