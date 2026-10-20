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
  - Account (`/account`): Verified Google sign-in, protected order history, and browser-saved addresses.
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

A non-empty `products` table is authoritative, including sold-out rows: it is never merged with the sample list. Only an empty or unreachable database uses `fallbackProducts` from `src/data/products.ts`. Fallback stock is unknown, so each product is limited to 10 pieces per order in product, bag, checkout, and server pricing. Known stock continues to use its actual available quantity. The same rule is used by server-side order pricing. A missing product ID in a non-empty database is unavailable, rather than silently restored from the sample catalogue. Fallback browsing works without a database, but saving an order still requires a working orders table.

Fresh setup (Bun is used for database scripts and tests):

1. Run `bun install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and configure `SQL_HOST`, `SQL_PORT` (default 5432), `SQL_DB_NAME`, `SQL_USER`, and `SQL_PASSWORD`. The password may be blank only if your PostgreSQL instance permits passwordless local authentication. Set `SQL_SSL=true` if your provider requires TLS with a trusted certificate; it defaults to false.
3. Optionally configure `SQL_ADMIN_USER` and `SQL_ADMIN_PASSWORD` for migrations and seeding. Otherwise those scripts use the application SQL identity. The application identity must be able to read/write the store tables, and the setup identity must be able to create tables/sequences/constraints.
4. Run `bun run db:setup` (or `bun run db:migrate` followed by `bun run db:seed`). The committed Drizzle migrations create `products`, `users`, `orders`, `wishlists`, `coupons`, `site_settings`, and `customer_addresses`, and add optional `users.phone` plus order shipping snapshot columns. The baseline leaves existing matching tables/data intact; it does not repair an incompatible pre-existing schema. Check the schema and back up an existing database before adopting the baseline.
5. The seed loads the eight current sample sarees with stable IDs 1–8 and an initial stock of 5 each. It skips existing IDs, preserves Studio edits on reruns, and advances the sequence so a new Studio product receives a fresh ID. Update stock to your actual inventory in Studio.
6. Configure the admin and optional Razorpay variables described below, then run `bun run dev` or `bun run build` and `bun run start`.

For future schema changes, edit `src/db/schema.ts`, run `bun run db:generate`, review and commit the generated SQL/metadata, then apply it with `bun run db:migrate`. SQL connection settings are shared by the application and setup scripts. `PORT`/`HOST` are documented for deployment tooling; the current npm scripts explicitly bind port 3000 and host 0.0.0.0. Next.js manages `NODE_ENV`. Browser Firebase settings come from the four `NEXT_PUBLIC_FIREBASE_*` build variables below; Customer account sync/history require the Firebase Admin credentials described below; guest browsing and checkout do not.

`src/lib/pricing.ts` contains the shared pure coupon/delivery calculations using an explicitly supplied catalogue. `src/lib/order-pricing.ts` reads a fresh server catalogue for every order. Stock zero, missing products, excessive quantities (including duplicate lines), and invalid prices are rejected. Client totals are never trusted; a stale displayed total returns 409 so the customer can review the refreshed price. Saved order snapshots retain their purchase prices, discounts and delivery charge, and Razorpay continues charging that saved order amount even after catalogue edits.

Stock is checked against the current catalogue before ordering, and sold-out products cannot be added, bought directly, or sent as new WhatsApp orders. This change does not reserve/decrement stock automatically or implement inventory reservations across concurrent orders; Studio manages stock quantities. Existing saved-order confirmations remain available on WhatsApp.

Run `bun test` (including `bun run test:catalogue`), `bun run lint`, and `bun run build`. Catalogue tests cover an authenticated Studio price edit reaching the public API and server quote, empty/unreachable fallback, sold-out/duplicate-line limits, coupons, and stale-total rejection.

## Product metadata and crawler URLs

Set optional `SITE_URL` to the public HTTPS origin of the deployed store. It supplies `metadataBase`, canonical product URLs, and the absolute URLs in `/robots.txt` and `/sitemap.xml`. Blank, malformed, or non-HTTP(S) values safely use `http://localhost:3000`. `.env.example` keeps the value blank; no credentials are needed. Restart/redeploy after changing it.

