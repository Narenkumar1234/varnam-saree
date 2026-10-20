'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { AddressFields } from '@/components/AddressFields';
import { useCustomerAccount } from '@/hooks/use-customer-account';
import { customerAuthHeaders } from '@/lib/customer-auth-headers';
import {
  EMPTY_ADDRESS, customerAddressPayload, deliveryFromCustomerAddress, isAddressFormOpen,
  markAddressMigrated, shouldMigrateBrowserAddress, type SavedAddress,
} from '@/lib/address-storage';
import type { CustomerAddress } from '@/types';

const blankForm = (): SavedAddress => ({ ...EMPTY_ADDRESS, label: '' });

export default function AddressesPage() {
  const { showToast } = useStore();
  const { profile, phase, canSignIn, signingIn, signIn, error } = useCustomerAccount();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState<SavedAddress>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const headers = await customerAuthHeaders();
      const pending = shouldMigrateBrowserAddress(profile.uid);
      if (pending && `${pending.first} ${pending.last}`.trim() && pending.address && pending.pin && pending.phone) {
        const migrate = await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(customerAddressPayload(pending, { isDefault: true })),
        });
        if (migrate.ok) markAddressMigrated(profile.uid);
      } else if (pending) {
        markAddressMigrated(profile.uid);
      }
      const response = await fetch('/api/addresses', { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Your addresses could not be loaded.');
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Your addresses could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) void loadAddresses();
  }, [profile, loadAddresses]);

  const resetForm = () => {
    setForm(blankForm());
    setEditingId(null);
    setIsDefault(false);
    setErrorMessage('');
    setAdding(false);
  };

  const startAdd = () => {
    setForm(blankForm());
    setEditingId(null);
    setIsDefault(false);
    setErrorMessage('');
    setAdding(true);
  };

  const startEdit = (address: CustomerAddress) => {
    setForm({ ...deliveryFromCustomerAddress(address), label: address.label || '' });
    setEditingId(address.id);
    setIsDefault(address.isDefault);
    setErrorMessage('');
    setAdding(false);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await customerAuthHeaders()) };
      const response = await fetch(editingId ? `/api/addresses/${editingId}` : '/api/addresses', {
        method: editingId ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(customerAddressPayload(form, { isDefault })),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Your address could not be saved.');
      showToast(editingId ? 'Address updated' : 'Address saved');
      resetForm();
      await loadAddresses();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Your address could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setErrorMessage('');
    try {
      const response = await fetch(`/api/addresses/${id}`, { method: 'DELETE', headers: await customerAuthHeaders() });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Your address could not be deleted.');
      if (editingId === id) resetForm();
      showToast('Address removed');
      await loadAddresses();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Your address could not be deleted.');
    }
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    setErrorMessage('');
    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await customerAuthHeaders()) },
        body: JSON.stringify({
          fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2,
          landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode,
          country: address.country, label: address.label, isDefault: true,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not update the default address.');
      showToast('Default address updated');
      await loadAddresses();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update the default address.');
    }
  };

  if (phase === 'restoring' || phase === 'verifying') {
    return <>
      <div className="page-title"><h1>Your addresses</h1></div>
      <div className="auth"><p role="status">{phase === 'restoring' ? 'Restoring your Google sign-in…' : 'Verifying your Google sign-in…'}</p></div>
    </>;
  }

  if (!profile) {
    return <>
      <div className="page-title">
        <h1>Your addresses</h1>
        <p>Sign in with Google to save delivery addresses to your account.</p>
      </div>
      <div className="auth">
        <button className="google-setup" type="button" disabled={signingIn || !canSignIn} onClick={signIn}>
          <span>{signingIn ? 'Connecting…' : canSignIn ? 'Continue with Google' : 'Google sign-in unavailable'}</span>
        </button>
        {error && <p role="alert">{error}</p>}
        <p className="muted">Guest checkout still accepts a delivery address on the order itself.</p>
        <Link className="text-link" href="/checkout">Go to checkout</Link>
      </div>
    </>;
  }

  return <>
    <div className="page-title">
      <h1>Your addresses</h1>
      <p>Saved addresses stay with your Varnam account and can be reused at checkout.</p>
    </div>
    <div className="auth" style={{ maxWidth: '640px' }}>
      {loading ? <p role="status">Loading your addresses…</p> : addresses.length === 0 ? (
        <p className="muted">No saved addresses yet. Add one below for faster checkout.</p>
      ) : (
        <ul className="saved-address-list">
          {addresses.map((address) => (
            <li key={address.id} className="saved-address-card">
              <div>
                <strong>{address.label || 'Saved address'}</strong>
                {address.isDefault && <span className="muted"> · Default</span>}
                <p>{address.fullName}<br />{address.line1}{address.line2 ? `, ${address.line2}` : ''}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state} {address.pincode}<br />{address.phone}</p>
              </div>
              <div className="saved-address-actions">
                <button type="button" className="text-link" onClick={() => startEdit(address)}>Edit</button>
                {!address.isDefault && <button type="button" className="text-link" onClick={() => void handleSetDefault(address)}>Set default</button>}
                <button type="button" className="text-link" onClick={() => void handleDelete(address.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !isAddressFormOpen(addresses.length, adding, editingId != null) && (
        <button type="button" className="btn" onClick={startAdd}>Add address</button>
      )}

      {!loading && isAddressFormOpen(addresses.length, adding, editingId != null) && (
      <form onSubmit={(event) => void handleSave(event)}>
        <h2 style={{ fontSize: '20px', marginTop: addresses.length ? '28px' : 0 }}>{editingId ? 'Edit address' : 'Add an address'}</h2>
        <label>Address nickname (optional)<input name="label" value={form.label} placeholder="Home / Office" onChange={(event) => setForm({ ...form, label: event.target.value })} /></label>
        <div className="form-grid">
          <AddressFields value={form} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          Use as default delivery address
        </label>
        {errorMessage && <p className="coupon-feedback error" role="alert">{errorMessage}</p>}
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update address' : 'Save address'}</button>
        <button className="btn outline" type="button" onClick={resetForm} disabled={saving} style={{ marginTop: '8px' }}>Cancel</button>
      </form>
      )}
    </div>
  </>;
}
