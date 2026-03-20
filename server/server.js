import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './lib/env.js';
import {
  buildSetCookie,
  readJsonBody,
  sendJson,
  sendRedirect,
  sendText,
} from './lib/http.js';
import { createToken } from './lib/token.js';
import { ADMIN_COOKIE, getUserFromRequest, requireAdmin } from './middleware/auth.js';
import { productStore } from './services/productStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv();

const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.resolve(__dirname, 'uploads');

const PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const AUTH_SECRET =
  process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.AUTH_SECRET) {
  console.warn(
    '[warn] AUTH_SECRET is missing; sessions will reset on server restart. Set it in server/.env.'
  );
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

const loginAttempts = new Map();

const timingSafeEquals = (a, b) => {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const verifyAdminPassword = (password) => {
  if (ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_SALT) {
    const salt = Buffer.from(ADMIN_PASSWORD_SALT, 'hex');
    const expected = Buffer.from(ADMIN_PASSWORD_HASH, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length);
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  if (ADMIN_PASSWORD) {
    console.warn(
      '[warn] Using ADMIN_PASSWORD (plain text). Prefer ADMIN_PASSWORD_SALT + ADMIN_PASSWORD_HASH for production.'
    );
    return timingSafeEquals(password, ADMIN_PASSWORD);
  }

  return false;
};

const canAttemptLogin = (ip) => {
  const entry = loginAttempts.get(ip);
  if (!entry) return { ok: true };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { ok: false, retryAfterMs: entry.lockedUntil - Date.now() };
  }
  return { ok: true };
};

const recordFailedLogin = (ip) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const lockMs = 10 * 60 * 1000;

  const entry = loginAttempts.get(ip) || { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - entry.firstAt > windowMs) {
    entry.count = 0;
    entry.firstAt = now;
  }

  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = now + lockMs;
  }

  loginAttempts.set(ip, entry);
};

const clearLoginAttempts = (ip) => {
  loginAttempts.delete(ip);
};

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
]);

const getContentType = (filePath) =>
  contentTypes.get(path.extname(filePath).toLowerCase()) ||
  'application/octet-stream';

const serveStatic = (req, res, pathname) => {
  const isUploads = pathname.startsWith('/uploads/');
  const baseDir = isUploads ? uploadsDir : rootDir;
  const relativePath = isUploads
    ? pathname.replace('/uploads/', '')
    : pathname === '/'
      ? 'index.html'
      : pathname.replace(/^\//, '');

  const safeRel = relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath;
  const filePath = path.resolve(baseDir, safeRel);
  const rel = path.relative(baseDir, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    sendText(res, 400, 'Bad request');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });
};

await productStore.init();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // --- API: public catalog ---
  if (req.method === 'GET' && pathname === '/api/products') {
    try {
      const products = await productStore.getAll();
      sendJson(
        res,
        200,
        products,
        { 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=300' }
      );
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: error.message || 'server_error' });
    }
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/products/')) {
    const id = pathname.replace('/api/products/', '');
    try {
      const product = await productStore.getById(id);
      if (!product) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }
      sendJson(
        res,
        200,
        product,
        { 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=300' }
      );
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: error.message || 'server_error' });
    }
    return;
  }

  // --- API: auth ---
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const gate = canAttemptLogin(ip);
    if (!gate.ok) {
      sendJson(res, 429, { error: 'too_many_attempts' });
      return;
    }

    const body = await readJsonBody(req, { maxBytes: 250_000 });
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!ADMIN_EMAIL) {
      sendJson(res, 500, { error: 'server_not_configured' });
      return;
    }

    if (!ADMIN_PASSWORD && !(ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_SALT)) {
      sendJson(res, 500, { error: 'server_not_configured' });
      return;
    }

    const ok =
      email === ADMIN_EMAIL && password && verifyAdminPassword(password);
    if (!ok) {
      recordFailedLogin(ip);
      sendJson(res, 401, { error: 'invalid_credentials' });
      return;
    }

    clearLoginAttempts(ip);

    const token = createToken(
      {
        sub: ADMIN_EMAIL,
        role: 'admin',
        iat: Date.now(),
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      },
      AUTH_SECRET
    );

    const setCookie = buildSetCookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    sendJson(res, 200, { ok: true }, { 'Set-Cookie': setCookie });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const setCookie = buildSetCookie(ADMIN_COOKIE, '', {
      httpOnly: true,
      sameSite: 'Lax',
      secure: NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': setCookie });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = getUserFromRequest(req, AUTH_SECRET);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    sendJson(res, 200, { user: { email: user.sub, role: user.role } });
    return;
  }

  // --- API: admin products ---
  if (pathname === '/api/admin/products' && req.method === 'GET') {
    const user = requireAdmin(req, res, AUTH_SECRET);
    if (!user) return;
    try {
      const products = await productStore.getAll();
      sendJson(res, 200, products);
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: error.message || 'server_error' });
    }
    return;
  }

  if (pathname === '/api/admin/products' && req.method === 'POST') {
    const user = requireAdmin(req, res, AUTH_SECRET);
    if (!user) return;
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

  if (
    pathname.startsWith('/api/admin/products/') &&
    (req.method === 'DELETE' || req.method === 'PATCH')
  ) {
    const user = requireAdmin(req, res, AUTH_SECRET);
    if (!user) return;
    const id = pathname.replace('/api/admin/products/', '');
    if (req.method === 'PATCH') {
      try {
        const body = await readJsonBody(req, { maxBytes: 12_000_000 });
        const updated = await productStore.update(id, body || {});
        if (!updated) {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }
        sendJson(res, 200, updated);
      } catch (error) {
        const status = error.statusCode || 500;
        sendJson(res, status, { error: error.message || 'server_error' });
      }
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
    return;
  }

  // --- Admin UI protection ---
  const isAdminUi =
    pathname === '/admin' ||
    pathname === '/admin/' ||
    pathname.startsWith('/admin/');
  const isAdminLogin =
    pathname === '/admin/login.html' || pathname === '/admin/login';

  if (isAdminUi && !isAdminLogin) {
    const user = getUserFromRequest(req, AUTH_SECRET);
    if (!user || user.role !== 'admin') {
      const next = pathname === '/admin' || pathname === '/admin/' ? '/admin' : pathname;
      sendRedirect(res, 302, `/admin/login.html?next=${encodeURIComponent(next)}`);
      return;
    }
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    sendRedirect(res, 302, '/admin/index.html');
    return;
  }

  // --- Static files ---
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
