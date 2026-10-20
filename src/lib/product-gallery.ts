import type { Product, ProductVariant } from '@/types';
import { resolveDisplayImageUrl } from '@/lib/image-url';

/** Used when a product has no usable gallery or main image. */
export const PRODUCT_IMAGE_PLACEHOLDER = '/assets/saree-emerald.webp';

type ImageLike = {
  url?: unknown;
  src?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  sort?: unknown;
  sortOrder?: unknown;
  order?: unknown;
};

type VariantImageSource = Pick<ProductVariant, 'images'> & {
  image?: string | null;
  imageUrl?: string | null;
  name?: string | null;
  colour?: string | null;
};

export type GalleryProduct = Pick<Product, 'image'> & {
  images?: Product['images'] | unknown;
  imageUrl?: string | null;
  variants?: Array<VariantImageSource> | null;
};

export function uniqueImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    const url = usableUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

function usableUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return resolveDisplayImageUrl(value);
}

function sortValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseImageEntry(entry: unknown, index: number): { url: string; sort: number; index: number } | null {
  if (typeof entry === 'string') {
    const url = usableUrl(entry);
    return url ? { url, sort: index, index } : null;
  }
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as ImageLike;
  const url = usableUrl(record.url) || usableUrl(record.src) || usableUrl(record.image) || usableUrl(record.imageUrl);
  if (!url) return null;
  return {
    url,
    sort: sortValue(record.sortOrder ?? record.sort ?? record.order, index),
    index,
  };
}

function parseImageArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
}

/** Ordered product photos as stored in Studio (index 0 / lowest sort order first). */
export function normalizeProductImages(raw: unknown): string[] {
  const entries = parseImageArray(raw);
  if (!entries || entries.length === 0) return [];
  return uniqueImageUrls(
    entries
      .map(parseImageEntry)
      .filter((entry): entry is { url: string; sort: number; index: number } => entry !== null)
      .sort((a, b) => a.sort - b.sort || a.index - b.index)
      .map((entry) => entry.url),
  );
}

function listedImageUrls(raw: unknown): Array<string | null | undefined> {
  if (Array.isArray(raw) && raw.every((entry) => typeof entry === 'string' || entry == null)) {
    return raw;
  }
  return normalizeProductImages(raw);
}

function mainProductImages(product: GalleryProduct | null | undefined): string[] {
  return uniqueImageUrls([
    product?.image,
    product?.imageUrl,
    ...listedImageUrls(product?.images),
  ]);
}

function normalizeVariantKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

/**
 * Strict variant lookup by numeric index or case-insensitive name/colour.
 * Returns -1 when nothing matches.
 */
export function findVariantIndex(
  variants: Array<VariantImageSource> | null | undefined,
  selection: number | string | null | undefined,
): number {
  if (!variants || variants.length === 0) return -1;
  if (typeof selection === 'number') {
    return Number.isInteger(selection) && selection >= 0 && selection < variants.length ? selection : -1;
  }
  const query = normalizeVariantKey(selection);
  if (!query) return -1;
  if (/^\d+$/.test(query)) {
    const asNum = Number(query);
    if (asNum < variants.length) return asNum;
  }
  return variants.findIndex((v) => normalizeVariantKey(v.name) === query || normalizeVariantKey(v.colour) === query);
}

/** Variant index for display: falls back to the first variant (0) when nothing matches. */
export function resolveVariantIndex(
  variants: Array<VariantImageSource> | null | undefined,
  selection: number | string | null | undefined,
): number {
  const index = findVariantIndex(variants, selection);
  return index >= 0 ? index : 0;
}

/**
 * Images shown on the product detail gallery.
 * Colour-variant photos come first when a variant is selected; otherwise the
 * main image column followed by additional Studio photos (deduped).
 * Supports numeric index or case-insensitive variant name/colour matching.
 */
export function buildProductGalleryImages(
  product: GalleryProduct | null | undefined,
  selectedVariant: number | string | null | undefined = 0,
): string[] {
  if (!product) return [];

  const variants = product.variants ?? [];
  const variantIndex = resolveVariantIndex(variants, selectedVariant);
  const activeVariant = variants[variantIndex] ?? variants[0];
  const variantImages = variantImageUrls(activeVariant);
  const mainImages = mainProductImages(product);

  if (variants.length > 0 && variantImages.length > 0) {
    return uniqueImageUrls([...variantImages, ...mainImages]);
  }
  return mainImages;
}

export function clampGalleryIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

export function galleryImageAt(images: string[], index: number): string {
  return images[clampGalleryIndex(index, images.length)] || '';
}

/**
 * Listing-card / default cover: first Studio product photo (no variant selected),
 * then the main image column, then a placeholder.
 */
export function getProductCoverImage(product: GalleryProduct | null | undefined): string {
  const listed = normalizeProductImages(product?.images);
  return listed[0]
    || usableUrl(product?.image)
    || usableUrl(product?.imageUrl)
    || PRODUCT_IMAGE_PLACEHOLDER;
}

function variantImageUrls(variant: VariantImageSource | null | undefined): string[] {
  if (!variant) return [];
  return uniqueImageUrls([
    ...listedImageUrls(variant.images),
    variant.image,
    variant.imageUrl,
  ]);
}

/**
 * Cart / mini-cart thumbnail: first usable colour-variant photo, then the
 * product cover (first Studio photo / main image / placeholder).
 * Supports numeric index or case-insensitive variant name/colour matching.
 */
export function getCartLineImage(
  product: GalleryProduct | null | undefined,
  selectedVariant: number | string | null | undefined = 0,
): string {
  if (!product) return PRODUCT_IMAGE_PLACEHOLDER;
  const variants = product.variants ?? [];
  const variantIndex = resolveVariantIndex(variants, selectedVariant);
  const activeVariant = variants[variantIndex] ?? variants[0];
  return variantImageUrls(activeVariant)[0] || getProductCoverImage(product);
}

/**
 * Resolve the display image URL for an order line item.
 * If the line item already stores an image, resolve and use it;
 * otherwise resolve from the product and ordered variant/colour.
 */
export function resolveOrderLineImage(
  item: { id?: number; image?: string | null; variant?: string | null; colour?: string | null } | null | undefined,
  product?: GalleryProduct | null,
): string {
  if (item?.image) {
    const usable = resolveDisplayImageUrl(item.image);
    if (usable) return usable;
  }
  const selection = item?.variant || item?.colour || 0;
  return getCartLineImage(product, selection);
}
