import React from 'react';
import { getProductById, money } from '@/data/products';
import type { OrderItem } from '@/types';

export function OrderLinePrice({ item }: { item: OrderItem }) {
  const subtotal = item.subtotal ?? (getProductById(item.id)?.price || 0) * item.qty;
  const total = item.total ?? subtotal;
  return (
    <span className="order-line-price">
      {total < subtotal && <s aria-label="Before coupon">{money(subtotal)}</s>}
      <span>{money(total)}</span>
    </span>
  );
}
