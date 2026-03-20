import crypto from 'node:crypto';

import { getFirebase } from './firebase.js';
import { cloudinary } from './cloudinary.js';

const COLLECTION = process.env.FIRESTORE_PRODUCTS_COLLECTION || 'products';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const firebaseProductStore = {
  async init() {
    const fb = await getFirebase();
    if (!fb) return;
  },

  async getAll() {
    const fb = await getFirebase();
    if (!fb) return null;

    const snapshot = await fb.firestore
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => doc.data());
  },

  async getById(id) {
    const fb = await getFirebase();
    if (!fb) return null;

    const doc = await fb.firestore.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return doc.data();
  },

  async create(input) {
    const fb = await getFirebase();
    if (!fb) {
      const error = new Error('firebase_not_configured');
      error.statusCode = 500;
      throw error;
    }

    const name = String(input?.name || '').trim();
    const brand = String(input?.brand || '').trim();
    const price = Number.parseInt(input?.price, 10);

    if (!name || !brand || Number.isNaN(price) || price < 0) {
      const error = new Error('invalid_product');
      error.statusCode = 400;
      throw error;
    }

    const badge = String(input?.badge || 'New').trim() || 'New';
    const short = String(input?.short || '').trim();
    const description = String(input?.description || '').trim();
    const colors = Array.isArray(input?.colors) ? input.colors : [];
    const tags = Array.isArray(input?.tags) ? input.tags : [];

    const specsRaw =
      input?.specs && typeof input.specs === 'object' ? input.specs : {};
    const specs = Object.fromEntries(
      Object.entries(specsRaw).filter(([, value]) => String(value || '').trim())
    );

    const baseId = slugify(input?.id ? String(input.id) : name) || 'product';
    let id = baseId;

    const collection = fb.firestore.collection(COLLECTION);
    const exists = await collection.doc(id).get();
    if (exists.exists) {
      id = `${baseId}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const imageUrl = input?.image?.url ? String(input.image.url) : null;
    const imagePublicId = input?.image?.publicId
      ? String(input.image.publicId)
      : null;

    const now = new Date().toISOString();
    const product = {
      id,
      name,
      brand,
      price,
      badge,
      short,
      description,
      specs,
      colors,
      tags,
      imageUrl,
      imagePublicId,
      createdAt: now,
      updatedAt: now,
    };

    await collection.doc(id).set(product);
    return product;
  },

  async remove(id) {
    const fb = await getFirebase();
    if (!fb) {
      const error = new Error('firebase_not_configured');
      error.statusCode = 500;
      throw error;
    }

    const ref = fb.firestore.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;

    const data = doc.data() || {};
    if (data.imagePublicId && cloudinary.isConfigured()) {
      try {
        await cloudinary.destroyImage(String(data.imagePublicId));
      } catch (error) {
        // Ignore Cloudinary errors on delete.
      }
    }

    await ref.delete();
    return true;
  },

  async update(id, input) {
    const fb = await getFirebase();
    if (!fb) {
      const error = new Error('firebase_not_configured');
      error.statusCode = 500;
      throw error;
    }

    const ref = fb.firestore.collection(COLLECTION).doc(id);
    const existingDoc = await ref.get();
    if (!existingDoc.exists) return null;

    const existing = existingDoc.data() || {};

    const name = String(input?.name ?? existing.name ?? '').trim();
    const brand = String(input?.brand ?? existing.brand ?? '').trim();
    const price = Number.parseInt(input?.price ?? existing.price, 10);

    if (!name || !brand || Number.isNaN(price) || price < 0) {
      const error = new Error('invalid_product');
      error.statusCode = 400;
      throw error;
    }

    const badge = String(input?.badge ?? existing.badge ?? 'New').trim() || 'New';
    const short = String(input?.short ?? existing.short ?? '').trim();
    const description = String(
      input?.description ?? existing.description ?? ''
    ).trim();
    const colors = Array.isArray(input?.colors)
      ? input.colors
      : Array.isArray(existing.colors)
        ? existing.colors
        : [];
    const tags = Array.isArray(input?.tags)
      ? input.tags
      : Array.isArray(existing.tags)
        ? existing.tags
        : [];

    const specsSource =
      input?.specs && typeof input.specs === 'object'
        ? input.specs
        : existing.specs && typeof existing.specs === 'object'
          ? existing.specs
          : {};
    const specs = Object.fromEntries(
      Object.entries(specsSource).filter(([, value]) => String(value || '').trim())
    );

    let imageUrl = existing.imageUrl || null;
    let imagePublicId = existing.imagePublicId || null;

    if (input?.image?.url) {
      const nextUrl = String(input.image.url);
      const nextPublicId = input?.image?.publicId
        ? String(input.image.publicId)
        : null;

      if (
        imagePublicId &&
        imagePublicId !== nextPublicId &&
        cloudinary.isConfigured()
      ) {
        try {
          await cloudinary.destroyImage(String(imagePublicId));
        } catch (error) {
          // Ignore Cloudinary errors on image replace.
        }
      }

      imageUrl = nextUrl;
      imagePublicId = nextPublicId;
    }

    const updated = {
      ...existing,
      id,
      name,
      brand,
      price,
      badge,
      short,
      description,
      specs,
      colors,
      tags,
      imageUrl,
      imagePublicId,
      updatedAt: new Date().toISOString(),
    };

    await ref.set(updated, { merge: false });
    return updated;
  },
};
