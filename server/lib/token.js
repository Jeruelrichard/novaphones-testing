import crypto from 'node:crypto';

const base64UrlEncode = (value) =>
  Buffer.from(value, 'utf8').toString('base64url');

const base64UrlDecode = (value) =>
  Buffer.from(value, 'base64url').toString('utf8');

export const createToken = (payload, secret) => {
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest('base64url');
  return `${payloadPart}.${signature}`;
};

export const verifyToken = (token, secret) => {
  if (!token) return { ok: false, error: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'malformed' };

  const [payloadPart, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return { ok: false, error: 'bad' };
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return { ok: false, error: 'bad' };

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch (error) {
    return { ok: false, error: 'bad_payload' };
  }

  if (payload && typeof payload.exp === 'number' && Date.now() > payload.exp) {
    return { ok: false, error: 'expired' };
  }

  return { ok: true, payload };
};

