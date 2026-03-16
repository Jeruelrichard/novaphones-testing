import { products } from '../data/products.js';

export const catalogService = {
  async getProducts() {
    return [...products];
  },
  async getProductById(id) {
    return products.find((item) => item.id === id) || null;
  },
  async getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const related = products.filter(
      (item) => item.id !== product.id && item.brand === product.brand
    );
    const fallback = products.filter(
      (item) => item.id !== product.id && item.brand !== product.brand
    );
    return [...related, ...fallback].slice(0, limit);
  },
};
