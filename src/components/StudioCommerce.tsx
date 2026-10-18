'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, renderMarquee, type CouponDefinition, type SiteSettings } from '@/lib/commerce';
import { money } from '@/data/products';
import { useStore } from '@/context/store-context';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;
const emptyCoupon = (): CouponDefinition => ({ code: '', percentage: 10, enabled: true, minSubtotal: 0, expiresOn: null });

export function StudioCommerce({ section, adminFetch }: { section: 'coupons' | 'settings'; adminFetch: AdminFetch }) {
  const { refreshProducts } = useStore();
  const [coupons, setCoupons] = useState<CouponDefinition[]>([]);
  const [coupon, setCoupon] = useState<CouponDefinition>(emptyCoupon);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endpoint = section === 'coupons' ? '/api/admin/coupons' : '/api/admin/settings';

  async function load() {
    setLoading(true); setLoaded(false); setError('');
    try {
      const response = await adminFetch(endpoint);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load commercial settings.');
      if (section === 'coupons') setCoupons(data.coupons); else setSettings(data.settings);
      setLoaded(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load commercial settings.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [section]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const editing = section === 'coupons' && coupon.id != null;
      const response = await adminFetch(editing ? `${endpoint}/${coupon.id}` : endpoint, {
        method: section === 'settings' ? 'PUT' : editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section === 'coupons' ? coupon : settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save.');
      if (section === 'coupons') {
        setCoupons((current) => editing ? current.map((row) => row.id === data.coupon.id ? data.coupon : row) : [...current, data.coupon]);
        setCoupon(emptyCoupon());
      } else setSettings(data.settings);
      setNotice('Saved. Storefronts receive changes on their next refresh.');
      void refreshProducts();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }

  async function remove(row: CouponDefinition) {
    if (busy || !window.confirm(`Delete coupon ${row.code}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await adminFetch(`/api/admin/coupons/${row.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete coupon.');
      setCoupons((current) => current.filter((entry) => entry.id !== row.id));
      if (coupon.id === row.id) setCoupon(emptyCoupon());
      setNotice('Coupon deleted.'); void refreshProducts();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to delete coupon.'); }
    finally { setBusy(false); }
  }

  return <section className="admin-panel-card studio-commerce">
    <div className="admin-panel-header">
      <div><h2>{section === 'coupons' ? 'Coupons' : 'Site settings'}</h2><p className="muted">{section === 'coupons' ? 'Manage one-code-per-order offers. Minimum spend uses the saree subtotal before discounts and delivery.' : 'Manage store updates and delivery charges. Saved order and payment totals stay unchanged.'}</p></div>
      <button type="button" className="btn outline" disabled={busy || loading} onClick={load}>Refresh</button>
    </div>
    {error && <p className="admin-error-badge" role="alert">{error}</p>}
    {notice && <p role="status" className="coupon-feedback">{notice}</p>}
    {loading ? <p role="status">Loading…</p> : <>
      {section === 'coupons' && <div className="admin-table-container"><table className="admin-table"><thead><tr><th>Code</th><th>Discount</th><th>Active</th><th>Minimum order</th><th>Expiry (UTC)</th><th>Actions</th></tr></thead>
        <tbody>{coupons.map((row) => <tr key={row.id}><td><strong>{row.code}</strong></td><td>{row.percentage}%</td><td>{row.enabled ? 'On' : 'Off'}</td><td>{row.minSubtotal ? money(row.minSubtotal) : 'None'}</td><td>{row.expiresOn || 'None'}</td><td><div className="studio-commerce-actions"><button type="button" className="btn outline" disabled={busy} onClick={() => { setCoupon({ ...row }); setError(''); setNotice(''); }}>Edit {row.code}</button><button type="button" className="btn outline" disabled={busy} onClick={() => remove(row)}>Delete {row.code}</button></div></td></tr>)}</tbody>
      </table>{!coupons.length && <p>No coupons. Add a code below to create an offer.</p>}</div>}
      <form className="admin-edit-form studio-commerce-form" onSubmit={save}>
        <fieldset disabled={busy || !loaded}>
          {section === 'coupons' ? <>
            <h3>{coupon.id != null ? `Edit ${coupon.code}` : 'Create coupon'}</h3>
            <div className="admin-form-row two-col"><label>Coupon code<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9_-]+" autoCapitalize="characters" value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value.toUpperCase() })} /></label><label>Discount percent<input required type="number" min={1} max={100} step={1} value={coupon.percentage} onChange={(event) => setCoupon({ ...coupon, percentage: Number(event.target.value) })} /></label></div>
            <div className="admin-form-row two-col"><label>Minimum order amount (₹, optional)<input type="number" min={0} max={100000000} step={1} value={coupon.minSubtotal || ''} onChange={(event) => setCoupon({ ...coupon, minSubtotal: Number(event.target.value) })} /></label><label>Expiry date (optional, inclusive UTC)<input type="date" value={coupon.expiresOn || ''} onChange={(event) => setCoupon({ ...coupon, expiresOn: event.target.value || null })} /></label></div>
            <label className="studio-commerce-checkbox"><input type="checkbox" checked={coupon.enabled} onChange={(event) => setCoupon({ ...coupon, enabled: event.target.checked })} />Active</label>
          </> : <>
            <div className="admin-form-row"><label>Marquee message 1<input required maxLength={240} value={settings.marqueeMessage1} onChange={(event) => setSettings({ ...settings, marqueeMessage1: event.target.value })} /></label><label>Marquee message 2<input required maxLength={240} value={settings.marqueeMessage2} onChange={(event) => setSettings({ ...settings, marqueeMessage2: event.target.value })} /></label></div>
            <p className="muted">Keep {'{freeDeliveryThreshold}'} in message 2. It inserts the current amount with ₹ automatically.</p>
            <div className="admin-form-row two-col"><label>Free delivery above (₹)<input required type="number" min={0} max={100000000} step={1} value={settings.freeDeliveryThreshold} onChange={(event) => setSettings({ ...settings, freeDeliveryThreshold: Number(event.target.value) })} /></label><label>Standard delivery fee (₹)<input required type="number" min={0} max={100000000} step={1} value={settings.standardShippingFee} onChange={(event) => setSettings({ ...settings, standardShippingFee: Number(event.target.value) })} /></label></div>
            <p className="muted">Free delivery applies when the subtotal before discounts is above the threshold. Set either amount to 0 for free delivery on all orders.</p>
            <div className="studio-commerce-preview" aria-label="Marquee preview"><span>{renderMarquee(settings.marqueeMessage1, settings)}</span><span>✦ {renderMarquee(settings.marqueeMessage2, settings)}</span></div>
          </>}
          <div className="studio-commerce-actions"><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : section === 'settings' ? 'Save site settings' : coupon.id != null ? 'Save coupon' : 'Create coupon'}</button>{section === 'coupons' && coupon.id != null && <button type="button" className="btn outline" onClick={() => { setCoupon(emptyCoupon()); setError(''); }}>Cancel edit</button>}</div>
        </fieldset>
      </form>
    </>}
  </section>;
}
