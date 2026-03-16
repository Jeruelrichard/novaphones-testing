import { products as fallbackProducts } from '../data/products.js';

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('request_failed');
  return response.json();
};

let cache = null;

export const catalogService = {
  async getProducts() {
    try {
      const products = await fetchJson('/api/products');
      cache = products;
      return [...products];
    } catch (error) {
      cache = [...fallbackProducts];
      return [...fallbackProducts];
    }
  },
  async getProductById(id) {
    try {
      const product = await fetchJson(`/api/products/${encodeURIComponent(id)}`);
      return product || null;
    } catch (error) {
      const products = cache || fallbackProducts;
      return products.find((item) => item.id === id) || null;
    }
  },
  async getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const products = cache || (await this.getProducts());
    const related = products.filter(
      (item) => item.id !== product.id && item.brand === product.brand
    );
    const fallback = products.filter(
      (item) => item.id !== product.id && item.brand !== product.brand
    );
    return [...related, ...fallback].slice(0, limit);
  },
};
