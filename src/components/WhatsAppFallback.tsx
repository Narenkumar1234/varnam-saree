'use client';

import { useStore } from '@/context/store-context';
import { getWhatsAppNumber } from '@/lib/whatsapp';

export function WhatsAppFallback() {
  const { whatsAppFallback, clearWhatsAppFallback } = useStore();
  if (!whatsAppFallback) return null;
  const number = getWhatsAppNumber();
  return (
    <aside className="whatsapp-fallback" aria-label="WhatsApp order help">
      <button type="button" className="whatsapp-fallback-close" aria-label="Dismiss WhatsApp help" onClick={clearWhatsAppFallback}>×</button>
      <p role="status">If WhatsApp did not open, use this link to retry.</p>
      {whatsAppFallback.url && <a className="text-link" href={whatsAppFallback.url}>Continue to WhatsApp</a>}
      {number ? <p>Business number: <span className="whatsapp-number">+{number}</span></p> : <p>WhatsApp ordering is unavailable. Please contact the store.</p>}
    </aside>
  );
}
