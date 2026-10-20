import type { Product } from '@/types';

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

export type GalleryProduct = Pick<Product, 'image'> & {
  images?: Product['images'] | unknown;
  imageUrl?: string | null;
  variants?: Product['variants'] | null;
};

export function uniqueImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

function usableUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
  return url;
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

/**
 * Images shown on the product detail gallery.
 * Colour-variant photos come first when a variant is selected; otherwise the
 * main image column followed by additional Studio photos (deduped).
 */
export function buildProductGalleryImages(
  product: GalleryProduct | null | undefined,
  selectedVariantIndex = 0,
): string[] {
  if (!product) return [];

  const variants = product.variants ?? [];
  const activeVariant = variants[selectedVariantIndex] ?? variants[0];
  const variantImages = uniqueImageUrls(activeVariant?.images ?? []);
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
