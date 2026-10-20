import type { CustomerAddress, DeliveryAddress } from '@/types';

export type SavedAddress = DeliveryAddress & { label: string };
export const ADDRESS_STORAGE_KEY = 'varnam-address';
const LEGACY_LABEL_KEY = 'varnam-address-label';
export const ADDRESS_FIELDS = ['first', 'last', 'phone', 'address', 'apartment', 'landmark', 'city', 'pin', 'state'] as const;
export const EMPTY_ADDRESS: DeliveryAddress = { first: '', last: '', phone: '', address: '', apartment: '', landmark: '', city: '', pin: '', state: '' };
export const ADDRESS_MIGRATION_KEY = 'varnam-address-migrated';
type AddressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): AddressStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export function decodeSavedAddress(raw: string | null, legacyLabel = 'Home'): SavedAddress | null {
  if (!raw?.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  const label = legacyLabel.trim() || 'Home';
  if (typeof parsed === 'string' || typeof parsed === 'number') {
    // Preserve old free-form addresses in one line; never guess names/city/pin.
    const address = (typeof parsed === 'string' ? parsed : raw).trim().replace(/\s*[\r\n]+\s*/g, ', ');
    return address ? { ...EMPTY_ADDRESS, label, address } : null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!ADDRESS_FIELDS.some((field) => typeof record[field] === 'string')) return null;
  const address: SavedAddress = { ...EMPTY_ADDRESS, label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : label };
  for (const field of ADDRESS_FIELDS) if (typeof record[field] === 'string') address[field] = record[field].trim();
  return address;
}

export function readSavedAddress(storage: AddressStorage | null = browserStorage()): SavedAddress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ADDRESS_STORAGE_KEY);
    const saved = decodeSavedAddress(raw, storage.getItem(LEGACY_LABEL_KEY) || 'Home');
    if (saved) {
      try {
        const json = JSON.stringify(saved);
        if (json !== raw) storage.setItem(ADDRESS_STORAGE_KEY, json);
        storage.removeItem(LEGACY_LABEL_KEY);
      } catch { /* Prefill still works if migration cannot be persisted. */ }
    }
    return saved;
  } catch { return null; }
}

export function splitFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

export function deliveryFromCustomerAddress(address: CustomerAddress): DeliveryAddress {
  const { first, last } = splitFullName(address.fullName);
  return {
    first,
    last,
    phone: address.phone,
    address: address.line1,
    apartment: address.line2 || '',
    landmark: address.landmark || '',
    city: address.city,
    pin: address.pincode,
    state: address.state,
  };
}

export function customerAddressPayload(saved: SavedAddress, extras: { isDefault?: boolean } = {}) {
  return {
    label: saved.label,
    first: saved.first,
    last: saved.last,
    fullName: `${saved.first} ${saved.last}`.trim(),
    phone: saved.phone,
    line1: saved.address,
    address: saved.address,
    apartment: saved.apartment,
    line2: saved.apartment,
    landmark: saved.landmark,
    city: saved.city,
    state: saved.state,
    pincode: saved.pin,
    pin: saved.pin,
    isDefault: extras.isDefault === true,
  };
}

export function markAddressMigrated(uid: string, storage: AddressStorage | null = browserStorage()) {
  if (!storage) return;
  try {
    storage.setItem(ADDRESS_MIGRATION_KEY, uid);
    storage.removeItem(ADDRESS_STORAGE_KEY);
    storage.removeItem(LEGACY_LABEL_KEY);
  } catch { /* Prefill still works if the browser blocks the write. */ }
}

export function shouldMigrateBrowserAddress(uid: string, storage: AddressStorage | null = browserStorage()): SavedAddress | null {
  if (!storage) return null;
  try {
    if (storage.getItem(ADDRESS_MIGRATION_KEY) === uid) return null;
    return readSavedAddress(storage);
  } catch { return null; }
}

export function isAddressFormOpen(savedCount: number, adding: boolean, editing = false): boolean {
  return savedCount === 0 || adding || editing;
}

export function saveAddress(saved: SavedAddress, storage: AddressStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    const normalized = decodeSavedAddress(JSON.stringify(saved));
    if (!normalized) return false;
    storage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(normalized));
    // One JSON record is now authoritative, including the nickname.
    try { storage.removeItem(LEGACY_LABEL_KEY); } catch { /* The JSON record takes precedence. */ }
    return true;
  } catch { return false; }
}
