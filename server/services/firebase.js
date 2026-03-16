let cached = null;

const parseServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!rawJson && !rawB64) return null;

  try {
    const json = rawJson
      ? rawJson
      : Buffer.from(String(rawB64), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    const e = new Error('firebase_service_account_invalid');
    e.statusCode = 500;
    throw e;
  }
};

export const getFirebase = async () => {
  if (cached) return cached;
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const firestore = admin.firestore();

  cached = { admin, firestore };
  return cached;
};
