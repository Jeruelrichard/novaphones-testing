import { qs } from '../utils/dom.js';

const getNext = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('next') || '/admin/index.html';
};

const showError = (message) => {
  const error = qs('[data-error]');
  if (!error) return;
  error.hidden = !message;
  error.textContent = message || '';
};

const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'login_failed');
  }
};

const init = async () => {
  const form = qs('[data-admin-login]');
  const emailInput = qs('[data-email]');
  const passwordInput = qs('[data-password]');

  // If already logged in, jump straight to dashboard.
  try {
    const me = await fetch('/api/auth/me');
    if (me.ok) {
      window.location.href = getNext();
      return;
    }
  } catch (error) {
    // Ignore
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';
    if (!email || !password) return;

    try {
      await login(email, password);
      window.location.href = getNext();
    } catch (error) {
      showError('Invalid login details.');
    }
  });
};

init();

