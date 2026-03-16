import { sendJson } from '../../server/lib/http.js';
import { productStore } from '../../server/services/productStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    return;
  }

  try {
    const products = await productStore.getAll();
    sendJson(res, 200, products);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'server_error' });
  }
}
