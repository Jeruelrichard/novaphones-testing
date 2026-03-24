import { catalogService } from '../services/catalog.js';
import { qsa } from './dom.js';

const MAX_SUGGESTIONS = 6;

const state = {
  products: [],
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const scoreProduct = (product, term) => {
  const name = normalize(product.name);
  const brand = normalize(product.brand);
  const short = normalize(product.short);
  const tags = Array.isArray(product.tags)
    ? product.tags.map((tag) => normalize(tag)).join(' ')
    : '';

  if (name.startsWith(term)) return 400;
  if (name.includes(term)) return 300;
  if (brand.startsWith(term)) return 220;
  if (brand.includes(term)) return 180;
  if (tags.includes(term)) return 140;
  if (short.includes(term)) return 100;
  return 0;
};

const getSuggestions = (term) => {
  if (!term) return [];
  return state.products
    .map((product) => ({ product, score: scoreProduct(product, term) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.product);
};

const productUrl = (product) => `product.html?id=${encodeURIComponent(product.id)}`;

const navigateToProduct = (product) => {
  if (!product) return;
  window.location.href = productUrl(product);
};

const renderSuggestions = (menu, suggestions, activeIndex) => {
  if (!suggestions.length) {
    menu.parentElement?.classList.remove('search--open');
    menu.hidden = true;
    menu.innerHTML = '';
    return;
  }

  menu.parentElement?.classList.add('search--open');
  menu.hidden = false;
  menu.innerHTML = suggestions
    .map((product, index) => {
      const active = index === activeIndex ? ' active' : '';
      return `
        <button
          type="button"
          class="search-suggestion${active}"
          role="option"
          aria-selected="${index === activeIndex ? 'true' : 'false'}"
          data-suggestion-index="${index}"
        >
          <span class="search-suggestion-title">${product.name}</span>
          <span class="search-suggestion-meta">${product.brand}</span>
        </button>
      `;
    })
    .join('');
};

const attachAutocomplete = (form) => {
  if (form.dataset.autocompleteBound === 'true') return;
  form.dataset.autocompleteBound = 'true';

  const input = form.querySelector('[data-search-input]');
  if (!input) return;

  form.classList.add('search--autocomplete');
  input.setAttribute('autocomplete', 'off');

  const menu = document.createElement('div');
  menu.className = 'search-suggestions';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  form.appendChild(menu);

  let activeIndex = -1;
  let suggestions = [];

  const closeMenu = () => {
    activeIndex = -1;
    suggestions = [];
    renderSuggestions(menu, suggestions, activeIndex);
  };

  const openSuggestions = () => {
    const term = normalize(input.value);
    suggestions = getSuggestions(term);
    activeIndex = -1;
    renderSuggestions(menu, suggestions, activeIndex);
  };

  input.addEventListener('input', () => {
    openSuggestions();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) openSuggestions();
  });

  input.addEventListener('keydown', (event) => {
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % suggestions.length;
      renderSuggestions(menu, suggestions, activeIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
      renderSuggestions(menu, suggestions, activeIndex);
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      navigateToProduct(suggestions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  form.addEventListener('submit', (event) => {
    if (activeIndex < 0 || !suggestions[activeIndex]) return;
    event.preventDefault();
    navigateToProduct(suggestions[activeIndex]);
  });

  menu.addEventListener('mousedown', (event) => {
    const button = event.target.closest('[data-suggestion-index]');
    if (!button) return;
    event.preventDefault();
    const index = Number.parseInt(button.dataset.suggestionIndex, 10);
    if (Number.isNaN(index)) return;
    navigateToProduct(suggestions[index]);
  });

  menu.addEventListener('mousemove', (event) => {
    const button = event.target.closest('[data-suggestion-index]');
    if (!button) return;
    const index = Number.parseInt(button.dataset.suggestionIndex, 10);
    if (Number.isNaN(index) || index === activeIndex) return;
    activeIndex = index;
    renderSuggestions(menu, suggestions, activeIndex);
  });

  input.addEventListener('blur', () => {
    window.setTimeout(closeMenu, 120);
  });
};

export const initNavSearch = async () => {
  const forms = qsa('[data-search-form]');
  if (!forms.length) return;

  state.products = catalogService.getQuickProducts();
  forms.forEach(attachAutocomplete);

  const freshProducts = await catalogService.getProducts();
  state.products = freshProducts;
};
