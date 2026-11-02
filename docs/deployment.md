# Deployment preparation — not deployed

Same-origin build: `npm ci`, `npm run build`, then `npm start`. Express serves Vite assets and `/api` on the platform's `PORT`. Set production DATABASE_URL, NODE_ENV=production and DEMO_GST_PERCENT=18; session/origin configuration will be added in milestone 4. Never put database secrets in frontend assets. Run migrations explicitly using maintenance credentials, not the runtime account; run synthetic seed separately once.

No services purchased or deployed. Do not expose state-changing endpoints until authentication/authorization is implemented and tested. Production runtime DB credentials must be non-owner and receive only necessary privileges; local postgres administrator credentials are development-only. Provisioning runtime privileges is still pending before public deployment.

Hosting remains environment-configurable; no paid hosting requirement. Render free web services sleep after 15 idle minutes and free PostgreSQL expires after 30 days. A free deployment must document cold starts, database creation/expiry dates and a restore/migration plan covering the actual evaluation period; it cannot be called indefinitely available. See https://render.com/docs/free. Select a host/account only at deployment time with the owner; no automatic purchases or keep-alive workarounds.

Deployment verification pending: HTTPS session cookie and logout, login-to-persisted-quote browser flow, reload after API restart, selected rate references in DB, missing-rate failure and readiness. Current local smoke checks verify only built HTML/JS and API/database readiness, not a quotation workflow.
