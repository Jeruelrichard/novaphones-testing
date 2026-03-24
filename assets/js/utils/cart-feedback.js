import { qs } from './dom.js';

const MODAL_ID = 'cart-feedback-modal';

const ensureModal = () => {
  let modal = qs(`#${MODAL_ID}`);
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'cart-modal-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title">
      <div class="cart-modal-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12.5 9.5 17 19 7.5"></path>
        </svg>
      </div>
      <h3 id="cart-modal-title">Product added to cart successfully!</h3>
      <div class="cart-modal-actions">
        <button class="button secondary" type="button" data-cart-modal-close>Continue Shopping</button>
        <a class="button primary" href="cart.html">Proceed to Cart</a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (
      event.target === modal ||
      event.target.closest('[data-cart-modal-close]')
    ) {
      modal.hidden = true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modal.hidden = true;
    }
  });

  return modal;
};

export const showCartFeedback = () => {
  const modal = ensureModal();
  modal.hidden = false;
};
