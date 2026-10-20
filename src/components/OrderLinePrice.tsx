'use client';

import React, { useContext } from 'react';
import { money, fallbackProducts } from '@/data/products';
import { StoreContext } from '@/context/store-context';
import type { OrderItem } from '@/types';

export function OrderLinePrice({ item }: { item: OrderItem }) {
  const store = useContext(StoreContext);
  const getProductById = store?.getProductById ?? ((id: number | string) => fallbackProducts.find((p) => p.id === Number(id)));
  const subtotal = item.subtotal ?? (getProductById(item.id)?.price || 0) * item.qty;
  const total = item.total ?? subtotal;
  return (
    <span className="order-line-price">
      {total < subtotal && <s aria-label="Before coupon">{money(subtotal)}</s>}
      <span>{money(total)}</span>
    </span>
  );
}
