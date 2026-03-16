import crypto from 'node:crypto';

import { readJsonBody, sendJson } from '../../../server/lib/http.js';
import { requireAdmin } from '../../../server/middleware/auth.js';
import { config, isAuthConfigured } from '../../_lib/config.js';

const sha1 = (value) =>
  crypto.createHash('sha1').update(value, 'utf8').digest('hex');

export default async function handler(req, res) {
  if (!isAuthConfigured()) {
    sendJson(res, 500, { error: 'server_not_configured' });
    return;
  }

  const user = requireAdmin(req, res, config.authSecret);
  if (!user) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || 'novaphones/products').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    sendJson(res, 500, { error: 'cloudinary_not_configured' });
    return;
  }

  // Body is optional; kept for future expansion (e.g. specifying resource_type).
  await readJsonBody(req, { maxBytes: 50_000 }).catch(() => null);

  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signs sorted params joined with & plus the api secret.
  const signature = sha1(`folder=${folder}&timestamp=${timestamp}${apiSecret}`);

  sendJson(res, 200, {
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}

