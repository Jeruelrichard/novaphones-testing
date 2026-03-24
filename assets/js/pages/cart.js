import { cartService } from '../services/cart.js';
import { formatCurrency } from '../utils/format.js';
import { qs, updateCartBadge } from '../utils/dom.js';
import { initMobileNav } from '../utils/nav.js';
import { buildWhatsAppLink } from '../utils/whatsapp.js';

const DELIVERY_FEE = 0;

const colorOptions = (item) => {
  const colors = Array.isArray(item.colors) && item.colors.length
    ? item.colors
    : [item.selectedColor || 'Standard'];

  return colors
    .map((color) => {
      const selected =
        String(color).toLowerCase() === String(item.selectedColor || '').toLowerCase();
      return `<option value="${color}" ${selected ? 'selected' : ''}>${color}</option>`;
    })
    .join('');
};

const renderCart = async () => {
  const { items, subtotal } = await cartService.getDetailedItems();
  const list = qs('[data-cart-items]');
  const summary = qs('[data-cart-summary]');
  const checkout = qs('[data-checkout]');

  if (!items.length) {
    if (list) {
      list.innerHTML = `
        <div class="empty">
          <p>Your cart is empty.</p>
          <a class="button primary" href="index.html">Start shopping</a>
        </div>
      `;
    }
    if (summary) summary.innerHTML = '';
    if (checkout) checkout.setAttribute('href', '#');
    updateCartBadge(0);
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <div class="cart-item" data-cart-item="${item.id}">
        <div>
          <h3>${item.name}</h3>
          <div class="cart-meta">
            <span>${item.brand}</span>
            <span>${item.specs.display}</span>
            <span>Color: ${item.selectedColor}</span>
            <span>${formatCurrency(item.price)}</span>
          </div>
          <div class="product-actions">
            <div class="quantity" data-quantity>
              <button type="button" data-qty-action="minus">-</button>
              <input type="number" min="1" value="${item.qty}" data-qty-input />
              <button type="button" data-qty-action="plus">+</button>
            </div>
            <label class="cart-color-select">
              <span>Color</span>
              <select data-color-select>
                ${colorOptions(item)}
              </select>
            </label>
            <button class="button secondary" type="button" data-remove>Remove</button>
          </div>
        </div>
        <div class="price">${formatCurrency(item.lineTotal)}</div>
      </div>
    `
    )
    .join('');

  const total = subtotal + DELIVERY_FEE;
  summary.innerHTML = `
    <div>Subtotal <span>${formatCurrency(subtotal)}</span></div>
    <div>Delivery <span>${DELIVERY_FEE ? formatCurrency(DELIVERY_FEE) : 'Quoted in DM'}</span></div>
    <div class="total">Total <span>${formatCurrency(total)}</span></div>
  `;

  checkout.href = buildWhatsAppLink({ items, total, source: 'Cart' });
  updateCartBadge(cartService.getCount());

  list.querySelectorAll('[data-cart-item]').forEach((row) => {
    const id = row.dataset.cartItem;
    const qtyInput = row.querySelector('[data-qty-input]');
    const qtyWrap = row.querySelector('[data-quantity]');
    const removeBtn = row.querySelector('[data-remove]');
    const colorSelect = row.querySelector('[data-color-select]');

    const updateItem = (nextQty) => {
      cartService.updateItem(id, nextQty);
      renderCart();
    };

    qtyWrap.addEventListener('click', (event) => {
      const action = event.target.dataset.qtyAction;
      if (!action) return;
      const current = Number.parseInt(qtyInput.value, 10) || 1;
      const next = action === 'plus' ? current + 1 : Math.max(1, current - 1);
      updateItem(next);
    });

    qtyInput.addEventListener('change', () => {
      const next = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1);
      updateItem(next);
    });

    colorSelect?.addEventListener('change', () => {
      cartService.setItemColor(id, colorSelect.value);
      renderCart();
    });

    removeBtn.addEventListener('click', () => {
      cartService.removeItem(id);
      renderCart();
    });
  });
};

initMobileNav();
renderCart();
