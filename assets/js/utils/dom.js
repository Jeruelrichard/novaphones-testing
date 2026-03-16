export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

export const updateCartBadge = (count) => {
  const badge = qs('[data-cart-count]');
  if (!badge) return;
  badge.textContent = count;
};
