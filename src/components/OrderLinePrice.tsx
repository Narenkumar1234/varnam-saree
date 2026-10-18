'use client';

import React from 'react';
import { money } from '@/data/products';
import { useStore } from '@/context/store-context';
import type { OrderItem } from '@/types';

export function OrderLinePrice({ item }: { item: OrderItem }) {
  const { getProductById } = useStore();
  const subtotal = item.subtotal ?? (getProductById(item.id)?.price || 0) * item.qty;
  const total = item.total ?? subtotal;
  return (
    <span className="order-line-price">
      {total < subtotal && <s aria-label="Before coupon">{money(subtotal)}</s>}
      <span>{money(total)}</span>
    </span>
  );
}
