import { catalogService } from './catalog.js';

const CART_KEY = 'novaphones:cart';

const safeNumber = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
};

const loadCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && item.qty);
  } catch (error) {
    return [];
  }
};

const saveCart = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
};

export const cartService = {
  getItems() {
    return loadCart();
  },
  getCount() {
    return loadCart().reduce((sum, item) => sum + safeNumber(item.qty, 0), 0);
  },
  addItem(id, qty = 1) {
    const items = loadCart();
    const existing = items.find((item) => item.id === id);
    if (existing) {
      existing.qty = safeNumber(existing.qty + qty, 1);
    } else {
      items.push({ id, qty: safeNumber(qty, 1) });
    }
    saveCart(items);
  },
  updateItem(id, qty) {
    const items = loadCart();
    const nextQty = safeNumber(qty, 1);
    const updated = items.map((item) =>
      item.id === id ? { ...item, qty: nextQty } : item
    );
    saveCart(updated);
  },
  removeItem(id) {
    const items = loadCart().filter((item) => item.id !== id);
    saveCart(items);
  },
  clear() {
    saveCart([]);
  },
  async getDetailedItems() {
    const items = loadCart();
    const products = await catalogService.getProducts();
    const byId = new Map(products.map((product) => [product.id, product]));
    const detailed = [];
    for (const item of items) {
      const product = byId.get(item.id);
      if (product) {
        detailed.push({
          ...product,
          qty: safeNumber(item.qty, 1),
          lineTotal: product.price * safeNumber(item.qty, 1),
        });
      }
    }
    const subtotal = detailed.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items: detailed, subtotal };
  },
};
