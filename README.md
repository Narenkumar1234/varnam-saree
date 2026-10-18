# Varnam Saree Storefront (Next.js)

Responsive luxury Indian saree storefront migrated to **Next.js 15 (App Router)** with TypeScript, React 19, and optimized responsive image loading via `next/image` and `sharp`.

## Features Ported

- **Screens**:
  - Home (`/`): Heritage campaign hero, curated collections, loved products, heritage courtyard story band, brand philosophy.
  - Catalogue / Shop (`/shop`): Database catalogue, collection and colour filters, min–max price slider, sold-out states, 4-way sorting (Featured, Price Low/High, Newest arrivals), progressive reveal with accessible "Load more".
  - Mobile Filter Bottom-Sheet: Native modal drawer with drag grip, live match count, draft selection, and reset/apply actions.
  - Product Details (`/product/[id]`): High-res optimized image, colour swatches, blouse finishing selection, quantity controls, WhatsApp order pre-filled generator, delivery pincode estimator, care guidelines, and recommended sarees.
  - Search (`/search`): Instant search across saree names, weaves, and colours.
  - Wishlist (`/wishlist`): Save favourites with persistent browser storage and one-click removal.
  - Bag & Cart (`/cart`): Stepper controls, finishing notes, WELCOME10 coupon calculations, free delivery on orders above ₹2,999, direct WhatsApp bag ordering, stock validation, and database-priced checkout flow.
  - Demo Checkout (`/checkout`): Contact and delivery form, Indian state and pincode validation, transparent demo order placement.
  - Confirmation (`/confirmation/[id]`): Verified demo order summary and order tracking link.
  - Tracking (`/track`): Order lookup with 3-stage visual progress timeline.
  - Account (`/account`): Local profile storage, order history, addresses, and Google sign-in setup state.
  - Content Pages: Collections (`/collections`), Our Story (`/story`), Varnam Journal (`/journal`, `/journal/[id]`), Contact (`/contact`), FAQ (`/faq`), Shipping & Returns (`/shipping`), Privacy (`/privacy`), Terms (`/terms`).
  - Floating actions: Fixed WhatsApp and Instagram quick actions.

## Image Optimization

- Migrated large uncompressed assets (originally >6.5MB total) to optimized Next.js WebP formats:
  - Hero banner: Compressed and resized from 2.5MB down to ~180KB WebP.
  - Saree sprite: Extracted into standalone, dedicated high-fidelity WebP images for each saree weave (Emerald, Rose, Indigo, Ivory) reducing download burden per card from 3.5MB to ~80-130KB.
  - Brand logo: Optimized PNG/WebP with transparent alpha channels.
  - Powered by Next.js `next/image` with automatic WebP/AVIF generation, responsive `sizes`, lazy loading, and priority loading for above-the-fold banners.

## Development & Server Preparation

- Start development: `npm run dev` (runs on `http://0.0.0.0:3000`)
- Type check: `npm run lint`
- Production build: `npm run build`
- Database, admin-session, order, and payment APIs are included.

## Database setup and catalogue

The shared server reader in `src/lib/catalogue-server.ts` is the source for both the root layout and `/api/products`. The layout passes that catalogue into the storefront provider, so home, shop/search, product details, wishlist, bag, and checkout start with the same server-rendered product data. Browser catalogue requests use `cache: no-store`; the provider refreshes on navigation, window focus, and every 30 seconds while visible. No product catalogue is permanently cached.

A non-empty `products` table is authoritative, including sold-out rows: it is never merged with the sample list. Only an empty or unreachable database uses `fallbackProducts` from `src/data/products.ts`. Fallback stock is unknown. The same rule is used by server-side order pricing. A missing product ID in a non-empty database is unavailable, rather than silently restored from the sample catalogue. Fallback browsing works without a database, but saving an order still requires a working orders table.

Fresh setup (Bun is used for database scripts and tests):

