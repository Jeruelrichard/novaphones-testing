import { catalogService } from './catalog.js';

const CART_KEY = 'novaphones:cart';

const normalizeColor = (value, fallback = '') =>
  String(value || fallback || '')
    .trim()
    .replace(/\s+/g, ' ');

const lineKey = (id, color) =>
  `${String(id).trim()}::${normalizeColor(color).toLowerCase()}`;

const safeNumber = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
};

const consolidate = (items) => {
  const map = new Map();

  items.forEach((item) => {
    if (!item || !item.id || !item.qty) return;
    const id = String(item.id).trim();
    const color = normalizeColor(item.color);
    const qty = safeNumber(item.qty, 1);
    const key = lineKey(id, color);
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
      return;
    }
    map.set(key, { id, color, qty });
  });

  return Array.from(map.values());
};

const loadCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return consolidate(parsed);
  } catch (error) {
    return [];
  }
};

const saveCart = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(consolidate(items)));
};

export const cartService = {
  getItems() {
    return loadCart();
  },
  getCount() {
    return loadCart().reduce((sum, item) => sum + safeNumber(item.qty, 0), 0);
  },
  addItem(id, qty = 1, color = '') {
    const items = loadCart();
    const normalizedColor = normalizeColor(color);
    const existing = items.find(
      (item) => item.id === id && normalizeColor(item.color) === normalizedColor
    );
    if (existing) {
      existing.qty = safeNumber(existing.qty + qty, 1);
    } else {
      items.push({ id, color: normalizedColor, qty: safeNumber(qty, 1) });
    }
    saveCart(items);
  },
  updateItem(key, qty) {
    const items = loadCart();
    const nextQty = safeNumber(qty, 1);
    const updated = items.map((item) =>
      lineKey(item.id, item.color) === key ? { ...item, qty: nextQty } : item
    );
    saveCart(updated);
  },
  removeItem(key) {
    const items = loadCart().filter(
      (item) => lineKey(item.id, item.color) !== key
    );
    saveCart(items);
  },
  setItemColor(key, nextColor) {
    const items = loadCart();
    const target = items.find((item) => lineKey(item.id, item.color) === key);
    if (!target) return;

    target.color = normalizeColor(nextColor, target.color);
    saveCart(items);
  },
  splitItemToNextColor(key, availableColors = []) {
    const colors = availableColors
      .map((color) => normalizeColor(color))
      .filter(Boolean);
    if (!colors.length) return;

    const items = loadCart();
    const index = items.findIndex((item) => lineKey(item.id, item.color) === key);
    if (index === -1) return;

    const current = items[index];
    const currentQty = safeNumber(current.qty, 1);
    if (currentQty <= 1) return;

    const currentColor = normalizeColor(current.color, colors[0]);
    const currentColorIndex = colors.findIndex(
      (color) => color.toLowerCase() === currentColor.toLowerCase()
    );
    const fallbackIndex = currentColorIndex === -1 ? 0 : currentColorIndex;
    const nextColor = colors[(fallbackIndex + 1) % colors.length];

    current.qty = currentQty - 1;
    items.push({ id: current.id, color: nextColor, qty: 1 });
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
        const selectedColor = normalizeColor(
          item.color,
          Array.isArray(product.colors) && product.colors.length
            ? product.colors[0]
            : 'Standard'
        );

        detailed.push({
          ...product,
          key: lineKey(product.id, selectedColor),
          selectedColor,
          qty: safeNumber(item.qty, 1),
          lineTotal: product.price * safeNumber(item.qty, 1),
        });
      }
    }
    const subtotal = detailed.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items: detailed, subtotal };
  },
};
