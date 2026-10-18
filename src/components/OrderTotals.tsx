import React from 'react';
import { money } from '@/data/products';
import type { OrderPricing } from '@/types';

export function OrderTotals({ pricing }: { pricing: OrderPricing }) {
  return (
    <div className="order-totals" aria-label="Order totals" aria-live="polite" aria-atomic="true">
      <div className="summary-row">
        <span>Subtotal before discount</span>
        <span>{money(pricing.subtotal)}</span>
      </div>
      {pricing.couponCode && (
        <div className="summary-row coupon-saving">
          <span>{pricing.couponCode} ({pricing.discountPercentage}% off)</span>
          <span>−{money(pricing.discountAmount)}</span>
        </div>
      )}
      <div className="summary-row">
        <span>Delivery</span>
        <span>{pricing.shipping ? money(pricing.shipping) : 'Free delivery'}</span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <strong>{money(pricing.total)}</strong>
      </div>
    </div>
  );
}

export function OrderSavings({ pricing }: { pricing?: OrderPricing }) {
  if (!pricing?.couponCode) return null;
  return <p className="coupon-saving">{pricing.couponCode}: saved {money(pricing.discountAmount)}</p>;
}
