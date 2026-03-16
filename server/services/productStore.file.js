import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cloudinary } from './cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '..', 'data');
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
const productsFile = path.resolve(dataDir, 'products.json');

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const ensureDirs = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
};

const readProducts = async () => {
  try {
    const raw = await fs.readFile(productsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeProducts = async (products) => {
  await fs.writeFile(productsFile, JSON.stringify(products, null, 2), 'utf8');
};

const saveImageFromDataUrl = async (dataUrl, originalName = 'upload') => {
  const match = /^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl || ''
  );
  if (!match) return null;
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');

  // 5MB limit (decoded)
  if (buffer.length > 5 * 1024 * 1024) {
    const error = new Error('image_too_large');
    error.statusCode = 413;
    throw error;
  }

  const safeBase = slugify(path.parse(originalName).name) || 'image';
  const unique = crypto.randomBytes(8).toString('hex');
  const filename = `${safeBase}-${unique}.${ext}`;
  const filePath = path.resolve(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);
  return { url: `/uploads/${filename}` };
};

export const fileProductStore = {
  async init() {
    await ensureDirs();
  },

  async getAll() {
    await ensureDirs();
    return readProducts();
  },

  async getById(id) {
    const products = await this.getAll();
    return products.find((item) => item.id === id) || null;
  },

  async create(input) {
    await ensureDirs();
    const products = await readProducts();

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

    const baseId =
      slugify(input?.id ? String(input.id) : name) || 'product';
    let id = baseId;
    if (products.some((item) => item.id === id)) {
      id = `${baseId}-${crypto.randomBytes(3).toString('hex')}`;
    }

    let imageUrl = null;
    let imagePublicId = null;
    if (input?.image?.url) {
      imageUrl = String(input.image.url);
      if (input?.image?.publicId) imagePublicId = String(input.image.publicId);
    } else if (input?.image?.dataUrl) {
      const saved = await saveImageFromDataUrl(
        String(input.image.dataUrl),
        String(input.image.filename || name)
      );
      imageUrl = saved?.url || null;
    }

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.unshift(product);
    await writeProducts(products);
    return product;
  },

  async remove(id) {
    await ensureDirs();
    const products = await readProducts();
    const index = products.findIndex((item) => item.id === id);
    if (index === -1) return false;

    const [removed] = products.splice(index, 1);
    await writeProducts(products);

    if (removed?.imageUrl && removed.imageUrl.startsWith('/uploads/')) {
      const filename = removed.imageUrl.replace('/uploads/', '');
      const filePath = path.resolve(uploadsDir, filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore missing files.
      }
    }

    if (removed?.imagePublicId && cloudinary.isConfigured()) {
      try {
        await cloudinary.destroyImage(String(removed.imagePublicId));
      } catch (error) {
        // Ignore Cloudinary errors on delete.
      }
    }

    return true;
  },
};
