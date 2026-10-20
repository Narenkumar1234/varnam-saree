'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { money } from '@/data/products';
import { OrderSavings } from '@/components/OrderTotals';
import { StudioOrderStatusEditor } from '@/components/StudioOrderStatusEditor';
import { needsUnoptimized } from '@/lib/image-loader';
import { getProductCoverImage } from '@/lib/product-gallery';
import { formatOrderCreatedAtIst, normalizeStudioOrderLookupId, studioAdminPaymentDetails } from '@/lib/order-status';
import { studioOrderLineLabel } from '@/lib/studio-order-filters';
import { readOrderSnapshot } from '@/lib/pricing';
import type { Product } from '@/types';

type AdminProduct = Pick<Product, 'id' | 'name' | 'image'> & { images?: string[] };

interface LookupOrder {
  id: string;
  customerName: string;
  email: string;
  phone?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  shippingFullName?: string | null;
  shippingPhone?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingLandmark?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  total: number;
  status: string;
  itemsJson: string;
  createdAt: string;
}

interface Props {
  products: AdminProduct[];
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onUpdated: () => void;
  showToast: (message: string) => void;
}

function shippingLines(order: LookupOrder): string {
  return [
    order.shippingFullName,
    order.shippingPhone,
    order.shippingLine1 || order.address,
    order.shippingLine2,
    order.shippingLandmark,
    `${order.shippingCity || order.city}, ${order.shippingState || order.state} - ${order.shippingPincode || order.pincode}`,
  ].filter(Boolean).join(', ');
}

function writeLookupQuery(orderId: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (orderId) url.searchParams.set('order', orderId);
  else url.searchParams.delete('order');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function StudioOrderLookup({ products, adminFetch, onUpdated, showToast }: Props) {
  const [input, setInput] = useState('');
  const [order, setOrder] = useState<LookupOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookedUpId, setLookedUpId] = useState('');

  async function loadOrder(rawId: string) {
    const id = normalizeStudioOrderLookupId(rawId);
    if (!id) {
      setOrder(null);
      setMissing(false);
      setLookedUpId('');
      return;
    }
    setInput(id);
    setLoading(true);
    setMissing(false);
    setLookedUpId(id);
    writeLookupQuery(id);
    try {
      const response = await adminFetch(`/api/admin/orders/${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setOrder(null);
        setMissing(true);
        return;
      }
      if (!response.ok || !data.order) {
        throw new Error(data.error || 'Unable to load order.');
      }
      setOrder(data.order);
      setMissing(false);
    } catch (error) {
      setOrder(null);
      setMissing(false);
      showToast(error instanceof Error ? error.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepLink = params.get('order');
    if (!deepLink) return;
    setInput(deepLink);
    void loadOrder(deepLink);
  }, []);

  const snapshot = order ? readOrderSnapshot(order.itemsJson) : null;
  const paymentDetails = snapshot ? studioAdminPaymentDetails(snapshot.payment) : null;

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-header">
        <div>
          <h2>Order lookup</h2>
          <p className="muted">Find a customer order by its full ID (for example VRN-…). Status can be updated here; everything else is read-only.</p>
        </div>
      </div>

      <form
        className="studio-order-lookup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadOrder(input);
        }}
      >
        <label>
          Order ID
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="VRN-…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {missing && (
        <div className="empty studio-order-lookup-empty" style={{ padding: '40px 20px' }}>
          <p>No order found</p>
          <span className="muted" style={{ fontSize: '12px' }}>
            {lookedUpId ? `Nothing matched ${lookedUpId}.` : 'Enter a full order ID and try again.'}
          </span>
        </div>
      )}

      {order && snapshot && (
        <div className="studio-order-lookup-result">
          <div className="studio-order-lookup-grid">
            <section>
              <h3>Customer</h3>
              <p><strong>{order.customerName}</strong></p>
              <p className="muted">{order.phone || 'No phone'}</p>
              <p className="muted">{order.email}</p>
            </section>
            <section>
              <h3>Shipping address</h3>
              <p>{shippingLines(order)}</p>
            </section>
            <section>
              <h3>Placed</h3>
              <p>{formatOrderCreatedAtIst(order.createdAt) || '—'}</p>
              <p className="muted">India Standard Time</p>
            </section>
          </div>

          <section>
            <h3>Items</h3>
            <div className="studio-order-items">
              {snapshot.items.map((item, idx) => {
                const product = products.find((entry) => entry.id === item.id);
                const name = studioOrderLineLabel(item, product);
                const cover = product
                  ? getProductCoverImage({ image: product.image, images: product.images || [] })
                  : null;
                return (
                  <div key={idx} className="studio-order-item">
                    {cover && (
                      <div className="studio-order-item-thumb studio-order-lookup-thumb">
                        <Image src={cover} alt={name} fill sizes="48px" style={{ objectFit: 'cover' }} unoptimized={needsUnoptimized(cover)} />
                      </div>
                    )}
                    <span>{name} × {item.qty}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Totals</h3>
            <p><strong>{money(order.total)}</strong></p>
            <OrderSavings pricing={snapshot.pricing} />
            {snapshot.pricing?.couponCode && (
              <p className="muted">Coupon {snapshot.pricing.couponCode}</p>
            )}
          </section>

          <section>
            <h3>Payment</h3>
            {paymentDetails && (
              <dl className="studio-order-payment-details">
                <div><dt>Status</dt><dd>{paymentDetails.status}</dd></div>
                {paymentDetails.provider && <div><dt>Method</dt><dd>{paymentDetails.provider}</dd></div>}
                {paymentDetails.paymentId && <div><dt>Razorpay payment ID</dt><dd>{paymentDetails.paymentId}</dd></div>}
                {paymentDetails.paidAt && <div><dt>Paid</dt><dd>{paymentDetails.paidAt}</dd></div>}
                {paymentDetails.note && <div><dt>Note</dt><dd>{paymentDetails.note}</dd></div>}
              </dl>
            )}
          </section>

          <section>
            <h3>Status</h3>
            <StudioOrderStatusEditor
              orderId={order.id}
              status={order.status}
              payment={snapshot.payment}
              adminFetch={adminFetch}
              onUpdated={() => {
                void loadOrder(order.id);
                onUpdated();
              }}
              onStatusChange={(status) => {
                setOrder((prev) => (prev ? { ...prev, status } : prev));
                onUpdated();
                showToast(`Order ${order.id} marked as ${status}`);
              }}
              onError={showToast}
            />
          </section>
        </div>
      )}
    </div>
  );
}
