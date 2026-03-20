import { formatCurrency } from '../utils/format.js';
import { qs } from '../utils/dom.js';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const toCsv = (value) => (Array.isArray(value) ? value.join(', ') : '');

const show = (el, message) => {
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || '';
};

const fetchJson = async (url, options) => {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const networkError = new Error('network_error');
    networkError.cause = error;
    throw networkError;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'request_failed');
    error.status = response.status;
    throw error;
  }
  return data;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry once for transient edge/network glitches.
const getCloudinarySignature = async () => {
  const attempt = () =>
    fetchJson('/api/admin/cloudinary/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({}),
    });

  try {
    return await attempt();
  } catch (error) {
    const retryable =
      error?.message === 'network_error' ||
      error?.status === 502 ||
      error?.status === 503 ||
      error?.status === 504;
    if (!retryable) throw error;
    await sleep(650);
    return attempt();
  }
};

const uploadToCloudinary = async (file) => {
  const sig = await getCloudinarySignature();
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const response = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'Image upload failed.';
    throw new Error(message);
  }

  return {
    url: data.secure_url || data.url,
    publicId: data.public_id,
  };
};

const state = {
  products: [],
  editingId: null,
};

const getProductById = (id) => state.products.find((item) => item.id === id) || null;

const renderProducts = (products) => {
  const wrap = qs('[data-products]');
  if (!wrap) return;

  if (!products.length) {
    wrap.innerHTML = '<div class="empty">No products yet.</div>';
    return;
  }

  wrap.innerHTML = products
    .map((item) => {
      const thumb = item.imageUrl
        ? `<img class="admin-thumb" src="${item.imageUrl}" alt="" />`
        : `<div class="admin-thumb admin-thumb--empty"></div>`;
      return `
        <div class="admin-product" data-product-row="${item.id}">
          ${thumb}
          <div class="admin-product-meta">
            <div class="admin-product-title">${item.name}</div>
            <div class="admin-product-sub">
              <span>${item.brand}</span>
              <span>${formatCurrency(item.price)}</span>
              <span class="badge">${item.badge || 'New'}</span>
            </div>
          </div>
          <div class="admin-product-actions">
            <a class="button secondary" href="/product.html?id=${item.id}" target="_blank" rel="noreferrer">View</a>
            <button class="button secondary" type="button" data-edit="${item.id}">Edit</button>
            <button class="button secondary" type="button" data-delete="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
};

const loadProducts = async () => {
  const products = await fetchJson('/api/admin/products');
  state.products = products;
  renderProducts(products);
};

const setEditMode = ({ id, refs }) => {
  state.editingId = id || null;
  const editing = Boolean(state.editingId);

  if (refs.formTitle) {
    refs.formTitle.textContent = editing ? 'Edit product' : 'Add product';
  }
  if (refs.submitLabel) {
    refs.submitLabel.textContent = editing ? 'Save changes' : 'Upload product';
  }
  if (refs.resetLabel) {
    refs.resetLabel.textContent = editing ? 'Cancel edit' : 'Clear';
  }
};

const fillForm = (product) => {
  if (!product) return;
  const specs = product.specs || {};

  const setValue = (selector, value) => {
    const input = qs(selector);
    if (input) input.value = value || '';
  };

  setValue('[data-name]', product.name);
  setValue('[data-brand]', product.brand);
  setValue('[data-price]', String(product.price || ''));
  setValue('[data-badge]', product.badge);
  setValue('[data-short]', product.short);
  setValue('[data-description]', product.description);
  setValue('[data-colors]', toCsv(product.colors));
  setValue('[data-tags]', toCsv(product.tags));

  setValue('[data-spec-display]', specs.display);
  setValue('[data-spec-camera]', specs.camera);
  setValue('[data-spec-battery]', specs.battery);
  setValue('[data-spec-storage]', specs.storage);

  const imageInput = qs('[data-image]');
  if (imageInput) imageInput.value = '';
};

const init = async () => {
  // Ensure authenticated (server also protects, this is just nicer UX).
  const me = await fetch('/api/auth/me');
  if (!me.ok) {
    window.location.href = `/admin/login.html?next=${encodeURIComponent('/admin')}`;
    return;
  }

  const form = qs('[data-product-form]');
  const refreshBtn = qs('[data-refresh]');
  const logoutBtn = qs('[data-logout]');
  const formError = qs('[data-form-error]');
  const formSuccess = qs('[data-form-success]');
  const formTitle = qs('[data-form-title]');
  const submitLabel = qs('[data-submit-label]');
  const resetLabel = qs('[data-reset-label]');
  const refs = { formTitle, submitLabel, resetLabel };

  setEditMode({ id: null, refs });
  await loadProducts();

  refreshBtn?.addEventListener('click', async () => {
    show(formError, '');
    show(formSuccess, '');
    await loadProducts();
  });

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/admin/login.html';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    show(formError, '');
    show(formSuccess, '');

    const name = qs('[data-name]')?.value;
    const brand = qs('[data-brand]')?.value;
    const price = qs('[data-price]')?.value;
    const badge = qs('[data-badge]')?.value;
    const short = qs('[data-short]')?.value;
    const description = qs('[data-description]')?.value;
    const colors = parseCsv(qs('[data-colors]')?.value);
    const tags = parseCsv(qs('[data-tags]')?.value);

    const specs = {
      display: qs('[data-spec-display]')?.value,
      camera: qs('[data-spec-camera]')?.value,
      battery: qs('[data-spec-battery]')?.value,
      storage: qs('[data-spec-storage]')?.value,
    };

    const imageInput = qs('[data-image]');
    const file = imageInput?.files?.[0];

    let image = null;
    if (file) {
      try {
        const uploaded = await uploadToCloudinary(file);
        image = { url: uploaded.url, publicId: uploaded.publicId };
      } catch (error) {
        const message = String(error.message || 'Image upload failed.');
        if (message === 'network_error') {
          show(
            formError,
            'Network error reaching /api/admin/cloudinary/sign. Confirm you are on https:// and your Vercel domain SSL is active, then retry.'
          );
          return;
        }
        show(formError, message);
        return;
      }
    }

    const payload = {
      name,
      brand,
      price,
      badge,
      short,
      description,
      colors,
      tags,
      specs,
      image,
    };

    const editingId = state.editingId;
    const endpoint = editingId
      ? `/api/admin/products/${encodeURIComponent(editingId)}`
      : '/api/admin/products';
    const method = editingId ? 'PATCH' : 'POST';

    if (submitLabel) submitLabel.disabled = true;
    try {
      await fetchJson(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      form.reset();
      setEditMode({ id: null, refs });
      show(formSuccess, editingId ? 'Product updated.' : 'Product uploaded.');
      await loadProducts();
    } catch (error) {
      show(
        formError,
        editingId
          ? 'Update failed. Check fields and try again.'
          : 'Upload failed. Check fields and image size.'
      );
    } finally {
      if (submitLabel) submitLabel.disabled = false;
    }
  });

  form?.addEventListener('reset', () => {
    show(formError, '');
    show(formSuccess, '');
    setEditMode({ id: null, refs });
  });

  document.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      const id = editButton.getAttribute('data-edit');
      if (!id) return;
      const product = getProductById(id);
      if (!product) {
        show(formError, 'Could not load product details for editing.');
        return;
      }
      fillForm(product);
      setEditMode({ id, refs });
      show(formError, '');
      show(formSuccess, `Editing "${product.name}". Save changes when done.`);
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const deleteButton = event.target.closest('[data-delete]');
    if (!deleteButton) return;
    const id = deleteButton.getAttribute('data-delete');
    if (!id) return;

    const confirmed = window.confirm('Delete this product?');
    if (!confirmed) return;

    try {
      await fetchJson(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (state.editingId === id) {
        form?.reset();
        setEditMode({ id: null, refs });
      }
      await loadProducts();
    } catch (error) {
      show(formError, 'Delete failed.');
    }
  });
};

init();
