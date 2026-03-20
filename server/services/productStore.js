import { fileProductStore } from './productStore.file.js';
import { firebaseProductStore } from './productStore.firebase.js';

const firebaseEnabled = () =>
  Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_B64
  );

const pickStore = async () => {
  if (firebaseEnabled()) return firebaseProductStore;
  return fileProductStore;
};

export const productStore = {
  async init() {
    const store = await pickStore();
    return store.init();
  },

  async getAll() {
    const store = await pickStore();
    const result = await store.getAll();
    if (result === null) return fileProductStore.getAll();
    return result;
  },

  async getById(id) {
    const store = await pickStore();
    const result = await store.getById(id);
    if (result === null) return fileProductStore.getById(id);
    return result;
  },

  async create(input) {
    const store = await pickStore();
    return store.create(input);
  },

  async update(id, input) {
    const store = await pickStore();
    return store.update(id, input);
  },

  async remove(id) {
    const store = await pickStore();
    return store.remove(id);
  },
};
