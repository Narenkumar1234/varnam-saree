'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';
import { readOrderSnapshot } from '@/lib/pricing';
import { OrderSavings } from '@/components/OrderTotals';
import { StudioPayment } from '@/components/StudioPayment';
import { StudioCommerce } from '@/components/StudioCommerce';
import { createProductWhatsAppMessage, createSavedOrderWhatsAppMessage, openWhatsAppOrder } from '@/lib/whatsapp';

type AdminProduct = Omit<Product, 'stock' | 'tag'> & { stock: number; tag?: string | null };

interface AdminOrder {
  id: string;
  customerName: string;
  email: string;
  phone?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  total: number;
  status: string;
  itemsJson: string;
  createdAt: string;
}

const IMAGE_PRESETS = [
  { label: 'Emerald Pure Silk', value: '/assets/saree-emerald.webp' },
  { label: 'Rose Katan Banarasi', value: '/assets/saree-rose.webp' },
  { label: 'Indigo Silk-Cotton', value: '/assets/saree-indigo.webp' },
  { label: 'Ivory Raw Tussar', value: '/assets/saree-ivory.webp' },
  { label: 'Timeless Plum Portrait', value: '/assets/timeless-plum.webp' },
  { label: 'Heritage Weaves Collection', value: '/assets/sarees.webp' },
];

