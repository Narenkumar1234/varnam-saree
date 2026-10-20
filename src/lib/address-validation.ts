export class AddressValidationError extends Error {}

/** HTML `pattern` values are compiled with the `v` flag; keep these unicode-set safe. */
export const INDIAN_MOBILE_PATTERN = '(\\+91[ ]?|91[ ]?|0[ ]?)?[6-9]([ ]?[0-9]){9}';
export const PINCODE_PATTERN = '[0-9]{6}';
export const INDIAN_MOBILE_PATTERN_MESSAGE = 'Enter a 10-digit mobile number.';
export const PINCODE_PATTERN_MESSAGE = 'Enter a 6-digit pincode.';

const TEXT_LIMITS = {
  name: 120,
  label: 40,
  line: 200,
  city: 80,
  state: 80,
  country: 60,
} as const;

export function optionalText(value: unknown, max: number = TEXT_LIMITS.line): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new AddressValidationError('Enter valid address details.');
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw new AddressValidationError('That address field is too long.');
  return text;
}

export function requiredText(value: unknown, label: string, max: number = TEXT_LIMITS.line): string {
  const text = optionalText(value, max);
  if (!text) throw new AddressValidationError(`Enter ${label}.`);
  return text;
}

/** 10-digit Indian mobile. Accepts +91, 91, or a leading 0. */
export function normalizeIndianMobile(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new AddressValidationError('Enter a 10-digit Indian mobile number.');
  }
  const digits = String(value).replace(/\D/g, '');
  const mobile = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new AddressValidationError('Enter a 10-digit Indian mobile number.');
  return mobile;
}

export function normalizePincode(value: unknown): string {
  const pin = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{6}$/.test(pin)) throw new AddressValidationError('Enter a 6-digit pincode.');
  return pin;
}

export interface ShippingSnapshot {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingLandmark: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
}

export interface CustomerAddressInput {
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface OrderDeliveryFields {
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  shippingFullName?: string | null;
  shippingPhone?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingLandmark?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
}

function joinedName(body: Record<string, unknown>): string {
  const first = typeof body.first === 'string' ? body.first.trim() : '';
  const last = typeof body.last === 'string' ? body.last.trim() : '';
  return [first, last].filter(Boolean).join(' ');
}

export function parseOrderShipping(body: unknown): ShippingSnapshot {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AddressValidationError('Enter delivery details.');
  }
  const value = body as Record<string, unknown>;
  const fullName = requiredText(value.shippingFullName || value.customerName || joinedName(value), 'the recipient name', TEXT_LIMITS.name);
  const phone = normalizeIndianMobile(value.shippingPhone || value.phone);
  const line1 = requiredText(value.shippingLine1 || value.address, 'a street address');
  const line2 = optionalText(value.shippingLine2 ?? value.apartment ?? value.line2);
  const landmark = optionalText(value.shippingLandmark ?? value.landmark);
  const city = requiredText(value.shippingCity || value.city, 'a city', TEXT_LIMITS.city);
  const state = requiredText(value.shippingState || value.state, 'a state', TEXT_LIMITS.state);
  const pincode = normalizePincode(value.shippingPincode || value.pincode || value.pin);
  return {
    customerName: fullName,
    phone,
    address: [line1, line2, landmark].filter(Boolean).join(', '),
    city,
    state,
    pincode,
    shippingFullName: fullName,
    shippingPhone: phone,
    shippingLine1: line1,
    shippingLine2: line2,
    shippingLandmark: landmark,
    shippingCity: city,
    shippingState: state,
    shippingPincode: pincode,
  };
}

export function parseCustomerAddressInput(body: unknown): CustomerAddressInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AddressValidationError('Enter address details.');
  }
  const value = body as Record<string, unknown>;
  const fullName = requiredText(value.fullName || value.customerName || joinedName(value), 'the recipient name', TEXT_LIMITS.name);
  return {
    label: optionalText(value.label, TEXT_LIMITS.label),
    fullName,
    phone: normalizeIndianMobile(value.phone),
    line1: requiredText(value.line1 || value.address, 'a street address'),
    line2: optionalText(value.line2 ?? value.apartment),
    landmark: optionalText(value.landmark),
    city: requiredText(value.city, 'a city', TEXT_LIMITS.city),
    state: requiredText(value.state, 'a state', TEXT_LIMITS.state),
    pincode: normalizePincode(value.pincode || value.pin),
    country: optionalText(value.country, TEXT_LIMITS.country) || 'India',
    isDefault: value.isDefault === true,
  };
}

export function orderDeliveryLines(order: OrderDeliveryFields): string[] {
  const line1 = (order.shippingLine1 || order.address || '').trim();
  const line2 = (order.shippingLine2 || '').trim();
  const landmark = (order.shippingLandmark || '').trim();
  const city = (order.shippingCity || order.city || '').trim();
  const state = (order.shippingState || order.state || '').trim();
  const pincode = (order.shippingPincode || order.pincode || '').trim();
  const locality = [city, state, pincode].filter(Boolean).join(', ');
  return [line1, line2, landmark, locality].filter(Boolean);
}
