'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';

interface AdminProduct {
  id: number;
  name: string;
  type: string;
  collection: string;
  price: number;
  oldPrice?: number | null;
  colour: string;
  stock: number;
  tag?: string | null;
  image: string;
  description?: string | null;
}

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
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'inventory' | 'add' | 'orders'>('inventory');
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
      const res = await fetch('/api/admin/upload', {
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

  // Check existing session
  useEffect(() => {
    const session = sessionStorage.getItem('varnam_studio_auth');
    if (session === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/orders'),
      ]);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim(), email: passcode.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('varnam_studio_auth', 'true');
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('varnam_studio_auth');
  };

  // Inline Stock Update
  const updateStock = async (id: number, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: validStock } : p))
    );

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
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
      const res = await fetch(`/api/admin/products/${id}`, {
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
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
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
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
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
      const res = await fetch('/api/admin/products', {
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
      const res = await fetch(`/api/admin/orders/${orderId}`, {
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
  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <span className="admin-brand-mark">V</span>
            <h1>Boutique Studio Desk</h1>
            <p>Private management portal for inventory, catalog & dispatch</p>
          </div>

          <form onSubmit={handleLogin} className="admin-form">
            <label>
              Studio Access Passcode or Admin Email
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode or admin email"
                autoFocus
              />
            </label>

            {authError && <div className="admin-error-badge">{authError}</div>}

            <button type="submit" className="btn" disabled={isLoggingIn} style={{ width: '100%', marginTop: '12px' }}>
              {isLoggingIn ? 'Verifying access…' : 'Enter Studio Desk'}
            </button>

            <div className="admin-login-hint">
              Default passcode: <code>varnam2026</code> or your admin email
            </div>
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
            className="btn outline"
            style={{ minHeight: '38px', padding: '8px 16px', fontSize: '12px' }}
          >
            Sign out
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
      </div>

      {/* TAB 1: INVENTORY & CATALOG */}
      {activeTab === 'inventory' && (
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <div>
              <h2>Live Saree Catalog & Stock Control</h2>
              <p className="muted">Adjust quantity, price, or tags. Updates sync to the live store immediately.</p>
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
                          <div style={{ display: 'flex', gap: '6px' }}>
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
              <p className="muted">Enter design details to publish directly to the live Varnam boutique.</p>
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
                <select
                  value={newSaree.collection}
                  onChange={(e) => setNewSaree({ ...newSaree, collection: e.target.value })}
                >
                  <option value="Silk">Silk</option>
                  <option value="Cotton">Cotton</option>
                  <option value="Festive">Festive</option>
                </select>
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
              <p className="muted">Orders saved in Cloud SQL. Update delivery status to notify customers on their tracking screen.</p>
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
                    let parsedItems: any[] = [];
                    try {
                      parsedItems = JSON.parse(o.itemsJson || '[]');
                    } catch (e) {
                      parsedItems = [];
                    }

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
                <span className="muted" style={{ fontSize: '12px' }}>ID #{editingProduct.id} · Cloud SQL Synchronized</span>
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
                  <select
                    value={editingProduct.collection}
                    onChange={(e) => setEditingProduct({ ...editingProduct, collection: e.target.value })}
                  >
                    <option value="Silk">Silk</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Festive">Festive</option>
                  </select>
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
