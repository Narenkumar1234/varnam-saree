'use client';

import type { DeliveryAddress } from '@/types';
import { ADDRESS_FIELDS } from '@/lib/address-storage';

interface Props {
  value: DeliveryAddress;
  onChange: (field: keyof DeliveryAddress, value: string) => void;
  fields?: readonly (keyof DeliveryAddress)[];
}

const inputs = {
  first: { label: 'First name', autoComplete: 'given-name' },
  last: { label: 'Last name', autoComplete: 'family-name' },
  phone: { label: 'Phone number', autoComplete: 'tel', type: 'tel', pattern: '[0-9+ ()-]{10,16}', placeholder: '+91 98765 43210', wide: true },
  address: { label: 'Street address', autoComplete: 'address-line1', wide: true },
  city: { label: 'City', autoComplete: 'address-level2' },
  pin: { label: 'Pincode', autoComplete: 'postal-code', inputMode: 'numeric' as const, pattern: '[0-9]{6}', maxLength: 6 },
  state: { label: 'State', autoComplete: 'address-level1' },
};

// Both forms use the same field names, autocomplete and validation; checkout
// can keep its existing email/apartment fields between the address groups.
export function AddressFields({ value, onChange, fields = ADDRESS_FIELDS }: Props) {
  return <>{fields.map((field) => {
    const { label, wide, ...attributes } = { wide: false, ...inputs[field] };
    return <label key={field} className={wide ? 'wide' : undefined}>{label}<input {...attributes} name={field} required value={value[field]} onChange={(event) => onChange(field, event.target.value)} /></label>;
  })}</>;
}
