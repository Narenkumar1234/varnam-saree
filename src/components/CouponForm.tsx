'use client';

import React, { useEffect, useId, useState } from 'react';
import { useStore } from '@/context/store-context';
import { validateCoupon } from '@/lib/coupons';

export function CouponForm({ disabled = false }: { disabled?: boolean }) {
  const { couponCode, applyCoupon, removeCoupon } = useStore();
  const id = useId();
  const [code, setCode] = useState(couponCode || '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const applied = couponCode ? validateCoupon(couponCode) : null;

  useEffect(() => setCode(couponCode || ''), [couponCode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = applyCoupon(code);
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
          placeholder="Try OFFER50"
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
        Use OFFER50 for 50% off sarees. One code per order; delivery is calculated separately.
      </p>
      {error && <p className="coupon-feedback error" id={`${id}-error`} role="alert">{error}</p>}
      <div className="coupon-feedback" role="status" aria-live="polite">
        {applied?.valid ? (
          <div className="coupon-applied">
            <span>{applied.coupon.code} applied — {applied.coupon.percentage}% off sarees.</span>
            <button type="button" disabled={disabled} onClick={() => {
              removeCoupon();
              setCode('');
              setError(null);
              setNotice('Coupon removed.');
            }} aria-label={`Remove ${applied.coupon.code}`}>
              Remove
            </button>
          </div>
        ) : notice}
      </div>
    </form>
  );
}
