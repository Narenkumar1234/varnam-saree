'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/store-context';
import { AddressFields } from '@/components/AddressFields';
import { EMPTY_ADDRESS, readSavedAddress, saveAddress, type SavedAddress } from '@/lib/address-storage';

export default function AddressesPage() {
  const { showToast } = useStore();
  const [saved, setSaved] = useState<SavedAddress>({ ...EMPTY_ADDRESS, label: 'Home' });
  const [error, setError] = useState('');

  useEffect(() => {
    const address = readSavedAddress();
    if (address) setSaved(address);
  }, []);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!saveAddress(saved)) { setError('Could not save your address. Check that browser storage is available and try again.'); return; }
    setError('');
    showToast('Address saved on this browser');
  };

  return <>
    <div className="page-title"><h1>Your addresses</h1><p>Save a delivery address in this browser for your next checkout.</p></div>
    <div className="auth">
      <form onSubmit={handleSave}>
        <label>Address nickname<input name="label" value={saved.label} onChange={(event) => setSaved({ ...saved, label: event.target.value })} required /></label>
        <div className="form-grid"><AddressFields value={saved} onChange={(field, value) => setSaved((current) => ({ ...current, [field]: value }))} /></div>
        {error && <p className="coupon-feedback error" role="alert">{error}</p>}
        <button className="btn" type="submit">Save address</button>
      </form>
    </div>
  </>;
}
