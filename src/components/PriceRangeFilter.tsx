'use client';

import React, { useId } from 'react';
import { money } from '@/data/products';
import type { PriceRange } from '@/types';

interface PriceRangeFilterProps {
  bounds: PriceRange;
  value: PriceRange;
  onChange: (value: PriceRange) => void;
}

export function PriceRangeFilter({ bounds, value, onChange }: PriceRangeFilterProps) {
  const id = useId();
  const span = bounds.max - bounds.min || 1;
  const start = ((value.min - bounds.min) / span) * 100;
  const end = ((value.max - bounds.min) / span) * 100;
  const disabled = bounds.min === bounds.max;

  return (
    <div className="price-range-filter">
      <div className="price-range-values">
        <label htmlFor={`${id}-min`}>
          Min <span>{money(value.min)}</span>
        </label>
        <label htmlFor={`${id}-max`}>
          Max <span>{money(value.max)}</span>
        </label>
      </div>

      <div className="price-range-slider">
        <div className="price-range-track" aria-hidden="true">
          <div
            className="price-range-selected"
            style={{ left: `${start}%`, width: `${end - start}%` }}
          />
        </div>
        <input
          id={`${id}-min`}
          type="range"
          min={bounds.min}
          max={Math.max(bounds.max, bounds.min + 1)}
          step={1}
          value={value.min}
          disabled={disabled}
          aria-valuemax={value.max}
          aria-valuetext={money(value.min)}
          aria-describedby={`${id}-hint`}
          style={{ zIndex: value.min === bounds.max ? 3 : 1 }}
          onChange={(event) => onChange({
            ...value,
            min: Math.min(Number(event.target.value), value.max),
          })}
        />
        <input
          id={`${id}-max`}
          type="range"
          min={bounds.min}
          max={Math.max(bounds.max, bounds.min + 1)}
          step={1}
          value={value.max}
          disabled={disabled}
          aria-valuemin={value.min}
          aria-valuetext={money(value.max)}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange({
            ...value,
            max: Math.max(Number(event.target.value), value.min),
          })}
        />
      </div>
      <p className="price-range-hint" id={`${id}-hint`}>
        Drag either handle or use the arrow keys.
      </p>
    </div>
  );
}
