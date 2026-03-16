import crypto from 'node:crypto';

import { loadEnv } from '../../server/lib/env.js';

// Supports local dev without relying on Vercel to inject env vars.
loadEnv();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  vercelEnv: process.env.VERCEL_ENV || '',
  authSecret: process.env.AUTH_SECRET || '',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminSalt: process.env.ADMIN_PASSWORD_SALT || '',
  adminHash: process.env.ADMIN_PASSWORD_HASH || '',
};

export const isAuthConfigured = () =>
  Boolean(
    config.authSecret &&
      config.adminEmail &&
      (config.adminPassword || (config.adminSalt && config.adminHash))
  );

export const cookieSecure =
  config.nodeEnv === 'production' || process.env.VERCEL === '1';

export const verifyAdminPassword = (password) => {
  if (config.adminHash && config.adminSalt) {
    const salt = Buffer.from(config.adminSalt, 'hex');
    const expected = Buffer.from(config.adminHash, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length);
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  if (config.adminPassword) {
    const aBuf = Buffer.from(String(password));
    const bBuf = Buffer.from(String(config.adminPassword));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  return false;
};

