'use client';

import type { DeliveryAddress } from '@/types';
import { ADDRESS_FIELDS } from '@/lib/address-storage';
import {
  INDIAN_MOBILE_PATTERN, INDIAN_MOBILE_PATTERN_MESSAGE, PINCODE_PATTERN, PINCODE_PATTERN_MESSAGE,
} from '@/lib/address-validation';

interface Props {
  value: DeliveryAddress;
  onChange: (field: keyof DeliveryAddress, value: string) => void;
  fields?: readonly (keyof DeliveryAddress)[];
}

type AddressFieldInput = {
  label: string;
  autoComplete?: string;
  type?: string;
  pattern?: string;
  placeholder?: string;
  wide?: boolean;
  required?: boolean;
  inputMode?: 'numeric';
  maxLength?: number;
  title?: string;
};

export const ADDRESS_FIELD_INPUTS: Record<keyof DeliveryAddress, AddressFieldInput> = {
  first: { label: 'First name', autoComplete: 'given-name' },
  last: { label: 'Last name', autoComplete: 'family-name' },
  phone: {
    label: 'Phone number',
    autoComplete: 'tel',
    type: 'tel',
    pattern: INDIAN_MOBILE_PATTERN,
    placeholder: '+91 9876543210',
    wide: true,
    title: INDIAN_MOBILE_PATTERN_MESSAGE,
  },
  address: { label: 'Street address', autoComplete: 'address-line1', wide: true },
  apartment: { label: 'Apartment, floor (optional)', autoComplete: 'address-line2', wide: true, required: false },
  landmark: { label: 'Landmark (optional)', wide: true, required: false },
  city: { label: 'City', autoComplete: 'address-level2' },
  pin: {
    label: 'Pincode',
    autoComplete: 'postal-code',
    inputMode: 'numeric',
    pattern: PINCODE_PATTERN,
    maxLength: 6,
    title: PINCODE_PATTERN_MESSAGE,
  },
  state: { label: 'State', autoComplete: 'address-level1' },
};

// Both forms use the same field names, autocomplete and validation; checkout
// can keep its existing email/apartment fields between the address groups.
export function AddressFields({ value, onChange, fields = ADDRESS_FIELDS }: Props) {
  return <>{fields.map((field) => {
    const { label, wide, required = true, title, ...attributes } = { wide: false, required: true, ...ADDRESS_FIELD_INPUTS[field] };
    return (
      <label key={field} className={wide ? 'wide' : undefined}>
        {label}
        <input
          {...attributes}
          name={field}
          required={required}
          title={title}
          value={value[field]}
          onInvalid={(event) => {
            if (title && event.currentTarget.validity.patternMismatch) {
              event.currentTarget.setCustomValidity(title);
            }
          }}
          onChange={(event) => {
            event.currentTarget.setCustomValidity('');
            onChange(field, event.target.value);
          }}
        />
      </label>
    );
  })}</>;
}
