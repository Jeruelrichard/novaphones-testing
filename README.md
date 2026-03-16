# NovaPhones Storefront

Static, frontend-only smartphone store with a WhatsApp checkout flow.

## Quick setup
- Update `assets/js/config.js` with your WhatsApp number or `wa.link` base URL plus branding.
- Open `index.html` in a browser to start browsing.

## Architecture notes
- `assets/js/services` contains data + cart logic that can be swapped for API calls later.
- `assets/js/data/products.js` is a placeholder catalog until a backend exists.
- Cart state is stored in `localStorage`.