1. Run `bun install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and configure `SQL_HOST`, `SQL_PORT` (default 5432), `SQL_DB_NAME`, `SQL_USER`, and `SQL_PASSWORD`. The password may be blank only if your PostgreSQL instance permits passwordless local authentication. Set `SQL_SSL=true` if your provider requires TLS with a trusted certificate; it defaults to false.
3. Optionally configure `SQL_ADMIN_USER` and `SQL_ADMIN_PASSWORD` for migrations and seeding. Otherwise those scripts use the application SQL identity. The application identity must be able to read/write the store tables, and the setup identity must be able to create tables/sequences/constraints.
4. Run `bun run db:setup` (or `bun run db:migrate` followed by `bun run db:seed`). The committed Drizzle migration creates `products`, `users`, `orders`, and `wishlists`. The baseline leaves existing matching tables/data intact; it does not repair an incompatible pre-existing schema. Check the schema and back up an existing database before adopting the baseline.
5. The seed loads the eight current sample sarees with stable IDs 1–8 and an initial stock of 5 each. It skips existing IDs, preserves Studio edits on reruns, and advances the sequence so a new Studio product receives a fresh ID. Update stock to your actual inventory in Studio.
6. Configure the admin and optional Razorpay variables described below, then run `bun run dev` or `bun run build` and `bun run start`.

For future schema changes, edit `src/db/schema.ts`, run `bun run db:generate`, review and commit the generated SQL/metadata, then apply it with `bun run db:migrate`. SQL connection settings are shared by the application and setup scripts. `PORT`/`HOST` are documented for deployment tooling; the current npm scripts explicitly bind port 3000 and host 0.0.0.0. Next.js manages `NODE_ENV`. Browser Firebase settings remain in `firebase-applet-config.json`; `GOOGLE_APPLICATION_CREDENTIALS` is optional for server Firebase Admin SDK use.

`src/lib/pricing.ts` contains the shared pure coupon/delivery calculations using an explicitly supplied catalogue. `src/lib/order-pricing.ts` reads a fresh server catalogue for every order. Stock zero, missing products, excessive quantities (including duplicate lines), and invalid prices are rejected. Client totals are never trusted; a stale displayed total returns 409 so the customer can review the refreshed price. Saved order snapshots retain their purchase prices, discounts and delivery charge, and Razorpay continues charging that saved order amount even after catalogue edits.

Stock is checked against the current catalogue before ordering, and sold-out products cannot be added, bought directly, or sent as new WhatsApp orders. This change does not reserve/decrement stock automatically or implement inventory reservations across concurrent orders; Studio manages stock quantities. Existing saved-order confirmations remain available on WhatsApp.

Run `bun test` (including `bun run test:catalogue`), `bun run lint`, and `bun run build`. Catalogue tests cover an authenticated Studio price edit reaching the public API and server quote, empty/unreachable fallback, sold-out/duplicate-line limits, coupons, and stale-total rejection.

## Studio admin access

Set both `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` in the server environment before using `/studio-desk`. Login requires an exact match for both values; there are no default credentials or email-only login. If either variable is missing or blank, login returns HTTP 503 with **Admin login is not configured.** The login screen does not display credentials. Studio is accessed directly by URL rather than through the storefront navigation.

Also set `ADMIN_SESSION_SECRET` to an independent, high-entropy random secret (at least 32 random bytes). It is recommended but optional: if absent, the server derives a signing key with HMAC-SHA256 using `ADMIN_LOGIN_PASSWORD`. The existing derivation is domain-separated for Studio sessions and bound to the current password; rotating the password or signing secret invalidates existing sessions. All three variables are server-only; `.env.example` contains blank placeholders. Local environment files are ignored by Git, while `.env.example` remains tracked.

Successful `POST /api/admin/auth` accepts `{ email, password }` and sets the same eight-hour HMAC-SHA256-signed cookie. The cookie contains a version, audience, issue/expiry timestamps and random nonce, with no credentials or customer data. It is `HttpOnly`, `SameSite=Strict`, scoped to `/api/admin`, and `Secure` in production (HTTPS is required). Sessions are stateless: each admin handler verifies the signature and expiry on the server before reading request bodies or touching the database/filesystem. Browser storage flags are not used for authorization. Cross-origin admin mutations are rejected, and admin list/session responses are not cached.

Every product, upload, and order handler under `/api/admin` uses the shared session guard. Studio loads orders from the protected `/api/admin/orders` endpoint; the legacy unfiltered `/api/orders` list also requires an admin session. Existing customer email-based order lookups are unchanged. `GET /api/admin/auth` restores a valid session after a refresh; `DELETE /api/admin/auth` expires the cookie on sign-out. Studio sends same-origin credentials on all admin requests and returns to login when an API reports an expired session. Logging out clears this browser's cookie; signing-key rotation invalidates all issued cookies.

Run `bun run test:admin` for login, cookie, expiry, tampering, route coverage, and logout checks. A request without a cookie, for example `curl -i http://localhost:3000/api/admin/products`, must return **401 Unauthorized**. Login/logout and session restoration can be exercised locally over HTTP in development; production cookies require HTTPS.

## Studio Razorpay payments

In `/studio-desk`, open **Customer Orders** and choose **Pay with Razorpay** on a saved order. The existing order API creates the customer order and calculates its price, coupon discount, and delivery charge on the server. The payment endpoint creates a Razorpay order from that saved total, in INR paise; it does not accept a browser-supplied amount. **Confirm on WhatsApp** and inventory WhatsApp ordering remain available.

Set these environment variables on the server and restart/redeploy:

- `RAZORPAY_KEY_ID`: dashboard key ID.
- `RAZORPAY_KEY_SECRET`: matching server-only API secret.
- `RAZORPAY_WEBHOOK_SECRET`: separate secret you choose when configuring the webhook below.

Blank entries are provided in `.env.example`. No `NEXT_PUBLIC_RAZORPAY_KEY_ID` is needed: the order endpoint returns only the public key ID to Checkout. Do not put API secrets in client code or commit configured environment files. Existing PostgreSQL configuration is still required.

Enable automatic payment capture in Razorpay. Configure a webhook for **payment.captured** at `https://YOUR_DOMAIN/api/payments/razorpay/webhook`, using the matching webhook secret. Configure Test and Live modes separately, with their respective keys and webhooks.

`POST /api/payments/razorpay/order` accepts `{ orderId }` for a saved customer order. Pending Razorpay orders are reused under a database row lock. `POST /api/payments/razorpay/verify` accepts the local `orderId` plus Checkout's `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The server verifies HMAC against its stored Razorpay order ID, then fetches the payment to check the order, amount, INR currency, and captured state. Only then is the payment marked paid. Authorized payments wait for capture; signed webhooks finish confirmation if the browser closes. Duplicate callbacks/webhooks are safe. A payment captured after an order is cancelled is still recorded for reconciliation; cancellation does not automatically refund it.

Payment state and references are stored alongside the existing price snapshot in `orders.itemsJson`, so no schema migration is required. Fulfilment status remains separate. Verification receipts are cached in session storage for retries; no card details or API secrets are stored there. If online payments are unconfigured, unavailable, or cancelled, customers can continue using WhatsApp. If debited but confirmation is pending, use **Retry payment verification** or contact Varnam before paying again.

Before accepting real payments, test a successful payment, Checkout dismissal/failure, verification retry, a late capture via webhook, and duplicate webhook delivery using your Razorpay Test-mode account. Run `bun run test:payments`, `bun run lint`, and `bun run build`. Test-mode and live transactions require configured keys and a reachable database/webhook.

Official references: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

