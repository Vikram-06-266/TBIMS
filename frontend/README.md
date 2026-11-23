# TBIMS frontend

The frontend is a React/Vite inventory workspace. In normal mode it reads and
creates products through the Express API; it never substitutes sample data for
an API failure.

## Run locally

1. Start the backend in another terminal:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

2. Start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

3. Open the Vite URL printed in the terminal (normally
   `http://localhost:5173`). The Vite development server proxies `/api` requests
   to `http://localhost:4000`.

The backend listens on port 4000 by default. To use a different backend origin
with the Vite proxy, set `VITE_BACKEND_URL` before starting Vite. To point the
browser directly at an API origin instead, set `VITE_API_BASE_URL`; that origin
must allow browser requests from the frontend.

## Authentication

There are no built-in demo credentials. Normal mode shows the sign-in form and
requires an account configured in `backend/.env` using `AUTH_TOKEN_SECRET` and
`AUTH_USERS`. Generate a password hash locally with
`node backend/scripts/generate-auth-user.js <username> <admin|inventoryManager|staff>`;
the script prompts for the password without echoing it. Never commit `.env` or
share the signing secret or password hash.

The backend returns the authenticated role and enforces route permissions.
The browser keeps the short-lived token in tab-scoped `sessionStorage` and
checks it with `GET /api/auth/me` after a page refresh. Sign out removes the
browser-held session. No account or password is seeded by the frontend.

## Demonstration mode

The default is production/API mode. To explicitly opt in to isolated demo data,
create `frontend/.env.local` with:

```dotenv
VITE_DEMO_MODE=true
```

Restart Vite after changing environment variables. Demo mode displays
**DEMO DATA — NOT CONNECTED TO DATABASE**, does not call the API, and keeps any
added products in frontend memory only. It does not save to PostgreSQL. The
development role selector is available only in Vite development builds and is
not authentication.

To turn demo mode off, remove `VITE_DEMO_MODE` or set it to `false`, then
restart Vite. Demo data is never enabled automatically when the backend fails.

## Validation

```powershell
npm test
npm run lint
npm run build
```

The dashboard only shows live product totals after a successful API response.
Low-stock totals remain unavailable until the product low-stock threshold is
defined by the project.
