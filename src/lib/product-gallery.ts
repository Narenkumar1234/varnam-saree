type GalleryProduct = {
  image?: string | null;
  images?: string[] | null;
  variants?: Array<{ images?: string[] | null }> | null;
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

export function buildProductGalleryImages(
  product: GalleryProduct | null | undefined,
  selectedVariantIndex = 0,
): string[] {
  if (!product) return [];

  const variants = product.variants ?? [];
  const activeVariant = variants[selectedVariantIndex] ?? variants[0];
  const variantImages = uniqueImageUrls(activeVariant?.images ?? []);
  const mainImages = uniqueImageUrls([
    product.image,
    ...(Array.isArray(product.images) ? product.images : []),
  ]);

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