export default function StudioDeskPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'inventory' | 'add' | 'orders' | 'coupons' | 'settings'>('inventory');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // New Saree Form State
  const [newSaree, setNewSaree] = useState({
    name: '',
    type: 'Kanchipuram pure silk',
    collection: 'Silk',
    price: 7500,
    oldPrice: '',
    colour: 'Emerald',
    stock: 5,
    tag: 'Handloom certified',
    image: '/assets/saree-emerald.webp',
    description: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await adminFetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setNewSaree((prev) => ({ ...prev, image: data.url }));
        setUploadedPreview(data.url);
        showToast('Saree photo uploaded and optimized!');
      } else {
        showToast(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      showToast('Upload error');
    } finally {
      setUploadingImage(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const orderProductOnWhatsApp = (product: AdminProduct) => {
    if (product.stock <= 0) { showToast('This saree is sold out.'); return; }
    const message = createProductWhatsAppMessage(product, { includeProductLink: false });
    if (!openWhatsAppOrder(message)) showToast('WhatsApp ordering is currently unavailable.');
  };

  const confirmOrderOnWhatsApp = (order: AdminOrder) => {
    const snapshot = readOrderSnapshot(order.itemsJson);
    const message = createSavedOrderWhatsAppMessage(
      { ...order, ...snapshot }, products, window.location.origin
    );
    if (!openWhatsAppOrder(message)) showToast('WhatsApp ordering is currently unavailable.');
  };

  function clearAdminState() {
    setIsAuthenticated(false);
    setProducts([]);
    setOrders([]);
    setEditingProduct(null);
    setActiveTab('inventory');
    setLoginEmail('');
    setLoginPassword('');
  }

  async function adminFetch(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) {
      clearAdminState();
      setAuthError('Your Studio session has expired. Please sign in again.');
      throw new Error('Studio session expired');
    }
    return response;
  }

  // Only the server can restore access; a browser storage flag grants nothing.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/auth', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        setIsAuthenticated(response.ok && data.success === true);
        if (response.status === 503) setAuthError(data.error || 'Admin login is not configured.');
      })
      .catch(() => { if (!controller.signal.aborted) setAuthError('Unable to check Studio access. Please sign in again.'); })
      .finally(() => { if (!controller.signal.aborted) setCheckingSession(false); });
    return () => controller.abort();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes] = await Promise.all([
        adminFetch('/api/admin/products'),
        adminFetch('/api/admin/orders'),
      ]);
      if (!prodRes.ok || !orderRes.ok) throw new Error('Unable to load Studio data');
      const prodData = await prodRes.json();
      const orderData = await orderRes.json();

      if (prodData.products) setProducts(prodData.products);
      if (orderData.orders) setOrders(orderData.orders);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showToast('Could not fetch data from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setLoginPassword('');
        showToast('Authorized: Welcome to Studio Desk');
      } else {
        setAuthError(data.error || 'Access denied');
      }
    } catch (err) {
      setAuthError('Connection failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Sign out failed');
      clearAdminState();
      setAuthError('');
    } catch {
      showToast('Unable to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Inline Stock Update
  const updateStock = async (id: number, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: validStock } : p))
    );

    try {
      const res = await adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: validStock }),
      });
      if (res.ok) {
        showToast(`Stock updated to ${validStock} pieces`);
      } else {
        showToast('Failed to update stock in database');
      }
    } catch (err) {
      showToast('Failed to save stock change');
    }
  };

  // Inline Price Update
  const updatePrice = async (id: number, newPrice: number) => {
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p))
        );
        showToast(`Price updated to ${money(newPrice)}`);
      }
    } catch (err) {
      showToast('Failed to update price');
    }
  };

  // Save Full Product Edits (Price, Collection, Fabric Type, Tag, Stock, etc.)
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSavingEdit(true);
    try {
      const res = await adminFetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });
      const data = await res.json();
      if (res.ok && data.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data.product : p))
        );
        showToast(`Saved updates for "${editingProduct.name}"`);
        setEditingProduct(null);
      } else {
        showToast(data.error || 'Failed to update saree');
      }
    } catch (err) {
      showToast('Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Product
  const deleteProduct = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the store catalog?`)) {
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast(`Removed "${name}" from store`);
      }
    } catch (err) {
      showToast('Could not remove product');
    }
  };

  // Add Product Submit
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSaree),
      });
      const data = await res.json();

      if (res.ok && data.product) {
        setProducts((prev) => [data.product, ...prev]);
        showToast(`"${newSaree.name}" published to storefront`);
        setActiveTab('inventory');
        setNewSaree({
          name: '',
          type: 'Kanchipuram pure silk',
          collection: 'Silk',
          price: 7500,
          oldPrice: '',
          colour: 'Emerald',
          stock: 5,
          tag: 'Handloom certified',
          image: '/assets/saree-emerald.webp',
          description: '',
        });
      } else {
        showToast(data.error || 'Failed to add saree');
      }
    } catch (err) {
      showToast('Failed to connect to database');
    }
  };

  // Update Order Status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
        showToast(`Order ${orderId} marked as ${status}`);
      }
    } catch (err) {
      showToast('Failed to update status');
    }
  };

  // Metrics
  const totalStockPieces = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalRevenue = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 2).length;

  // LOGIN SCREEN
  if (checkingSession) {
    return <div className="admin-container"><div className="admin-login-card" role="status">Checking Studio access…</div></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <span className="admin-brand-mark">V</span>
            <h1>Varnam Studio Desk</h1>
            <p>Private management portal for inventory, catalog & dispatch</p>
          </div>

          <form onSubmit={handleLogin} className="admin-form">
            <label>
              Admin email
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter admin email"
                autoComplete="username"
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </label>

            {authError && <div className="admin-error-badge" role="alert">{authError}</div>}

            <button type="submit" className="btn" disabled={isLoggingIn} style={{ width: '100%', marginTop: '12px' }}>
              {isLoggingIn ? 'Verifying access…' : 'Enter Studio Desk'}
            </button>

          </form>
        </div>
      </div>
    );
  }

  // AUTHENTICATED DASHBOARD
  return (
    <div className="admin-container">
      {/* Toast Notification */}
      {toast && (
        <div className="admin-toast">
          <Icon name="check" size={16} /> {toast}
        </div>
      )}

      {/* Header Bar */}
      <header className="admin-topbar">
        <div>
          <span className="admin-badge">Studio Management</span>
          <h1 className="admin-title">Varnam Inventory & Dispatch</h1>
        </div>
        <div className="admin-topbar-actions">
          <Link href="/" className="btn outline" style={{ minHeight: '38px', padding: '8px 16px', fontSize: '12px' }}>
            View Storefront <Icon name="arrow-up-right" size={14} />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="btn outline"
            style={{ minHeight: '38px', padding: '8px 16px', fontSize: '12px' }}
          >
            {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="metric-label">Catalog Designs</span>
          <span className="metric-value">{products.length}</span>
          <span className="metric-sub">Active in store</span>
        </div>
        <div className="admin-metric-card">
          <span className="metric-label">Total Stock Units</span>
          <span className="metric-value">{totalStockPieces}</span>
          <span className="metric-sub">Physical pieces ready</span>
        </div>
        <div className="admin-metric-card">
          <span className="metric-label">Total Orders</span>
          <span className="metric-value">{orders.length}</span>
          <span className="metric-sub">{money(totalRevenue)} revenue</span>
        </div>
        <div className={`admin-metric-card ${lowStockCount > 0 ? 'alert' : ''}`}>
          <span className="metric-label">Low Stock Alerts</span>
          <span className="metric-value">{lowStockCount}</span>
          <span className="metric-sub">{lowStockCount > 0 ? '≤ 2 pieces left' : 'All well stocked'}</span>
        </div>
      </div>

      <datalist id="studio-collections">{[...new Set(products.map((product) => product.collection))].map((collection) => <option key={collection} value={collection} />)}</datalist>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={activeTab === 'inventory' ? 'active' : ''}
          onClick={() => setActiveTab('inventory')}
        >
          Sarees & Stock ({products.length})
        </button>
        <button
          type="button"
          className={activeTab === 'add' ? 'active' : ''}
          onClick={() => setActiveTab('add')}
        >
          + Add New Saree
        </button>
        <button
          type="button"
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Customer Orders ({orders.length})
        </button>
        <button type="button" className={activeTab === 'coupons' ? 'active' : ''} onClick={() => setActiveTab('coupons')}>Coupons</button>
        <button type="button" className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Site settings</button>
      </div>

      {(activeTab === 'coupons' || activeTab === 'settings') && <StudioCommerce key={activeTab} section={activeTab} adminFetch={adminFetch} />}

      {/* TAB 1: INVENTORY & CATALOG */}
      {activeTab === 'inventory' && (
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <div>
              <h2>Live Saree Catalog & Stock Control</h2>
              <p className="muted">Adjust quantity, price, or tags. Saved changes appear on the next storefront refresh. Open storefronts refresh their catalogue every 30 seconds.</p>
            </div>
            <button type="button" onClick={loadData} className="btn outline" style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="muted" style={{ padding: '30px', textAlign: 'center' }}>Loading products…</p>
          ) : products.length === 0 ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <p>No sarees found in database.</p>
              <button className="btn" type="button" onClick={() => setActiveTab('add')}>
                Add your first saree
              </button>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Saree</th>
                    <th>Collection / Fabric</th>
                    <th>Price</th>
                    <th>Stock / Units</th>
                    <th>Status</th>
                    <th>Tag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isSoldOut = p.stock <= 0;
                    const isLow = p.stock > 0 && p.stock <= 2;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="admin-prod-cell">
                            <div className="admin-thumb">
                              <Image src={p.image} alt={p.name} fill sizes="48px" style={{ objectFit: 'cover' }} />
                            </div>
                            <div>
                              <strong>{p.name}</strong>
                              <div className="muted" style={{ fontSize: '11px' }}>ID: #{p.id} · {p.colour}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span>{p.collection}</span>
                          <div className="muted" style={{ fontSize: '11px' }}>{p.type}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600 }}>{money(p.price)}</span>
                          </div>
                          {p.oldPrice && (
                            <span className="muted" style={{ fontSize: '10px', textDecoration: 'line-through' }}>
                              {money(p.oldPrice)}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="admin-stock-control">
                            <button
                              type="button"
                              className="stock-btn"
                              aria-label="Decrease stock"
                              onClick={() => updateStock(p.id, p.stock - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              className="stock-input"
                              value={p.stock}
                              onChange={(e) => updateStock(p.id, parseInt(e.target.value, 10) || 0)}
                            />
                            <button
                              type="button"
                              className="stock-btn"
                              aria-label="Increase stock"
                              onClick={() => updateStock(p.id, p.stock + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>
                          {isSoldOut ? (
                            <span className="status-pill sold-out">Sold Out</span>
                          ) : isLow ? (
                            <span className="status-pill low-stock">Low: {p.stock} left</span>
                          ) : (
                            <span className="status-pill in-stock">{p.stock} in stock</span>
                          )}
                        </td>
                        <td>
                          <span className="admin-tag-label">{p.tag || '—'}</span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="btn-edit"
                              onClick={() => setEditingProduct(p)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-delete"
                              title="Delete Saree"
                              onClick={() => deleteProduct(p.id, p.name)}
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              className="studio-whatsapp"
                              disabled={isSoldOut}
                              aria-label={`Order ${p.name} on WhatsApp`}
                              onClick={() => orderProductOnWhatsApp(p)}
                            >
                              <Icon name="whatsapp" size={16} /> Order on WhatsApp
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD NEW SAREE */}
      {activeTab === 'add' && (
        <div className="admin-panel-card" style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div className="admin-panel-header">
            <div>
              <h2>Add New Handcrafted Saree</h2>
              <p className="muted">Enter design details to publish directly to the live Varnam saree store.</p>
            </div>
          </div>

          <form onSubmit={handleAddProduct} className="admin-edit-form">
            <div className="admin-form-row">
              <label>
                Saree Title
                <input
                  type="text"
                  required
                  placeholder="e.g. Mayil royal peacock silk saree"
                  value={newSaree.name}
                  onChange={(e) => setNewSaree({ ...newSaree, name: e.target.value })}
                />
              </label>
            </div>

            <div className="admin-form-row two-col">
              <label>
                Collection
                <input required list="studio-collections" value={newSaree.collection} onChange={(e) => setNewSaree({ ...newSaree, collection: e.target.value })} placeholder="Choose or enter a collection" />
              </label>

              <label>
                Fabric / Weave Style
                <input
                  type="text"
                  required
                  placeholder="e.g. Kanchipuram pure silk"
                  value={newSaree.type}
                  onChange={(e) => setNewSaree({ ...newSaree, type: e.target.value })}
                />
              </label>
            </div>

            <div className="admin-form-row three-col">
              <label>
                Price (₹)
                <input
                  type="number"
                  required
                  min="500"
                  value={newSaree.price}
                  onChange={(e) => setNewSaree({ ...newSaree, price: parseInt(e.target.value, 10) || 0 })}
                />
              </label>

              <label>
                Original / Strike Price (Optional ₹)
                <input
                  type="number"
                  placeholder="Optional"
                  value={newSaree.oldPrice}
                  onChange={(e) => setNewSaree({ ...newSaree, oldPrice: e.target.value })}
                />
              </label>

              <label>
                Initial Stock Count
                <input
                  type="number"
                  required
                  min="0"
                  value={newSaree.stock}
                  onChange={(e) => setNewSaree({ ...newSaree, stock: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
            </div>

            <div className="admin-form-row two-col">
              <label>
                Primary Colour
                <select
                  value={newSaree.colour}
                  onChange={(e) => setNewSaree({ ...newSaree, colour: e.target.value })}
                >
                  <option value="Emerald">Emerald</option>
                  <option value="Rose">Rose</option>
                  <option value="Indigo">Indigo</option>
                  <option value="Ivory">Ivory</option>
                </select>
              </label>

              <label>
                Curated Tag / Badge
                <input
                  type="text"
                  placeholder="e.g. Master Weaver, Handloom certified"
                  value={newSaree.tag}
                  onChange={(e) => setNewSaree({ ...newSaree, tag: e.target.value })}
                />
              </label>
            </div>

            {/* Saree Image Upload & Cloud Storage */}
            <div className="admin-form-row">
              <label>
                Saree Photograph (Upload from Device or Cloud URL)
                <div className="admin-upload-zone">
                  <div className="admin-upload-controls">
                    <input
                      type="file"
                      id="sareeFileInput"
                      accept="image/png, image/jpeg, image/webp, image/heic"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                      disabled={uploadingImage}
                    />
                    <label htmlFor="sareeFileInput" className="btn outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}>
                      <Icon name="plus" size={14} />
                      {uploadingImage ? 'Processing & Optimizing Image…' : 'Upload Image from Phone / Computer'}
                    </label>
                    <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '6px' }}>
                      Automatically resizes & optimizes to lightweight WebP for fast mobile browsing.
                    </span>
                  </div>

                  {/* Active Preview */}
                  {newSaree.image && (
                    <div className="admin-upload-preview">
                      <div className="preview-thumb">
                        <Image src={newSaree.image} alt="Preview" fill sizes="80px" style={{ objectFit: 'cover' }} />
                      </div>
                      <div className="preview-info">
                        <strong>Active Photo URL:</strong>
                        <span className="muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{newSaree.image}</span>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="admin-form-row two-col">
              <label>
                Or Paste Cloud Storage / CDN Image URL
                <input
                  type="text"
                  placeholder="https://storage.googleapis.com/... or /uploads/..."
                  value={newSaree.image}
                  onChange={(e) => setNewSaree({ ...newSaree, image: e.target.value })}
                />
              </label>

              <label>
                Or Pick Preset Sample
                <select
                  value={newSaree.image}
                  onChange={(e) => setNewSaree({ ...newSaree, image: e.target.value })}
                >
                  {IMAGE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-form-row">
              <label>
                Saree Description / Story
                <textarea
                  rows={3}
                  placeholder="Handwoven by master artisans with pure zari border..."
                  value={newSaree.description}
                  onChange={(e) => setNewSaree({ ...newSaree, description: e.target.value })}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn" style={{ flex: 1 }}>
                Publish Saree to Live Store <Icon name="arrow-up-right" />
              </button>
              <button type="button" className="btn outline" onClick={() => setActiveTab('inventory')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CUSTOMER ORDERS */}
      {activeTab === 'orders' && (
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <div>
              <h2>Customer Orders & Dispatch Status</h2>
              <p className="muted">Pay securely with Razorpay, update delivery status, or confirm an order with Varnam on WhatsApp.</p>
            </div>
            <button type="button" onClick={loadData} className="btn outline" style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="muted" style={{ padding: '30px', textAlign: 'center' }}>Loading orders…</p>
          ) : orders.length === 0 ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <p>No orders recorded yet.</p>
              <span className="muted" style={{ fontSize: '12px' }}>Place a test order on the storefront to test live tracking.</span>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID & Date</th>
                    <th>Customer</th>
                    <th>Delivery Location</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const { items: parsedItems, pricing, payment } = readOrderSnapshot(o.itemsJson);

                    return (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.id}</strong>
                          <div className="muted" style={{ fontSize: '11px' }}>
                            {new Date(o.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td>
                          <strong>{o.customerName}</strong>
                          <div className="muted" style={{ fontSize: '11px' }}>{o.email}</div>
                          {o.phone && <div className="muted" style={{ fontSize: '11px' }}>{o.phone}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', maxWidth: '200px' }}>
                            {o.address}, {o.city}, {o.state} - {o.pincode}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            {parsedItems.map((item, idx) => (
                              <div key={idx} style={{ marginBottom: '4px' }}>
                                Product #{item.id} × {item.qty}
                                {item.finish && <span className="muted" style={{ fontSize: '10px' }}> ({item.finish})</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--ink)' }}>{money(o.total)}</strong>
                          <OrderSavings pricing={pricing} />
                        </td>
                        <td>
                          <select
                            className={`admin-status-select status-${(o.status || 'confirmed').toLowerCase().replace(/\s+/g, '-')}`}
                            value={o.status || 'Confirmed'}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Handloom Finishing">Handloom Finishing</option>
                            <option value="Dispatched">Dispatched</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                          <StudioPayment
                            orderId={o.id} total={o.total} customerName={o.customerName}
                            email={o.email} phone={o.phone} payment={payment}
                            cancelled={o.status?.toLowerCase() === 'cancelled'} onPaid={loadData}
                          />
                          <button
                            type="button"
                            className="studio-whatsapp order-whatsapp-action"
                            aria-label={`Confirm order ${o.id} on WhatsApp`}
                            title="Review the pre-filled message with Varnam on WhatsApp"
                            onClick={() => confirmOrderOnWhatsApp(o)}
                          >
                            <Icon name="whatsapp" size={16} /> Confirm on WhatsApp
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EDIT SAREE MODAL */}
      {editingProduct && (
        <div className="admin-modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>Edit Saree Details</h2>
                <span className="muted" style={{ fontSize: '12px' }}>ID #{editingProduct.id} · Saved in the store database</span>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setEditingProduct(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSave} className="admin-edit-form">
              <div className="admin-form-row">
                <label>
                  Saree Name
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-form-row two-col">
                <label>
                  Collection
                  <input required list="studio-collections" value={editingProduct.collection} onChange={(e) => setEditingProduct({ ...editingProduct, collection: e.target.value })} placeholder="Choose or enter a collection" />
                </label>

                <label>
                  Fabric / Weave Style
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kanchipuram pure silk"
                    value={editingProduct.type}
                    onChange={(e) => setEditingProduct({ ...editingProduct, type: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-form-row three-col">
                <label>
                  Price (₹)
                  <input
                    type="number"
                    required
                    min="100"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value, 10) || 0 })}
                  />
                </label>

                <label>
                  Strike-through Price (₹)
                  <input
                    type="number"
                    placeholder="Optional"
                    value={editingProduct.oldPrice || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        oldPrice: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                  />
                </label>

                <label>
                  Available Stock Pieces
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                  />
                </label>
              </div>

              <div className="admin-form-row two-col">
                <label>
                  Primary Colour
                  <select
                    value={editingProduct.colour}
                    onChange={(e) => setEditingProduct({ ...editingProduct, colour: e.target.value })}
                  >
                    <option value="Emerald">Emerald</option>
                    <option value="Rose">Rose</option>
                    <option value="Indigo">Indigo</option>
                    <option value="Ivory">Ivory</option>
                  </select>
                </label>

                <label>
                  Curated Tag / Badge
                  <input
                    type="text"
                    placeholder="e.g. Bestseller, Limited edition, Handloom certified"
                    value={editingProduct.tag || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, tag: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-form-row">
                <label>
                  Photo URL / CDN Path
                  <input
                    type="text"
                    value={editingProduct.image}
                    onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-form-row">
                <label>
                  Weave Description / Story
                  <textarea
                    rows={3}
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="submit" className="btn" disabled={isSavingEdit} style={{ flex: 1 }}>
                  {isSavingEdit ? 'Saving Changes…' : 'Save Changes'}
                </button>
                <button type="button" className="btn outline" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
