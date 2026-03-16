import { readJsonBody, sendJson } from '../../../server/lib/http.js';
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

  if (req.method === 'GET') {
    try {
      const products = await productStore.getAll();
      sendJson(res, 200, products);
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: error.message || 'server_error' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req, { maxBytes: 12_000_000 });
      const created = await productStore.create(body);
      sendJson(res, 201, created);
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: error.message || 'server_error' });
    }
    return;
  }

  sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
}
