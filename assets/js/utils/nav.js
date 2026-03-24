import { qs, qsa } from './dom.js';

const closeNavSearch = (nav) => {
  if (!nav) return;
  nav.classList.remove('nav--search-open');
};

export const initMobileNav = () => {
  const nav = qs('.nav');
  if (!nav || nav.dataset.mobileNavBound === 'true') return;
  nav.dataset.mobileNavBound = 'true';

  const searchToggle = qs('[data-search-toggle]', nav);
  const searchForm = qs('.nav-search', nav);
  const searchInput = qs('input[type="search"]', searchForm || nav);

  searchToggle?.addEventListener('click', () => {
    const opening = !nav.classList.contains('nav--search-open');
    nav.classList.toggle('nav--search-open');
    if (opening) {
      window.setTimeout(() => searchInput?.focus(), 30);
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) {
      closeNavSearch(nav);
    }
  });

  qsa('a, button', nav).forEach((node) => {
    if (node.hasAttribute('data-search-toggle')) return;
    node.addEventListener('click', () => {
      if (window.innerWidth <= 640) {
        closeNavSearch(nav);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNavSearch(nav);
    }
  });
};
