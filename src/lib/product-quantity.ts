import type { Product } from '@/types';

export const UNKNOWN_STOCK_MAX_QUANTITY = 10;

export function getProductQuantityLimit(product: Pick<Product, 'stock'>): number {
  return product.stock == null ? UNKNOWN_STOCK_MAX_QUANTITY : Math.max(0, product.stock);
}
