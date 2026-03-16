import { sendJson } from '../../server/lib/http.js';
import { productStore } from '../../server/services/productStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
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
    const product = await productStore.getById(id);
    if (!product) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    sendJson(res, 200, product);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'server_error' });
  }
}
