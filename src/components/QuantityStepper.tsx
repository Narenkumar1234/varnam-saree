'use client';

import React from 'react';
import { Icon } from '@/components/Icons';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  valueId?: string;
  'aria-label'?: string;
};

export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
  decreaseLabel = 'Decrease quantity',
  increaseLabel = 'Increase quantity',
  valueId,
  'aria-label': ariaLabel = 'Quantity',
}: QuantityStepperProps) {
  return (
    <div className="quantity-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={decreaseDisabled}
        onClick={onDecrease}
      >
        <Icon name="minus" />
      </button>
      <span className="quantity-stepper-value" id={valueId} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={increaseDisabled}
        onClick={onIncrease}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
