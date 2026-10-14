'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/store-context';

export default function AddressesPage() {
  const { showToast } = useStore();
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const savedLabel = localStorage.getItem('varnam-address-label');
    const savedAddress = localStorage.getItem('varnam-address');
    if (savedLabel) setLabel(savedLabel);
    if (savedAddress) setAddress(savedAddress);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('varnam-address-label', label);
    localStorage.setItem('varnam-address', address);
    showToast('Address saved on this browser');
  };

  return (
    <>
      <div className="page-title">
        <h1>Your addresses</h1>
        <p>Saved in this browser for this demo.</p>
      </div>

      <div className="auth">
        <form onSubmit={handleSave}>
          <label>
            Address nickname
            <input
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </label>
          <label>
            Full address
            <textarea
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>
          <button className="btn" type="submit">
            Save address
          </button>
        </form>
      </div>
    </>
  );
}
