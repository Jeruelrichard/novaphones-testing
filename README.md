# NovaPhones Storefront

Smartphone store with a WhatsApp checkout flow, plus an admin panel (server-backed) for managing products.

## Quick setup
- Update `assets/js/config.js` with your WhatsApp number or `wa.link` base URL plus branding.
- Static mode: open `index.html` in a browser (uses `assets/js/data/products.js` as fallback data).
- Server mode (recommended): run `npm run dev`, then open `http://localhost:3000`.

## Admin panel
- Visit `http://localhost:3000/admin` (requires login).
- Configure admin credentials in `server/.env` (see `server/.env.example`).
- `npm run hash-password` helps generate `ADMIN_PASSWORD_SALT` + `ADMIN_PASSWORD_HASH`.

## Vercel deployment (recommended)
- The live site is still static HTML/CSS/JS, but product/admin APIs run as Vercel Serverless Functions in `api/`.
- For persistent products on Vercel, configure Firebase (Firestore) and set these env vars in Vercel:
  - `AUTH_SECRET`, `ADMIN_EMAIL`, plus either `ADMIN_PASSWORD` or `ADMIN_PASSWORD_SALT` + `ADMIN_PASSWORD_HASH`
- For public product images, configure Cloudinary and set these env vars in Vercel:
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- Firestore env vars:
  - `FIREBASE_SERVICE_ACCOUNT_JSON` (or `FIREBASE_SERVICE_ACCOUNT_B64`), `FIRESTORE_PRODUCTS_COLLECTION`
- Admin URL on Vercel is `/admin` (handled by `vercel.json` rewrites).

## Architecture notes
- `assets/js/services` contains data + cart logic that can be swapped for API calls later.
- `assets/js/data/products.js` remains as a fallback catalog when no server is running.
- Cart state is stored in `localStorage`.
