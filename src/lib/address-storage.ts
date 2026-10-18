import type { DeliveryAddress } from '@/types';

export type SavedAddress = DeliveryAddress & { label: string };
export const ADDRESS_STORAGE_KEY = 'varnam-address';
const LEGACY_LABEL_KEY = 'varnam-address-label';
export const ADDRESS_FIELDS = ['first', 'last', 'phone', 'address', 'city', 'pin', 'state'] as const;
export const EMPTY_ADDRESS: DeliveryAddress = { first: '', last: '', phone: '', address: '', city: '', pin: '', state: '' };
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
