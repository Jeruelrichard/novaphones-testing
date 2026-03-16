import { Buffer } from 'node:buffer';

export const parseCookies = (req) => {
  const header = req.headers.cookie;
  if (!header) return {};
  const entries = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return [part, ''];
      return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
    });
  return Object.fromEntries(entries);
};

export const readRequestBody = async (req, { maxBytes = 1_500_000 } = {}) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
};

export const readJsonBody = async (req, options) => {
  const raw = await readRequestBody(req, options);
  if (!raw.length) return null;
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch (error) {
    const parseError = new Error('invalid_json');
    parseError.statusCode = 400;
    throw parseError;
  }
};

export const sendJson = (res, statusCode, data, headers = {}) => {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
};

export const sendText = (res, statusCode, text, headers = {}) => {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(text);
};

export const sendRedirect = (res, statusCode, location) => {
  res.writeHead(statusCode, { Location: location });
  res.end();
};

export const buildSetCookie = (name, value, attributes = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (attributes.maxAge !== undefined) parts.push(`Max-Age=${attributes.maxAge}`);
  if (attributes.path) parts.push(`Path=${attributes.path}`);
  if (attributes.httpOnly) parts.push('HttpOnly');
  if (attributes.secure) parts.push('Secure');
  if (attributes.sameSite) parts.push(`SameSite=${attributes.sameSite}`);
  return parts.join('; ');
};

