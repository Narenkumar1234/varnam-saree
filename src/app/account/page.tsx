'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';

export default function AccountPage() {
  const { profile, setProfile, orders, showToast } = useStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = isSignUp ? nameInput : emailInput.split('@')[0] || 'Varnam customer';
    setProfile({
      name: displayName,
      email: emailInput,
    });
    showToast('Signed in to demo account');
  };

  const handleGoogleMockClick = () => {
    showToast('Google sign-in is ready for the store OAuth client ID.');
  };

  if (!profile) {
    return (
      <>
        <div className="page-title">
          <h1>{isSignUp ? 'Make yourself at home' : 'Welcome back'}</h1>
          <p>Your colours. Your favourites. Your Varnam.</p>
        </div>

        <div className="auth">
          <div className="tabs">
            <button
              type="button"
              className={!isSignUp ? 'active' : ''}
              onClick={() => setIsSignUp(false)}
            >
              Sign in
            </button>
            <button
              type="button"
              className={isSignUp ? 'active' : ''}
              onClick={() => setIsSignUp(true)}
            >
              Create account
            </button>
          </div>

          <div className="google-signin">
            <button
              className="google-setup"
              type="button"
              aria-disabled="true"
              onClick={handleGoogleMockClick}
            >
              <span className="google-mark" aria-hidden="true">
                <svg viewBox="0 0 18 18" width="18" height="18" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.877 2.684-6.614Z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.441 1.346l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
                  />
                </svg>
              </span>
              <span>Continue with Google</span>
            </button>
            <small>Google connection details are being configured.</small>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <p className="demo-note">Demo profile saved in this browser. No online account is created.</p>

          <form onSubmit={handleAuthSubmit}>
            {isSignUp && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </label>
            <button className="btn" type="submit">
              {isSignUp ? 'Create demo profile' : 'Continue with demo profile'}
            </button>
          </form>
          <p style={{ marginTop: '16px' }}>No password needed for this preview.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title">
        <h1>Hello, {profile.name}</h1>
        <p>A little corner of Varnam, just for you.</p>
      </div>

      <section className="section">
        <div className="account-layout">
          <aside className="account-menu">
            <Link href="/account">My account</Link>
            <Link href="/orders">My orders</Link>
            <Link href="/wishlist">My wishlist</Link>
            <Link href="/addresses">My addresses</Link>
            <button type="button" onClick={() => setProfile(null)}>
              Sign out
            </button>
          </aside>

          <div>
            <h2>Your profile</h2>
            <p>
              {profile.name}
              <br />
              <span className="muted">{profile.email}</span>
            </p>
            <p className="demo-note">This profile exists only on this browser.</p>

            <h2 style={{ marginTop: '30px' }}>Recent orders</h2>
            {orders.length > 0 ? (
              orders.map((o) => (
                <div key={o.id} className="order-card">
                  <h3>
                    {o.id}{' '}
                    <span className="muted" style={{ fontSize: '11px' }}>
                      · Demo order
                    </span>
                  </h3>
                  <p>
                    {o.date} · {o.items.reduce((s, x) => s + x.qty, 0)} item(s) · {money(o.total)}
                  </p>
                  <Link className="text-link" href={`/track?order=${o.id}`}>
                    View order & tracking
                  </Link>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: '30px 0', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 10px' }}>Your stories start here</h3>
                <p className="muted">You have no demo orders yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
