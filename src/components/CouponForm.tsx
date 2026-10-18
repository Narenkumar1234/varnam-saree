'use client';

import React, { useEffect, useId, useState } from 'react';
import { useStore } from '@/context/store-context';
import { validateCoupon } from '@/lib/coupons';
import type { CartItem } from '@/types';

export function CouponForm({ disabled = false, items }: { disabled?: boolean; items?: CartItem[] }) {
  const { couponCode, applyCoupon, removeCoupon, commerce, cart, products } = useStore();
  const subtotal = (items || cart).reduce((sum, item) => sum + (products.find((p) => p.id === item.id)?.price || 0) * item.qty, 0);
  const id = useId();
  const [code, setCode] = useState(couponCode || '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const applied = couponCode ? validateCoupon(couponCode, commerce.coupons, subtotal) : null;

  useEffect(() => setCode(couponCode || ''), [couponCode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = applyCoupon(code, subtotal);
    setNotice('');
    setError(result.valid ? null : result.error);
    if (result.valid) setCode(result.coupon.code);
  };

  return (
    <form className="coupon" onSubmit={handleSubmit}>
      <label htmlFor={`${id}-code`}>Have a coupon code?</label>
      <div className="inline">
        <input
          id={`${id}-code`}
          name="coupon"
          placeholder="Enter coupon code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
            setNotice('');
          }}
        />
        <button type="submit" disabled={disabled}>Apply</button>
      </div>
      <p className="coupon-hint" id={`${id}-hint`}>
        One code per order. Minimum order amounts apply before discounts; delivery is calculated separately.
      </p>
      {error && <p className="coupon-feedback error" id={`${id}-error`} role="alert">{error}</p>}
      <div className="coupon-feedback" role="status" aria-live="polite">
        {couponCode ? (
          <div className="coupon-applied">
            <span>{applied?.valid ? `${applied.coupon.code} applied — ${applied.coupon.percentage}% off sarees.` : applied && !applied.valid ? applied.error : ''}</span>
            <button type="button" disabled={disabled} onClick={() => {
              removeCoupon();
              setCode('');
              setError(null);
              setNotice('Coupon removed.');
            }} aria-label={`Remove ${couponCode}`}>
              Remove
            </button>
          </div>
        ) : notice}
      </div>
    </form>
  );
}
