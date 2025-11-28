# Copilot instructions for pakshipper-backend

Purpose: Help AI coding agents be immediately productive in this repository by outlining the architecture, conventions, developer workflows, and integration points.

Quick start
- Setup: copy or create a `.env` file with required keys (see `ENVIRONMENT` section).
- Install: `npm install`
- Dev run: `npm run dev` (nodemon), Production: `npm start`.
- Entry point: `server.js` (ES Modules, `type: module`).

Big picture architecture
- Node + Express API server in `server.js`.
- Routing: `routes/ConnectedRoutes.js` mounts feature routes (e.g., `routes/user-routes.js`, `routes/products-routes.js`).
- Controllers: `controllers/*` (subfolders group domain logic by feature). Each controller exports named functions and accepts `(req, res)`; route files import these.
- Models: MongoDB + Mongoose in `models/*`.
- Caching: Redis client at `config/redis/redisClient.js`; controllers use `client.get`, `client.setEx` and call `client.flushAll()` to invalidate caches on writes (see `controllers/products/products-controller.js`).
- Realtime: Socket.IO configured in `server.js`; server exposes `io` via `app.set('io', io)` (controllers can retrieve with `req.app.get('io')`).
- File uploads:
  - Local: `middlewares/upload.js` (multer disk storage to `assets/`) — route `POST /api/image/upload`
  - Cloudinary: `middlewares/uploadmiddlware.js` (multer memoryStorage + stream to Cloudinary) — route `POST /api/image/upload-singel` or `/upload-multiple`.
- Payments: Stripe integration in `lib/stripe.js` and webhook in `controllers/stripe/stripeController.js`. Note the route `/api/order/webhook/stripe` uses `express.raw()` to validate webhook signatures.
- OAuth & auth:
  - Passport strategies: `OAuth/Google/googleStrategy.js` and `OAuth/LinkedIn/LinkdinStaregy.js` show session-based OAuth with `passport`.
  - JWTs used for token-based API auth; verify tokens with `middlewares/authMiddleWare.js` (header `Authorization: Bearer <token>`).
- Email: Nodemailer service in `services/email-service.js`; templates in `Templates/`.

ENVIRONMENT (common env vars used across repo)
- Required (examples):
  - `MONGO_URL` — MongoDB connection string
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - `SECRET_KEY` — JWT sign/verify secret
  - `SESSION_SECRET` — express-session secret
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and `LINKEDIN_*` if using LinkedIn)
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SERVICE_NAME`
  - `FRONTEND_URL`, `ImageBaseURl`, `AppName`, `CORS_ORIGINS` (comma-separated list)
  - `PORT` (optional)

Key patterns & conventions
- Routes-only files simply import controllers and use `router.method(path, middleware?, controller)`. e.g., `routes/user-routes.js`.
- Controllers: prefer `async` handlers with `try/catch` and always send JSON with `message` and `data`. Use HTTP status codes consistently.
- Use `authMiddleware` to protect endpoints, and `roleMiddleware('admin')` for admin-only routes.
- Cache best-practice: check Redis first (e.g., `client.get(cacheKey)`), return cached result if present; otherwise query DB, set the cache (`client.setEx(cacheKey, ttl, val)`). On write operations call `client.flushAll()` to invalidate caches.
- Use `express.raw()` for Stripe webhook route to ensure signature verification works, do not configure JSON middleware to override raw body for that route.
- Files and uploads: two approaches are supported — local static assets or cloud (Cloudinary). The controllers expect `req.file.filename` (local) or `req.cloudinaryUrl` (Cloudinary).
- Token behavior: tokens are signed with `process.env.SECRET_KEY`. Token expiration is typically 1 hour as used in OAuth strategies.

Developer flows & tips
- Start dev server: `npm run dev` (nodemon auto-restart).
- Run in production: `npm start`.
- Add new route:
  1. Create controller in `controllers/<feature>/*` exporting a named handler.
  2. Create/modify a route file in `routes/` to import handler and attach to router.
  3. Add exported route in `routes/ConnectedRoutes.js`.
- Add new model: place in `models/` and import/`populate()` in controllers to add relationships.
- When integrating Stripe: use `lib/stripe.js#createCheckoutSession` to build sessions. Ensure `metadata` (e.g., `userId` or `orderNo`) is saved in the checkout session so the webhook can find the order and update payment status.
- Webhook testing: Use Stripe CLI to forward events to the dev server. CLI will also construct appropriate signature header; confirm you have `STRIPE_WEBHOOK_SECRET` configured.

Observability & debugging
- Request logging: `morgan('dev')` in `server.js`
- Use console logs for events: Socket.IO prints connect/disconnect messages.
- Common runtime issues:
  - `express.raw()` conflicts with body parser; ensure webhook route is before `express.json()` usage or uses `express.raw({ type: 'application/json' })` explicitly (already implemented in `server.js`).
  - Missing env vars will cause service errors (stripe init, cloudinary config, DB connection). Always verify `.env` before starting server.

Deployment & hosting
- `vercel.json` shows a Node server deployment setup — the server is the single endpoint. If deploying to Vercel, ensure all environment variables are set via Vercel's dashboard and Stripe webhooks target the Vercel server URL.

Testing guidance (manual)
- API testing: Postman/Insomnia against `http://localhost:PORT`.
- OAuth: locally you may need to set callback URLs in your provider (Google/LinkedIn) to `http://localhost:PORT/api/auth/google/callback` (match `googleStrategy.js` or override the callback URL).
- Webhook testing: use Stripe CLI or remote webhook handler.

Files & code pointers (where to look for examples)
- `server.js` — entry, main middleware, Socket.IO, webhook raw body
- `routes/` + `routes/ConnectedRoutes.js` — routing map
- `controllers/products/products-controller.js` — caching + caching invalidation pattern
- `middlewares/upload.js` and `middlewares/uploadmiddlware.js` — local vs Cloudinary uploads
- `lib/stripe.js` & `controllers/stripe/stripeController.js` — Stripe session setup + webhook handling
- `OAuth/*` — passport strategies (Google & LinkedIn examples)
- `services/email-service.js` & `Templates/*.js` — Nodemailer usage & templates

Common tasks for AI agents (practical examples)
- Add a product: create controller using `Product` model; on save call `client.flushAll()` to invalidate product caches; use `client.setEx` for caching if returning list.
- Adding fields: update schema under `models/` and adjust any controllers/queries and `populate()` calls. Add appropriate tests or manual checks.
- Add a route that uses file uploads: prefer `uploadMiddleware(fieldName, isMultiple)` for Cloudinary; for local disk use `upload.single('image')`.

Do NOT assume
- There are no unit tests or CI config; do not add instructions that reference non-existent files. Create tests and CI as a separate task.

If anything in this guide is unclear or you want more details (request/response payloads, schema field references, or diagrams for complex flows), reply with specific areas to expand and I will iterate.