import crypto from 'node:crypto';

const sha1 = (value) =>
  crypto.createHash('sha1').update(value, 'utf8').digest('hex');

const getConfig = () => {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  return { cloudName, apiKey, apiSecret };
};

export const cloudinary = {
  isConfigured() {
    const { cloudName, apiKey, apiSecret } = getConfig();
    return Boolean(cloudName && apiKey && apiSecret);
  },

  async destroyImage(publicId) {
    const { cloudName, apiKey, apiSecret } = getConfig();
    if (!cloudName || !apiKey || !apiSecret) return false;
    if (!publicId) return false;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sha1(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`);

    const body = new URLSearchParams();
    body.set('public_id', publicId);
    body.set('api_key', apiKey);
    body.set('timestamp', String(timestamp));
    body.set('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body }
    );

    return response.ok;
  },
};

