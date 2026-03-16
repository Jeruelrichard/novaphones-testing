import { formatCurrency } from '../utils/format.js';
import { qs } from '../utils/dom.js';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

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

const getCloudinarySignature = async () =>
  fetchJson('/api/admin/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

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
            <button class="button secondary" type="button" data-delete="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
};

const loadProducts = async () => {
  const products = await fetchJson('/api/admin/products');
  renderProducts(products);
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

    try {
      await fetchJson('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      form.reset();
      show(formSuccess, 'Product uploaded.');
      await loadProducts();
    } catch (error) {
      show(formError, 'Upload failed. Check fields and image size.');
    }
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete]');
    if (!button) return;
    const id = button.getAttribute('data-delete');
    if (!id) return;

    const confirmed = window.confirm('Delete this product?');
    if (!confirmed) return;

    try {
      await fetchJson(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await loadProducts();
    } catch (error) {
      show(formError, 'Delete failed.');
    }
  });
};

init();
