# Varnam Saree Storefront (Next.js)

Responsive luxury Indian saree boutique storefront migrated to **Next.js 15 (App Router)** with TypeScript, React 19, and optimized responsive image loading via `next/image` and `sharp`.

## Features Ported

- **Screens**:
  - Home (`/`): Heritage campaign hero, curated collections, loved products, heritage courtyard story band, brand philosophy.
  - Catalogue / Shop (`/shop`): Collection filtering (Silk, Cotton, Festive), color filters (Emerald, Rose, Indigo, Ivory), budget toggle (under ₹5,000), 4-way sorting (Featured, Price Low/High, Newest arrivals), progressive reveal with accessible "Load more".
  - Mobile Filter Bottom-Sheet: Native modal drawer with drag grip, live match count, draft selection, and reset/apply actions.
  - Product Details (`/product/[id]`): High-res optimized image, colour swatches, blouse finishing selection, quantity controls, WhatsApp order pre-filled generator, delivery pincode estimator, care guidelines, and recommended sarees.
  - Search (`/search`): Instant search across saree names, weaves, and colours.
  - Wishlist (`/wishlist`): Save favourites with persistent browser storage and one-click removal.
  - Bag & Cart (`/cart`): Stepper controls, finishing notes, WELCOME10 coupon calculations, complimentary shipping threshold (>₹3,000), direct WhatsApp bag ordering, and checkout flow.
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
- Ready for full-stack API routes or Server Actions in future phases without architectural changes.
