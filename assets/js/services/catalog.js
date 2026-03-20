import { products as fallbackProducts } from '../data/products.js';

const PRODUCT_CACHE_KEY = 'novaphones:catalog:v1';
const PRODUCT_CACHE_TTL_MS = 1000 * 60 * 30;
const REQUEST_TIMEOUT_MS = 2800;
const RETRY_DELAY_MS = 300;

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isProduct = (item) =>
  item &&
  typeof item === 'object' &&
  typeof item.id === 'string' &&
  typeof item.name === 'string';

const normalizeProducts = (items) => {
  if (!Array.isArray(items)) return [];
  return items.filter(isProduct);
};

const cloneProducts = (items) => normalizeProducts(items).map((item) => ({ ...item }));

const readStoredProducts = () => {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    const products = normalizeProducts(parsed?.products);
    if (!savedAt || !products.length) return [];
    if (Date.now() - savedAt > PRODUCT_CACHE_TTL_MS) return [];
    return cloneProducts(products);
  } catch (error) {
    return [];
  }
};

const writeStoredProducts = (products) => {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(
      PRODUCT_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), products: normalizeProducts(products) })
    );
  } catch (error) {
    // Ignore storage errors (quota/privacy mode).
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error) =>
  error?.message === 'timeout' ||
  error?.message === 'network_error' ||
  (typeof error?.status === 'number' && error.status >= 500);

const fetchJson = async (url, { timeoutMs = REQUEST_TIMEOUT_MS, retries = 1 } = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.error || 'request_failed');
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      clearTimeout(timeout);
      const wrapped = new Error(
        error?.name === 'AbortError' ? 'timeout' : 'network_error'
      );
      wrapped.status = error?.status;
      lastError = error?.status ? error : wrapped;
      if (attempt >= retries || !shouldRetry(lastError)) {
        throw lastError;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError || new Error('request_failed');
};

let cache = null;
let inflightProducts = null;

const setCache = (products) => {
  cache = cloneProducts(products);
  writeStoredProducts(cache);
  return cloneProducts(cache);
};

const getCachedProductsInternal = () => {
  if (Array.isArray(cache) && cache.length) return cloneProducts(cache);
  const stored = readStoredProducts();
  if (stored.length) {
    cache = cloneProducts(stored);
    return cloneProducts(cache);
  }
  return [];
};

const mergeIntoCache = (product) => {
  if (!isProduct(product)) return;
  const products = getCachedProductsInternal();
  const index = products.findIndex((item) => item.id === product.id);
  if (index === -1) products.unshift({ ...product });
  else products[index] = { ...products[index], ...product };
  setCache(products);
};

const fetchProductsFromApi = async () => {
  if (inflightProducts) return inflightProducts;
  inflightProducts = fetchJson('/api/products')
    .then((products) => setCache(products))
    .finally(() => {
      inflightProducts = null;
    });
  return inflightProducts;
};

export const catalogService = {
  getQuickProducts() {
    const cachedProducts = getCachedProductsInternal();
    if (cachedProducts.length) return cachedProducts;
    cache = cloneProducts(fallbackProducts);
    return cloneProducts(cache);
  },
  getCachedProducts() {
    return getCachedProductsInternal();
  },
  async getProducts() {
    try {
      return await fetchProductsFromApi();
    } catch (error) {
      const cachedProducts = getCachedProductsInternal();
      if (cachedProducts.length) return cachedProducts;
      cache = cloneProducts(fallbackProducts);
      return cloneProducts(cache);
    }
  },
  async getProductById(id) {
    const cachedProducts = getCachedProductsInternal();
    const localMatch = cachedProducts.find((item) => item.id === id);
    if (localMatch) return { ...localMatch };

    try {
      const product = await fetchJson(`/api/products/${encodeURIComponent(id)}`, {
        timeoutMs: 2500,
        retries: 1,
      });
      mergeIntoCache(product);
      return product || null;
    } catch (error) {
      const products = cachedProducts.length ? cachedProducts : fallbackProducts;
      return products.find((item) => item.id === id) || null;
    }
  },
  async getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const products = getCachedProductsInternal().length
      ? getCachedProductsInternal()
      : await this.getProducts();
    const related = products.filter(
      (item) => item.id !== product.id && item.brand === product.brand
    );
    const fallback = products.filter(
      (item) => item.id !== product.id && item.brand !== product.brand
    );
    return [...related, ...fallback].slice(0, limit);
  },
};
