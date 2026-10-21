'use client';

import React, { useContext } from 'react';
import Link from 'next/link';
import { money, fallbackProducts } from '@/data/products';
import { OrderSavings } from '@/components/OrderTotals';
import { useCustomerAccount } from '@/hooks/use-customer-account';
import { accountOrderStatusLine } from '@/lib/order-status';
import { StoreContext } from '@/context/store-context';
import { ProductThumb } from '@/components/ProductThumb';
import { resolveOrderLineImage } from '@/lib/product-gallery';
import { capitalizeColour } from '@/lib/colour';
import { OrderLinePrice } from '@/components/OrderLinePrice';
import { formatIstDate } from '@/lib/datetime';

interface AccountViewProps {
  initialSignUp?: boolean;
  ordersOnly?: boolean;
}

export function AccountView({ initialSignUp = false, ordersOnly = false }: AccountViewProps) {
  const store = useContext(StoreContext);
  const getProductById = store?.getProductById ?? ((id: number | string) => fallbackProducts.find((p) => p.id === Number(id)));
  const { profile, orders, phase, loading, signingIn, canSignIn, error, errorCode, ordersError, canRetryVerification, signIn, logOut, retry } = useCustomerAccount();

  if (!profile && (phase === 'restoring' || phase === 'verifying')) {
    return <>
      <div className="page-title"><h1>Your account</h1></div>
      <div className="auth"><p role="status">{phase === 'restoring' ? 'Restoring your Google sign-in…' : 'Verifying your Google sign-in…'}</p></div>
    </>;
  }

  if (!profile) {
    return (
      <>
        <div className="page-title">
          <h1>{ordersOnly ? 'Your orders' : initialSignUp ? 'Make yourself at home' : 'Welcome back'}</h1>
          <p>Sign in with Google to securely access your account and order history.</p>
        </div>
        <div className="auth">
          {loading ? <p role="status">Verifying your Google sign-in…</p> : (
            <div className="google-signin">
              <button className="google-setup" type="button" disabled={signingIn || !canSignIn} onClick={signIn}>
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
                <span>{signingIn ? 'Connecting…' : canSignIn ? 'Continue with Google' : 'Google sign-in unavailable'}</span>
              </button>
              <small>Use the Google account email you used when ordering.</small>
            </div>
          )}
          {(error || ordersError) && <p role="alert">{error || ordersError}</p>}
          {!loading && canRetryVerification && (error || ordersError) && <button className="text-link" type="button" onClick={retry}>Retry verification</button>}
          {errorCode === 'CUSTOMER_AUTH_SIGN_OUT_FAILED' && <button className="text-link" type="button" onClick={logOut}>Retry sign out</button>}
          <p className="muted">You can browse, keep a bag and check out as a guest without signing in.</p>
          <Link className="text-link" href="/shop">Continue shopping</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title">
        <h1>{ordersOnly ? 'Your orders' : `Hello, ${profile.name}`}</h1>
        <p>{ordersOnly ? 'Your Varnam stories, all in one place.' : 'A little corner of Varnam, just for you.'}</p>
      </div>
      <section className="section">
        <div className="account-layout">
          <aside className="account-menu">
            <Link href="/account">My account</Link>
            <Link href="/orders">My orders</Link>
            <Link href="/wishlist">My wishlist</Link>
            <Link href="/addresses">My addresses</Link>
            <button type="button" onClick={logOut}>Sign out</button>
          </aside>
          <div>
            {!ordersOnly && <>
              <h2>Your profile</h2>
              <p>{profile.name}<br /><span className="muted">{profile.email}</span></p>
            </>}
            <h2 style={{ marginTop: ordersOnly ? 0 : '30px' }}>{ordersOnly ? 'Order history' : 'Recent orders'}</h2>
            {loading ? <p role="status">Loading your orders…</p> : ordersError ? (
              <div><p role="alert">{ordersError}</p><button className="btn outline" type="button" onClick={retry}>Retry</button></div>
            ) : orders.length ? orders.map((order) => (
              <div key={order.id} className="order-card">
                <h3>{order.id}{' '}<span className="muted" style={{ fontSize: '11px' }}>{accountOrderStatusLine(order.status, order.payment)}</span></h3>
                <p>{formatIstDate(order.createdAt) || order.date} · {money(order.total)}</p>
                {order.items && order.items.length > 0 && (
                  <div className="order-card-items">
                    <div className="order-summary-items">
                      {order.items.map((x, idx) => {
                        const p = getProductById(x.id);
                        const itemName = x.name || p?.name || 'Saree';
                        const lineImage = resolveOrderLineImage(x, p);
                        const variantName = x.variant || x.colour;
                        return (
                          <div key={x.id ? `${x.id}-${idx}` : idx} className="order-summary-item">
                            <div className="order-summary-thumb">
                              <ProductThumb
                                src={lineImage}
                                alt={itemName}
                                sizes="64px"
                              />
                            </div>
                            <div className="order-summary-details">
                              <span className="order-summary-name">
                                {itemName} × {x.qty}
                              </span>
                              {variantName && (
                                <span className="order-summary-meta muted">
                                  {capitalizeColour(variantName)}
                                </span>
                              )}
                            </div>
                            <OrderLinePrice item={x} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <OrderSavings pricing={order.pricing} />
                <Link className="text-link" href={`/track?order=${encodeURIComponent(order.id)}`}>View order & tracking</Link>
              </div>
            )) : (
              <div className="empty" style={{ padding: '30px 0', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 10px' }}>Your stories start here</h3>
                <p className="muted">You have no orders yet.</p>
                <Link className="text-link" href="/shop">Explore sarees</Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
