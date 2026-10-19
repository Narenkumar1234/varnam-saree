'use client';

import React from 'react';
import { money } from '@/data/products';
import { useStore } from '@/context/store-context';
import { getCouponDiscount } from '@/lib/coupons';

export function ProductPrice({ price, oldPrice }: { price: number; oldPrice?: number | null }) {
  const { couponCode, commerce } = useStore();
  const discount = getCouponDiscount(price, couponCode, commerce.coupons);
  const original = oldPrice || (discount > 0 ? price : null);
  return (
    <>
      <div className="price">
        {money(price - discount)}
        {original ? <span className="old">{money(original)}</span> : null}
      </div>
      {couponCode && discount > 0 && <small className="coupon-price-note">With {couponCode}</small>}
    </>
  );
}
