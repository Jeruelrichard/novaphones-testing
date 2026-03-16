import { catalogService } from '../services/catalog.js';
import { cartService } from '../services/cart.js';
import { formatCurrency } from '../utils/format.js';
import { qs, updateCartBadge } from '../utils/dom.js';
import { buildSingleItemMessage } from '../utils/whatsapp.js';

const getQueryId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
};

const renderProduct = (product) => {
  const container = qs('[data-product]');
  if (!container || !product) return;

  container.innerHTML = `
    <div class="product-layout">
      <div class="product-gallery">
        <div class="badge">${product.badge}</div>
        <div class="product-preview" aria-hidden="true">
          <span>${product.brand}</span>
        </div>
      </div>
      <div class="product-summary">
        <h1>${product.name}</h1>
        <p>${product.description}</p>
        <div class="price">${formatCurrency(product.price)}</div>
        <div class="specs">
          ${Object.entries(product.specs)
            .map(
              ([label, value]) => `
              <div class="spec-card">
                <strong>${label}</strong><br />${value}
              </div>
            `
            )
            .join('')}
        </div>
        <div class="cart-meta">Colors: ${product.colors.join(', ')}</div>
        <div class="product-actions">
          <div class="quantity" data-quantity>
            <button type="button" data-qty-action="minus">-</button>
            <input type="number" min="1" value="1" data-qty-input />
            <button type="button" data-qty-action="plus">+</button>
          </div>
          <button class="button secondary" type="button" data-add-to-cart>Add to Cart</button>
          <a class="button primary" href="#" data-buy-now>Buy Now</a>
        </div>
      </div>
    </div>
  `;
};

const renderRelated = (items) => {
  const related = qs('[data-related]');
  if (!related) return;
  if (!items.length) {
    related.innerHTML = '<p class="empty">No related devices yet.</p>';
    return;
  }
  related.innerHTML = items
    .map(
      (item) => `
      <article class="card">
        <div class="card-content">
          <div class="badge">${item.badge}</div>
          <div class="phone-preview" aria-hidden="true"><span>${item.brand}</span></div>
          <h3>${item.name}</h3>
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

const attachActions = (product) => {
  const qtyInput = qs('[data-qty-input]');
  const quantityWrap = qs('[data-quantity]');
  const buyNow = qs('[data-buy-now]');
  const addToCart = qs('[data-add-to-cart]');

  const setBuyNowLink = () => {
    const qty = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1);
    buyNow.href = buildSingleItemMessage(product, qty);
  };

  quantityWrap?.addEventListener('click', (event) => {
    const action = event.target.dataset.qtyAction;
    if (!action) return;
    const current = Number.parseInt(qtyInput.value, 10) || 1;
    const next = action === 'plus' ? current + 1 : Math.max(1, current - 1);
    qtyInput.value = String(next);
    setBuyNowLink();
  });

  qtyInput?.addEventListener('change', () => {
    const next = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1);
    qtyInput.value = String(next);
    setBuyNowLink();
  });

  addToCart?.addEventListener('click', () => {
    const qty = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1);
    cartService.addItem(product.id, qty);
    updateCartBadge(cartService.getCount());
  });

  setBuyNowLink();
};

const init = async () => {
  const id = getQueryId();
  const product = await catalogService.getProductById(id);
  const container = qs('[data-product]');

  if (!product) {
    if (container) {
      container.innerHTML = `
        <div class="empty">
          <p>That product does not exist yet.</p>
          <a class="button primary" href="index.html">Back to catalog</a>
        </div>
      `;
    }
    return;
  }

  renderProduct(product);
  const relatedItems = await catalogService.getRelatedProducts(product, 4);
  renderRelated(relatedItems);
  attachActions(product);
  updateCartBadge(cartService.getCount());
};

init();