Each product page exports server-side `generateMetadata` using the same database catalogue/fallback as the storefront: product name + Varnam, product description (or a generated description), and the product image for OpenGraph and Twitter sharing. Interactive product controls remain in `src/components/ProductDetail.tsx`. Missing products are marked noindex. The dynamic sitemap includes public content pages, journal articles, and current product URLs; an empty/unreachable database uses the fallback catalogue. Transactional, account, tracking, and Studio routes are omitted from the sitemap and disallowed in robots. Admin authentication continues to protect admin data.

Tracking distinguishes confirmed 404 responses from connection/server/malformed-response failures, offers a retry, and cancels superseded lookups so an old response cannot replace the current result. Repeating Find order also retries the same number. Delivery copy comes from `deliveryPolicyText`; `DeliveryPolicy` defaults to a full sentence and accepts `embedded` for lowercase text with no final punctuation. The shipping page uses that mode inside its sentence.

## Customer Google sign-in: Vercel production setup

The committed `firebase-applet-config.json` is now a blank reference template and is not loaded by the app. The previous generic project's public configuration must not silently select customer authentication for the store. Set the owner's Firebase web-app settings explicitly; no real values belong in this repository.

1. In **Firebase Console → Project settings (gear) → General → Your apps → Web app → SDK setup and configuration**, copy the app's configuration into Vercel **Project → Settings → Environment Variables**:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   Use the same web app/project for all four. The default auth domain is `<your-project-id>.firebaseapp.com`. Do not replace it with the Vercel website hostname: Vercel does not serve Firebase's `/__/auth/` helpers unless you separately configure a Firebase-supported hosting/proxy arrangement.
2. In Vercel, set the server-only service-account fields `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Obtain these from the same Firebase project's **Project settings → Service accounts → Firebase Admin SDK**. The server project ID must equal the public project ID. The service account needs Firebase Authentication user-read permission for revocation/disabled-user checks. Paste the complete PEM into the private-key variable; real line breaks, literal `\\n`, double-escaped newlines, CRLF and surrounding quotes are normalized before `cert(...)`. None of these fields may use a `NEXT_PUBLIC_` prefix.
3. Alternatively, configure `GOOGLE_APPLICATION_CREDENTIALS` as the absolute path of a securely mounted service-account JSON file that actually exists on the server. Keep this blank when using the three fields above. A path on your laptop will not exist inside a Vercel function. File-based initialization verifies the public project as its explicit audience/issuer; an optional `FIREBASE_PROJECT_ID` must still match.
4. In **Firebase Console → Build → Authentication → Sign-in method → Google**, enable Google and choose the required project support email. Save. In **Authentication → Settings → Authorized domains → Add domain**, add the exact hostname:
   - `varnam-saree-git-main-narenkumar1234s-projects.vercel.app`
   - Also add each actual production/custom hostname and any preview hostname used for testing, without `https://`, paths or wildcards. Add `localhost` separately if you use it for development.
5. If Google reports an OAuth redirect error, check **Google Cloud Console → APIs & Services → Credentials → the Firebase project's Web OAuth 2.0 client → Authorized redirect URIs**. It must allow `https://<configured-auth-domain>/__/auth/handler`. If the OAuth consent screen is in Testing mode, the test account must be allowed under **Google Auth Platform → Audience → Test users**. If the web API key has referrer/API restrictions, permit the deployed hostnames and the Firebase Authentication APIs (`identitytoolkit.googleapis.com` and `securetoken.googleapis.com`).
6. Apply environment variables to **Production and Preview** as appropriate for the branch URL above. **Redeploy** after changing any public value: Next.js embeds `NEXT_PUBLIC_*` at build time. Server credentials and public app values must be from the same project in each deployment scope. Existing `SQL_*` settings and migrated `users`/`orders` tables are also required for account sync and history.

All entries in `.env.example` are blank placeholders. No client/server keys or credentials were invented. Missing client settings leave guest browsing, bag, wishlist, addresses and checkout available; only customer sign-in is unavailable. Missing credentials, project mismatch, invalid credentials, auth emulators and verification failures all fail closed. Do not configure `FIREBASE_AUTH_EMULATOR_HOST` in a deployment.

### Login, reload, signed-in account, and logout

