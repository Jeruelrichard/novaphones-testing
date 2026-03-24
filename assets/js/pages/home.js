import { catalogService } from '../services/catalog.js';
import { cartService } from '../services/cart.js';
import { formatCurrency } from '../utils/format.js';
import { qs, qsa, updateCartBadge } from '../utils/dom.js';

const state = {
  products: [],
  activeFilter: 'All',
  searchTerm: '',
};

const productsSignature = (products) =>
  products
    .map((item) => `${item.id}:${item.updatedAt || ''}:${item.price}`)
    .join('|');

const renderFilters = () => {
  const filterWrap = qs('[data-filter-chips]');
  if (!filterWrap) return;
  const brands = Array.from(new Set(state.products.map((item) => item.brand)));
  const filters = ['All', ...brands];
  filterWrap.innerHTML = filters
    .map(
      (filter) => `
        <button class="filter-chip ${
          filter === state.activeFilter ? 'active' : ''
        }" data-filter="${filter}">${filter}</button>
      `
    )
    .join('');
};

const attachFilterEvents = () => {
  const filterWrap = qs('[data-filter-chips]');
  if (!filterWrap || filterWrap.dataset.bound === 'true') return;
  filterWrap.dataset.bound = 'true';
  filterWrap.addEventListener('click', (event) => {
    const target = event.target.closest('[data-filter]');
    if (!target) return;
    state.activeFilter = target.dataset.filter;
    renderFilters();
    renderProducts();
  });
};

const renderProducts = () => {
  const grid = qs('[data-product-grid]');
  if (!grid) return;
  const term = state.searchTerm.trim().toLowerCase();
  const filtered = (state.activeFilter === 'All'
    ? state.products
    : state.products.filter((item) => item.brand === state.activeFilter)
  ).filter((item) => {
    if (!term) return true;
    const haystack = [
      item.name,
      item.brand,
      item.short,
      ...(item.tags || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">No phones matched that search.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map(
      (item) => `
        <article class="card">
          <div class="card-content">
            <div class="badge">${item.badge}</div>
            <div class="phone-preview" aria-hidden="true">
              ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" loading="lazy" />` : ''}
              <span>${item.brand}</span>
            </div>
            <h3>${item.name}</h3>
            <p>${item.short}</p>
            <div class="price">${formatCurrency(item.price)}</div>
            <div class="product-actions">
              <a class="button secondary" href="product.html?id=${item.id}">View</a>
              <a class="button primary" href="product.html?id=${item.id}">Buy Now</a>
            </div>
          </div>
        </article>
      `
    )
    .join('');
};

const renderKPIs = () => {
  const total = state.products.length;
  const brands = new Set(state.products.map((item) => item.brand)).size;
  const avgPrice = total
    ? Math.round(state.products.reduce((sum, item) => sum + item.price, 0) / total)
    : 0;
  const totalEl = qs('[data-kpi-total]');
  const brandEl = qs('[data-kpi-brands]');
  const priceEl = qs('[data-kpi-price]');
  if (totalEl) totalEl.textContent = total;
  if (brandEl) brandEl.textContent = brands;
  if (priceEl) priceEl.textContent = formatCurrency(avgPrice);
};

const syncSearchInputs = (value) => {
  qsa('[data-search-input]').forEach((input) => {
    if (input.value !== value) input.value = value;
  });
};

const setSearchTerm = (value) => {
  state.searchTerm = value;
  syncSearchInputs(value);
  renderProducts();
};

const attachSearchEvents = () => {
  qsa('[data-search-form]').forEach((form) => {
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('[data-search-input]');
      if (!input) return;
      setSearchTerm(input.value);
    });
  });

  qsa('[data-search-input]').forEach((input) => {
    if (input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    input.addEventListener('input', () => {
      setSearchTerm(input.value);
    });
  });
};

const init = async () => {
  state.products = catalogService.getQuickProducts();
  const query = new URLSearchParams(window.location.search);
  const search = query.get('q');
  if (search) {
    state.searchTerm = search;
    syncSearchInputs(search);
  }
  renderKPIs();
  renderFilters();
  attachFilterEvents();
  attachSearchEvents();
  renderProducts();
  updateCartBadge(cartService.getCount());

  const before = productsSignature(state.products);
  const freshProducts = await catalogService.getProducts();
  const after = productsSignature(freshProducts);
  if (before !== after) {
    state.products = freshProducts;
    if (
      state.activeFilter !== 'All' &&
      !state.products.some((item) => item.brand === state.activeFilter)
    ) {
      state.activeFilter = 'All';
    }
    renderKPIs();
    renderFilters();
    renderProducts();
  }
};

init();
