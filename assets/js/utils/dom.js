export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

export const updateCartBadge = (count) => {
  qsa('[data-cart-count]').forEach((badge) => {
    badge.textContent = count;
  });
};