Google is the only customer login method. A popup is opened directly from the user's click, without an awaited network preflight or persistence operation that would lose the browser gesture. We keep popup login on Vercel instead of silently switching to redirect login: cross-origin redirect restoration can fail in browsers that block third-party storage. Blocked/closed popups have distinct messages; allow popups for the website or open an in-app browser link in a normal browser. See [Firebase's redirect best practices, option 2](https://firebase.google.com/docs/auth/web/redirect-best-practices).

The Firebase client initializes local IndexedDB/localStorage persistence, with tab-session persistence as a fallback. On reload, its token observer waits for the SDK to restore the user, then re-verifies identity on the server. No stored Varnam profile grants access. The account page shows a restoration/verification status during that step rather than an incorrect sign-in panel. Persistence still depends on the browser allowing site storage.

Both the popup's returned user and observer updates enter one shared account controller. An in-flight verification is deduplicated. The browser sends the **Firebase ID token** from `user.getIdToken()`, not a Google OAuth access token, as `Authorization: Bearer <token>`. `POST /api/auth/sync` runs on the Node.js runtime, calls Firebase Admin `verifyIdToken(token, true)`, and upserts only verified UID/email/name claims. The SDK verifies signature, project, issuer, expiry, revocation and disabled-user state; only a verified-email Google identity is accepted. Posted UID/email/name never authenticate a caller.

After successful sync, `/account` replaces the sign-in panel with the verified user's name/email, order history, addresses/wishlist links, and Sign out. A history storage/network error stays inside the verified account view with an error and retry. A 401/403 clears account data and prompts sign-in. Signing out calls Firebase sign-out, clears visible profile/orders immediately and invalidates pending requests. Account switches and superseded responses cannot restore another user's history.

History uses bearer-protected `GET /api/orders`, scoped to the verified Google email, including earlier guest purchases for that email. A legacy `?email=` cannot select another account. Responses are private/no-store. Guest checkout submits contact/delivery fields and no UID; individual order-number confirmation/tracking and Studio's independent signed admin session remain available.

### Safe diagnostic messages and checks

The first generic message could originate in the popup catch. The later diagnostic is more specific: Google reached `POST /api/auth/sync`, which returned HTTP 500 with an HTML/DOCTYPE body, and the old client's unguarded JSON parsing obscured that server failure with “Unexpected token <”. The owner has already checked authorized domains; adding domains again is not the priority for that capture. The old route imported server dependencies before its `try`. It now loads verification/SDK/database dependencies inside the request boundary and returns structured JSON even for cold-start import/initialization exceptions. The route explicitly uses the Node.js runtime.

The client safely handles non-JSON/HTML responses from this endpoint or the hosting platform without rendering response text or parser exceptions. Logs contain only a stage, public failure code, and an allowlisted SDK/Node/PostgreSQL reason code. They never contain an error's raw message, stack, token, private key, email or connection string.

An ordinary malformed PEM or missing Firebase credential should already have been caught as JSON 503 by the previous lazy initializer; the HTML 500 alone does not prove it was the private key. Check the Vercel function's new safe stage/reason log before attributing it. The likely credential configuration to check is the complete server trio `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, from one service account, with the project matching `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Leave `GOOGLE_APPLICATION_CREDENTIALS` blank unless that JSON file actually exists in the function. If the stage is account storage, also check existing `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_SSL` and migrations. The previous committed web project's domain/project were internally consistent, but source cannot establish its ownership or the deployment's secret values.

Server responses include stable public codes for missing configuration (`CUSTOMER_AUTH_NOT_CONFIGURED`, 503), browser/server project mismatch (503), invalid/insufficient credentials (503), rejected/expired/revoked tokens (401), unavailable Google verification (503), and unavailable account storage (503). The UI uses allowlisted messages and never renders raw SDK/provider error strings, tokens, credentials or HTML error pages. “Retry verification” appears only when a Firebase user exists; an unsuccessful popup with no user requires another Google sign-in attempt.

Run `bun run test:auth`, `bun run test:auth:cold-start`, `bun test`, `bun run build`, `bun run test:auth:http`, and `bun run lint --incremental false`. GitHub Actions runs locked installation, all tests, production build and the separate type check without production secrets. Production Next/Node HTTP smoke checks prove that fake identities are rejected with JSON 401, missing credentials return JSON 503, and guest catalogue/checkout remain available. Fresh-process import-failure probes also prove JSON 503 on verification/database cold-start errors with redacted logs. SDK/database doubles cover token verification/rejection, project mismatch, PEM newline parsing, popup/network/error mapping, signed-in/signed-out account markup, reload restoration, logout, stale requests and unchanged guest checkout. Real Google OAuth still requires the owner settings above.

An unauthenticated `POST /api/auth/sync` with a fake UID/email must return 401, as must `GET /api/orders?email=someone@example.test` without a token. A bearer request without configured verification credentials must return 503, never a trusted profile.

Official references: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), and [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## Saved addresses and mobile controls

Signed-in customers store delivery addresses in Postgres (`customer_addresses`), not in the browser. `GET`/`POST /api/addresses` and `PATCH`/`DELETE /api/addresses/[id]` require a verified Firebase Google ID token and only return or change that user's rows. The first address becomes the default; later defaults unset the previous one (also enforced with a partial unique index). `/addresses` lists, edits, deletes, and sets a default. Checkout preselects the default, lets the customer pick another saved address, and can save a new one with **Save this address to my account**. Guests still enter an address that is stored only on the order snapshot.

Orders keep the original `customer_name` / `phone` / `address` / `city` / `state` / `pincode` columns and add a shipping snapshot (`shipping_full_name`, `shipping_phone`, `shipping_line1`, `shipping_line2`, `shipping_landmark`, `shipping_city`, `shipping_state`, `shipping_pincode`) so older rows stay readable. The server rejects checkout unless the mobile number is a 10-digit Indian number (it accepts `+91` / `91` / a leading `0`) and the pincode is 6 digits. `users.phone` is optional and is updated from a saved address or a signed-in order.

A one-time migration copies a previous `varnam-address` localStorage record into the account on first signed-in load of checkout or `/addresses`, then clears it. Guest checkout can still prefill from leftover browser storage. After pulling this change, run `bun run db:migrate` to apply `0004_customer_addresses`.

At the mobile breakpoint (850px), the navigation drawer is a labelled modal dialog. Focus stays inside it until a link, Close menu or Escape closes it; background content is inert, and focus returns to the toggle. Desktop navigation keeps its normal navigation semantics. The mobile benefits strip wraps all four items with 13px text. Price sliders expose labelled, associated visible outputs and current currency values as they move.

## Owner-managed commercial settings

After pulling this change, run `bun run db:migrate` and `bun run db:seed` (or `bun run db:setup`) with the existing SQL environment variables. No new environment variables are required. The second migration adds `coupons` (unique code, integer discount percentage, active flag, minimum subtotal, inclusive UTC expiry date) and `site_settings` (text key/value rows). The seed adds OFFER50 and WELCOME10 once and fills missing settings without overwriting owner edits. Repeat setup preserves disabled coupons, renamed/deleted codes, and deliberately deleting every coupon.

Sign in at `/studio-desk` and open **Coupons** to create, edit, activate/deactivate, or delete codes. Codes are normalized to uppercase and require 2–40 letters, numbers, underscores or hyphens. Discounts are whole percentages from 1 to 100. Minimum spend uses the product subtotal **before discounts and delivery**. Expiry dates remain valid through the selected date in UTC. Checkout reads fresh coupons on the server and rejects inactive, expired, below-minimum, and deleted codes with a clear error. Customers can remove a previously applied code if it becomes unavailable.

**Site settings** manages these keys:

| Key | Default | Meaning |
| --- | --- | --- |
| `marqueeMessage1` | Dispatch time 2 to 5 business days | First scrolling message |
| `marqueeMessage2` | Free delivery on orders above {freeDeliveryThreshold} | Second scrolling message; keep the token so the amount stays accurate |
| `freeDeliveryThreshold` | 2999 | Delivery is free when the subtotal before discounts is strictly above this rupee amount |
| `standardShippingFee` | 150 | Rupee delivery charge for other non-empty orders |

Set either delivery amount to zero for free delivery on all orders. The marquee token expands to the threshold with the ₹ sign and Indian number formatting. Home, product details, shipping policy, cart, and checkout display the same delivery policy used by the shared pricing function. The Offers badge also follows currently active, unexpired coupons instead of promising a fixed discount. Empty bags have no delivery charge. Existing order/payment snapshots keep their original discounts and delivery charges.

The root layout and no-store `/api/commerce` share `src/lib/commerce-server.ts`. The browser refreshes commercial data with the product catalogue on navigation, focus, and every 30 seconds while visible. Orders always re-read the database; a changed total requires customer review. Empty/unconfigured or unreachable commercial storage uses the existing two coupons and current delivery/marquee defaults so browsing remains usable. Settings fall back per missing/invalid key. A private `couponsInitialized` key distinguishes an unconfigured coupon table from an intentionally empty one; a reachable configured store with no coupons offers no discounts. An outage uses fallback commercial values, including fallback coupons. Admin APIs return a clear error on storage failure and never claim a failed write succeeded.

New `/api/admin/coupons`, `/api/admin/coupons/[id]`, and `/api/admin/settings` handlers require the existing signed session and reject cross-origin mutations. All unauthorized calls return 401 before database access. No signing, login, WhatsApp number, Razorpay credential, or payment-verification behavior is changed.

Shop collection/colour filter labels and price bounds come from live products. Studio's collection field accepts a new name and suggests existing names. New collections appear after the next storefront refresh; removed collections are not kept as empty hardcoded filters.

Run `bun run test:commerce` for coupon CRUD, disabling/expiry/minimum checks, delivery-threshold changes, stale-total rejection, defaults, intentional empty-coupon handling, and admin protection. `bun test` also runs the catalogue, payment, and existing admin-session regressions.

## Studio admin access

Set both `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` in the server environment before using `/studio-desk`. Login requires an exact match for both values; there are no default credentials or email-only login. If either variable is missing or blank, login returns HTTP 503 with **Admin login is not configured.** The login screen does not display credentials. Studio is accessed directly by URL rather than through the storefront navigation.

Also set `ADMIN_SESSION_SECRET` to an independent, high-entropy random secret (at least 32 random bytes). It is recommended but optional: if absent, the server derives a signing key with HMAC-SHA256 using `ADMIN_LOGIN_PASSWORD`. The existing derivation is domain-separated for Studio sessions and bound to the current password; rotating the password or signing secret invalidates existing sessions. All three variables are server-only; `.env.example` contains blank placeholders. Local environment files are ignored by Git, while `.env.example` remains tracked.

Successful `POST /api/admin/auth` accepts `{ email, password }` and sets the same eight-hour HMAC-SHA256-signed cookie. The cookie contains a version, audience, issue/expiry timestamps and random nonce, with no credentials or customer data. It is `HttpOnly`, `SameSite=Strict`, scoped to `/api/admin`, and `Secure` in production (HTTPS is required). Sessions are stateless: each admin handler verifies the signature and expiry on the server before reading request bodies or touching the database/filesystem. Browser storage flags are not used for authorization. Cross-origin admin mutations are rejected, and admin list/session responses are not cached.

Every product, upload, and order handler under `/api/admin` uses the shared session guard. Studio loads orders from the protected `/api/admin/orders` endpoint; the legacy unfiltered `/api/orders` list also requires an admin session. Customer order lookups require a verified Firebase Google ID token, as described below. `GET /api/admin/auth` restores a valid session after a refresh; `DELETE /api/admin/auth` expires the cookie on sign-out. Studio sends same-origin credentials on all admin requests and returns to login when an API reports an expired session. Logging out clears this browser's cookie; signing-key rotation invalidates all issued cookies.

Run `bun run test:admin` for login, cookie, expiry, tampering, route coverage, and logout checks. A request without a cookie, for example `curl -i http://localhost:3000/api/admin/products`, must return **401 Unauthorized**. Login/logout and session restoration can be exercised locally over HTTP in development; production cookies require HTTPS.

WhatsApp order actions navigate in the same tab directly from the click, without a popup. A visible retry link and selectable business number remain available if the handoff fails. Message contents and saved-order totals are unchanged.

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

## Telegram admin order alerts

When a customer places an order, the server can notify Studio admins on Telegram. This is best-effort: missing configuration is a warning-only no-op, and a slow Telegram API is aborted after about 3 seconds so checkout is not held open. The token never ships to the browser.

Set these server-only variables (blank placeholders are in `.env.example`):

- `TELEGRAM_BOT_TOKEN`: bot token from [@BotFather](https://t.me/BotFather).
- `TELEGRAM_ADMIN_CHAT_IDS`: comma-separated chat ids (group ids may be negative). Send the bot a message first, then read the chat id from `getUpdates`.

A pending-payment message is sent when checkout creates an unpaid order (WhatsApp / pay-later). A paid message is sent only on the first transition to a captured Razorpay payment (Checkout verify or `payment.captured` webhook — not both). The text includes the order id, payment status, customer, email, phone, full delivery snapshot, items, coupon/discount, total in ₹, and a Studio link (`/studio-desk`). User-supplied fields are HTML-escaped. Run `bun test tests/telegram.test.mjs` with the rest of the suite.

