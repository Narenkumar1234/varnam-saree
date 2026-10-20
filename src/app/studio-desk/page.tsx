'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types';
import { money, capitalizeColour } from '@/data/products';
import { Icon } from '@/components/Icons';
import { readOrderSnapshot } from '@/lib/pricing';
import { OrderSavings } from '@/components/OrderTotals';
import { StudioPayment } from '@/components/StudioPayment';
import { StudioCommerce } from '@/components/StudioCommerce';
import { createSavedOrderWhatsAppMessage } from '@/lib/whatsapp';
import { useStore } from '@/context/store-context';
import { needsUnoptimized } from '@/lib/image-loader';

type AdminProductVariant = { name: string; colour?: string; images: string[] };
type AdminProduct = Omit<Product, 'stock' | 'tag'> & {
  stock: number;
  tag?: string | null;
  images?: string[];
  variants?: AdminProductVariant[];
  discountPercentage?: number | string;
};

function parseProductImages(images: any, fallbackImage?: string): string[] {
  if (Array.isArray(images)) {
    const list = images.filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:'));
    if (list.length > 0) return list.slice(0, 3);
  } else if (typeof images === 'string' && images.trim().length > 0) {
    try {
      if (images.trim().startsWith('[')) {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          const list = parsed.filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:'));
          if (list.length > 0) return list.slice(0, 3);
        }
      } else {
        const list = images.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s) && !s.startsWith('blob:'));
        if (list.length > 0) return list.slice(0, 3);
      }
    } catch {
      // ignore
    }
  }
  return fallbackImage && !fallbackImage.startsWith('blob:') ? [fallbackImage] : [];
}

function parseProductVariants(variants: any): AdminProductVariant[] {
  if (Array.isArray(variants)) {
    return variants
      .filter((v) => v && typeof v === 'object' && (v.name || v.colour))
      .map((v) => ({
        name: String(v.name || v.colour || '').trim(),
        colour: String(v.colour || v.name || '').trim(),
        images: Array.isArray(v.images)
          ? v.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3)
          : [],
      }));
  } else if (typeof variants === 'string' && variants.trim().length > 0) {
    try {
      const parsed = JSON.parse(variants);
      if (Array.isArray(parsed)) {
        return parseProductVariants(parsed);
      }
    } catch {
      // ignore
    }
  }
  return [];
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

function VariantImageManager({
  variant,
  variantIndex,
  onUpdateVariant,
  onRemoveVariant,
  onUploadPhoto,
  uploadingTarget,
  targetPrefix,
  onUrlError,
}: {
  variant: AdminProductVariant;
  variantIndex: number;
  onUpdateVariant: (updated: AdminProductVariant) => void;
  onRemoveVariant: () => void;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>, imgIndex: number, varIndex: number) => void;
  uploadingTarget: any;
  targetPrefix: 'new-variant' | 'edit-variant';
  onUrlError: (error: string | null) => void;
}) {
  const images = (variant.images && variant.images.length > 0) ? variant.images.slice(0, 3) : ['/assets/saree-emerald.webp'];
  
  const validateUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      return 'Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.';
    }
    return null;
  };

  return (
    <div style={{ padding: '12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', background: '#fff', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        <input
          type="text"
          placeholder="Colour variant name (e.g. Ruby Red, Mustard Yellow)"
          value={variant.name}
          onChange={(e) => onUpdateVariant({ ...variant, name: e.target.value, colour: e.target.value })}
          style={{ fontWeight: 600, fontSize: '13px', padding: '6px 10px', flex: 1 }}
        />
        <button
          type="button"
          className="btn outline"
          style={{ fontSize: '11px', padding: '5px 8px', color: '#b91c1c', borderColor: '#fca5a5' }}
          onClick={onRemoveVariant}
        >
          Remove Variant
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {images.map((imgUrl, idx) => {
          const isUploadingThis = uploadingTarget?.target === targetPrefix && uploadingTarget?.variantIndex === variantIndex && uploadingTarget?.index === idx;
          return (
            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#faf8f5', padding: '8px', borderRadius: '4px' }}>
              <div style={{ width: '40px', height: '50px', position: 'relative', overflow: 'hidden', borderRadius: '2px', backgroundColor: '#e5dfd4', flexShrink: 0 }}>
                <img src={imgUrl} alt={`Variant photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="file"
                    id={`${targetPrefix}-${variantIndex}-photo-${idx}`}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={(e) => onUploadPhoto(e, idx, variantIndex)}
                    disabled={isUploadingThis}
                  />
                  <label
                    htmlFor={`${targetPrefix}-${variantIndex}-photo-${idx}`}
                    className="btn outline"
                    style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '11px' }}
                  >
                    {isUploadingThis ? 'Optimizing…' : 'Upload Photo'}
                  </label>
                  <select
                    value={IMAGE_PRESETS.some((p) => p.value === imgUrl) ? imgUrl : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const updated = [...images];
                        updated[idx] = e.target.value;
                        onUpdateVariant({ ...variant, images: updated });
                      }
                    }}
                    style={{ fontSize: '11px', padding: '3px 6px' }}
                  >
                    <option value="">Preset sample…</option>
                    {IMAGE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                  {images.length > 1 && (
                    <button
                      type="button"
                      className="btn outline"
                      style={{ fontSize: '11px', padding: '3px 6px' }}
                      onClick={() => {
                        const updated = images.filter((_, i) => i !== idx);
                        onUpdateVariant({ ...variant, images: updated });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={imgUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    const error = validateUrl(url);
                    onUrlError(error);
                    const updated = [...images];
                    updated[idx] = url;
                    onUpdateVariant({ ...variant, images: updated });
                  }}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                />
              </div>
            </div>
          );
        })}

        {images.length < 3 && (
          <button
            type="button"
            className="btn outline"
            onClick={() => {
              const nextPreset = IMAGE_PRESETS[images.length]?.value || '/assets/saree-rose.webp';
              onUpdateVariant({ ...variant, images: [...images, nextPreset] });
            }}
            style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '4px 10px', marginTop: '2px' }}
          >
            <Icon name="plus" size={11} /> Add Variant Photo ({images.length}/3)
          </button>
        )}
      </div>
    </div>
  );
}

export default function StudioDeskPage() {
  const { openWhatsAppMessage, clearWhatsAppFallback } = useStore();
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const stockDebounceTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // New Saree Form State
  const [newSaree, setNewSaree] = useState({
    name: '',
    type: '',
    collection: '',
    price: 0,
    oldPrice: '',
    discountPercentage: '',
    colour: '',
    stock: 0,
    tag: '',
    image: '',
    images: [] as string[],
    variants: [] as AdminProductVariant[],
    description: '',
  });

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<
    | { target: 'new' | 'edit'; index?: number }
    | { target: 'new-variant' | 'edit-variant'; variantIndex: number; index?: number }
    | null
  >(null);

  const validateImageUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      return 'Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.';
    }
    return null;
  };

  const hasInvalidImageUrls = (images: string[], variants: AdminProductVariant[]): boolean => {
    const allImages = [...images];
    for (const variant of variants) {
      allImages.push(...(variant.images || []));
    }
    return allImages.some(img => img.trim().startsWith('blob:') || img.trim().startsWith('data:'));
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/webp',
          0.8
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit' | 'new-variant' | 'edit-variant' = 'new',
    index?: number,
    variantIndex?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (target === 'new-variant' || target === 'edit-variant') {
      setUploadingTarget({ target, variantIndex: variantIndex ?? 0, index });
    } else {
      setUploadingTarget({ target, index });
    }

    let processedFile = file;
    try {
      processedFile = await compressImage(file);
    } catch (compressionError) {
      console.warn('Client-side compression failed, uploading original:', compressionError);
    }

    const formData = new FormData();
    formData.append('file', processedFile);

    try {
      const res = await adminFetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { error: `Server error (${res.status})` };
      }

      if (res.ok && data.url) {
        if (target === 'new') {
          setNewSaree((prev) => {
            const list = [...(prev.images || [prev.image])];
            if (index !== undefined && index < list.length) {
              list[index] = data.url;
            } else if (list.length < 3) {
              list.push(data.url);
            }
            return { ...prev, images: list, image: list[0] };
          });
          setUploadedPreview(data.url);
        } else if (target === 'edit') {
          setEditingProduct((prev) => {
            if (!prev) return null;
            const list = [...(prev.images || [prev.image])];
            if (index !== undefined && index < list.length) {
              list[index] = data.url;
            } else if (list.length < 3) {
              list.push(data.url);
            }
            return { ...prev, images: list, image: list[0] };
          });
        } else if (target === 'new-variant' && variantIndex !== undefined) {
          setNewSaree((prev) => {
            const vars = [...(prev.variants || [])];
            if (vars[variantIndex]) {
              const list = [...(vars[variantIndex].images || [])];
              if (index !== undefined && index < list.length) {
                list[index] = data.url;
              } else if (list.length < 3) {
                list.push(data.url);
              }
              vars[variantIndex] = { ...vars[variantIndex], images: list };
            }
            return { ...prev, variants: vars };
          });
        } else if (target === 'edit-variant' && variantIndex !== undefined) {
          setEditingProduct((prev) => {
            if (!prev) return null;
            const vars = [...(prev.variants || [])];
            if (vars[variantIndex]) {
              const list = [...(vars[variantIndex].images || [])];
              if (index !== undefined && index < list.length) {
                list[index] = data.url;
              } else if (list.length < 3) {
                list.push(data.url);
              }
              vars[variantIndex] = { ...vars[variantIndex], images: list };
            }
            return { ...prev, variants: vars };
          });
        }
        showToast('Saree photo uploaded and optimized!');
      } else {
        const err = data.error || 'Failed to process photo';
        setUploadError(err);
        showToast(err);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      const msg = err?.message || 'Upload error';
      setUploadError(msg);
      showToast(msg);
    } finally {
      setUploadingTarget(null);
      e.target.value = '';
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const confirmOrderOnWhatsApp = (order: AdminOrder) => {
    const snapshot = readOrderSnapshot(order.itemsJson);
    const message = createSavedOrderWhatsAppMessage(
      { ...order, ...snapshot }, products, window.location.origin
    );
    openWhatsAppMessage(message);
  };

  function clearAdminState() {
    clearWhatsAppFallback();
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

      if (prodData.products) {
        setProducts(
          prodData.products.map((p: any) => ({
            ...p,
            images: parseProductImages(p.images, p.image),
            variants: parseProductVariants(p.variants),
          }))
        );
      }
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
  // Inline Stock Update (Debounced by 400ms to batch rapid + / - clicks)
  const updateStock = (id: number, newStock: number) => {
    const validStock = Math.max(0, newStock);
    // Optimistic UI update immediately
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: validStock } : p))
    );

    const existingTimer = stockDebounceTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: validStock }),
        });
        if (res.ok) {
          showToast(`Stock saved: ${validStock} pieces`);
        } else {
          showToast('Failed to update stock in database');
        }
      } catch {
        showToast('Failed to save stock change');
      } finally {
        stockDebounceTimers.current.delete(id);
      }
    }, 400);

    stockDebounceTimers.current.set(id, timer);
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
    if (uploadingTarget !== null) {
      showToast('Please wait for photo upload to finish.');
      return;
    }
    if (hasInvalidImageUrls(editingProduct.images || [editingProduct.image || ''], editingProduct.variants || [])) {
      setUploadError('Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.');
      showToast('Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const cleanImages = (editingProduct.images && editingProduct.images.length > 0)
        ? editingProduct.images.filter((img) => !img.startsWith('blob:') && !img.startsWith('data:')).slice(0, 3)
        : (editingProduct.image && !editingProduct.image.startsWith('blob:') && !editingProduct.image.startsWith('data:') ? [editingProduct.image] : []);
      const cleanVariants = (editingProduct.variants || []).map((v) => ({
        name: v.name.trim(),
        colour: (v.colour || v.name).trim(),
        images: (v.images || []).filter((img) => !img.startsWith('blob:') && !img.startsWith('data:')).slice(0, 3),
      })).filter((v) => v.name.length > 0);
      const payload = {
        ...editingProduct,
        images: cleanImages,
        image: cleanImages[0] || (editingProduct.image && !editingProduct.image.startsWith('blob:') ? editingProduct.image : '/assets/saree-emerald.webp'),
        variants: cleanVariants,
        discountPercentage: editingProduct.discountPercentage !== undefined && editingProduct.discountPercentage !== ''
          ? parseInt(String(editingProduct.discountPercentage), 10)
          : (editingProduct.discountPercentage === '' ? 0 : undefined),
      };
      const res = await adminFetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.product) {
        const parsedProduct = {
          ...data.product,
          images: parseProductImages(data.product.images, data.product.image),
          variants: parseProductVariants(data.product.variants),
        };
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? parsedProduct : p))
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

  // Delete Product with in-flight guard
  const deleteProduct = async (id: number, name: string) => {
    if (deletingId !== null) return;
    if (!confirm(`Are you sure you want to remove "${name}" from the store catalog?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast(`Removed "${name}" from store`);
      }
    } catch {
      showToast('Could not remove product');
    } finally {
      setDeletingId(null);
    }
  };

  // Add Product Submit with in-flight guard and blob URL check
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingProduct) return;
    if (uploadingTarget !== null) {
      showToast('Please wait for photo upload to finish.');
      return;
    }
    if (hasInvalidImageUrls([...(newSaree.images || []), newSaree.image].filter(Boolean), newSaree.variants || [])) {
      setUploadError('Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.');
      showToast('Please upload the file or paste a permanent image URL. Browser previews (blob: or data:) cannot be saved.');
      return;
    }

    setIsAddingProduct(true);
    try {
      const cleanImages = (newSaree.images && newSaree.images.length > 0)
        ? newSaree.images.filter((img) => !img.startsWith('blob:') && !img.startsWith('data:')).slice(0, 3)
        : (newSaree.image && !newSaree.image.startsWith('blob:') && !newSaree.image.startsWith('data:') ? [newSaree.image] : []);
      const cleanVariants = (newSaree.variants || []).map((v) => ({
        name: v.name.trim(),
        colour: (v.colour || v.name).trim(),
        images: (v.images || []).filter((img) => !img.startsWith('blob:') && !img.startsWith('data:')).slice(0, 3),
      })).filter((v) => v.name.length > 0);
      const payload = {
        ...newSaree,
        images: cleanImages,
        image: cleanImages[0] || (newSaree.image && !newSaree.image.startsWith('blob:') ? newSaree.image : '/assets/saree-emerald.webp'),
        variants: cleanVariants,
        discountPercentage: newSaree.discountPercentage !== '' ? parseInt(String(newSaree.discountPercentage), 10) : undefined,
      };
      const res = await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.product) {
        const parsedProduct = {
          ...data.product,
          images: parseProductImages(data.product.images, data.product.image),
          variants: parseProductVariants(data.product.variants),
        };
        setProducts((prev) => [parsedProduct, ...prev]);
        showToast(`"${newSaree.name}" published to storefront`);
        setActiveTab('inventory');
        setNewSaree({
          name: '',
          type: '',
          collection: '',
          price: 0,
          oldPrice: '',
          discountPercentage: '',
          colour: '',
          stock: 0,
          tag: '',
          image: '',
          images: [],
          variants: [],
          description: '',
        });
      } else {
        showToast(data.error || 'Failed to add saree');
      }
    } catch {
      showToast('Failed to connect to database');
    } finally {
      setIsAddingProduct(false);
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
                              <Image src={p.image} alt={p.name} fill sizes="48px" style={{ objectFit: 'cover' }} unoptimized={needsUnoptimized(p.image)} />
                            </div>
                            <div>
                              <strong>{p.name}</strong>
                              <div className="muted" style={{ fontSize: '11px' }}>ID: #{p.id} · {capitalizeColour(p.colour)}</div>
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
                              onClick={() => {
                                const images = parseProductImages(p.images, p.image);
                                const variants = parseProductVariants(p.variants);
                                const initialDisc = p.oldPrice && p.oldPrice > p.price
                                  ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
                                  : '';
                                setEditingProduct({
                                  ...p,
                                  images,
                                  variants,
                                  image: images[0] || p.image,
                                  discountPercentage: initialDisc,
                                });
                              }}
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

            <div className="admin-form-row four-col">
              <label>
                Price (₹)
                <input
                  type="number"
                  required
                  min="100"
                  value={newSaree.price}
                  onChange={(e) => {
                    const price = parseInt(e.target.value, 10) || 0;
                    const oldPriceNum = parseInt(newSaree.oldPrice, 10);
                    const disc = oldPriceNum && oldPriceNum > price
                      ? Math.round(((oldPriceNum - price) / oldPriceNum) * 100)
                      : (newSaree.discountPercentage || '');
                    setNewSaree({ ...newSaree, price, discountPercentage: String(disc || '') });
                  }}
                />
              </label>

              <label>
                Original / Strike Price (Optional ₹)
                <input
                  type="number"
                  placeholder="Optional"
                  value={newSaree.oldPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    const oldPriceNum = parseInt(val, 10);
                    const disc = oldPriceNum && oldPriceNum > newSaree.price
                      ? Math.round(((oldPriceNum - newSaree.price) / oldPriceNum) * 100)
                      : '';
                    setNewSaree({ ...newSaree, oldPrice: val, discountPercentage: String(disc || '') });
                  }}
                />
              </label>

              <label>
                Discount (% off, optional)
                <input
                  type="number"
                  min="0"
                  max="99"
                  placeholder="e.g. 50"
                  value={newSaree.discountPercentage}
                  onChange={(e) => {
                    const val = e.target.value;
                    const disc = parseInt(val, 10);
                    if (!isNaN(disc) && disc > 0 && disc < 100) {
                      const oldPriceNum = parseInt(newSaree.oldPrice, 10);
                      if (oldPriceNum) {
                        const newPrice = Math.max(1, Math.round(oldPriceNum * (1 - disc / 100)));
                        setNewSaree({ ...newSaree, discountPercentage: val, price: newPrice });
                      } else if (newSaree.price) {
                        const calculatedOldPrice = Math.round(newSaree.price / (1 - disc / 100));
                        setNewSaree({ ...newSaree, discountPercentage: val, oldPrice: String(calculatedOldPrice) });
                      } else {
                        setNewSaree({ ...newSaree, discountPercentage: val });
                      }
                    } else {
                      setNewSaree({ ...newSaree, discountPercentage: val });
                    }
                  }}
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
                <input
                  type="text"
                  required
                  placeholder="e.g. Emerald, Crimson, Indigo"
                  value={newSaree.colour}
                  onChange={(e) => setNewSaree({ ...newSaree, colour: e.target.value })}
                />
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

            {/* Saree Images Manager (Up to 3) */}
            <div className="admin-form-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                  Saree Photographs ({newSaree.images.length} of 3)
                </span>
                <span className="muted" style={{ fontSize: '11px' }}>
                  Photo 1 is the primary cover image. You can add up to 3 photos.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {newSaree.images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border, rgba(0,0,0,0.12))',
                      borderRadius: '4px',
                      padding: '12px',
                      background: 'var(--card-bg, #faf8f5)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>
                        {idx === 0 ? 'Cover Photo (Primary)' : `Additional Photo ${idx + 1}`}
                      </span>
                      {newSaree.images.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newSaree.images.filter((_, i) => i !== idx);
                            setNewSaree({ ...newSaree, images: updated, image: updated[0] || '' });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#a03232',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '64px',
                          height: '80px',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          backgroundColor: '#e5dfd4',
                          flexShrink: 0,
                        }}
                      >
                        <Image
                          src={imgUrl || '/assets/saree-emerald.webp'}
                          alt={`Saree Photo ${idx + 1}`}
                          fill
                          sizes="64px"
                          style={{ objectFit: 'cover' }}
                          unoptimized={needsUnoptimized(imgUrl)}
                        />
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            id={`add-photo-file-${idx}`}
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(e, 'new', idx)}
                            disabled={uploadingTarget?.target === 'new' && uploadingTarget?.index === idx}
                          />
                          <label
                            htmlFor={`add-photo-file-${idx}`}
                            className="btn outline"
                            style={{
                              cursor: 'pointer',
                              padding: '5px 12px',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Icon name="upload" size={12} />
                            {uploadingTarget?.target === 'new' && uploadingTarget?.index === idx
                              ? 'Optimizing…'
                              : 'Upload Photo'}
                          </label>

                          <select
                            value={IMAGE_PRESETS.some((p) => p.value === imgUrl) ? imgUrl : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                const updated = [...newSaree.images];
                                updated[idx] = e.target.value;
                                setNewSaree({ ...newSaree, images: updated, image: updated[0] });
                              }
                            }}
                            style={{ fontSize: '12px', padding: '5px 8px', maxWidth: '200px' }}
                          >
                            <option value="">Choose preset sample…</option>
                            {IMAGE_PRESETS.map((preset) => (
                              <option key={preset.value} value={preset.value}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                        </div>

                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={imgUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    const error = validateImageUrl(url);
                    if (error) {
                      setUploadError(error);
                    } else {
                      setUploadError(null);
                    }
                    const updated = [...newSaree.images];
                    updated[idx] = url;
                    setNewSaree({ ...newSaree, images: updated, image: updated[0] });
                  }}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                />
                      </div>
                    </div>
                  </div>
                ))}

                {newSaree.images.length < 3 && (
                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      if (newSaree.images.length < 3) {
                        const nextPreset = IMAGE_PRESETS[newSaree.images.length]?.value || '/assets/saree-rose.webp';
                        const updated = [...newSaree.images, nextPreset];
                        setNewSaree({ ...newSaree, images: updated, image: updated[0] });
                      }
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      padding: '7px 14px',
                      marginTop: '4px',
                    }}
                  >
                    <Icon name="plus" size={13} /> Add Photo ({newSaree.images.length}/3)
                  </button>
                )}
              </div>
            </div>

            {/* Colour Variants Manager */}
            <div style={{ marginTop: '16px', marginBottom: '16px', padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', background: '#faf8f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Colour Variants (Optional)</h4>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    Each variant has its own colour name and up to 3 photos.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn outline"
                  style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    const current = newSaree.variants || [];
                    setNewSaree({
                      ...newSaree,
                      variants: [...current, { name: '', colour: '', images: ['/assets/saree-rose.webp'] }],
                    });
                  }}
                >
                  <Icon name="plus" size={12} /> Add Colour Variant
                </button>
              </div>

              {(newSaree.variants || []).map((variant, vIdx) => (
                <VariantImageManager
                  key={vIdx}
                  variant={variant}
                  variantIndex={vIdx}
                  targetPrefix="new-variant"
                  uploadingTarget={uploadingTarget}
                  onUpdateVariant={(updated) => {
                    const vars = [...(newSaree.variants || [])];
                    vars[vIdx] = updated;
                    setNewSaree({ ...newSaree, variants: vars });
                  }}
                  onRemoveVariant={() => {
                    const vars = (newSaree.variants || []).filter((_, i) => i !== vIdx);
                    setNewSaree({ ...newSaree, variants: vars });
                  }}
                  onUploadPhoto={(e, imgIdx, varIdx) => handleFileUpload(e, 'new-variant', imgIdx, varIdx)}
                  onUrlError={setUploadError}
                />
              ))}
              {(!newSaree.variants || newSaree.variants.length === 0) && (
                <p className="muted" style={{ fontSize: '12px', margin: 0 }}>No variants added. This saree will be published as a single colour ({newSaree.colour}).</p>
              )}
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

            {uploadError && <p className="admin-error-badge" role="alert" style={{ marginBottom: '12px' }}>{uploadError}</p>}
            {uploadingTarget !== null && <p className="muted" style={{ fontSize: '12px', marginBottom: '8px' }}>Photo upload in flight… please wait.</p>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn" disabled={isAddingProduct || uploadingTarget !== null} style={{ flex: 1 }}>
                {uploadingTarget !== null ? 'Uploading Photo…' : isAddingProduct ? 'Publishing…' : 'Publish Saree to Live Store'} <Icon name="arrow-up-right" />
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

              <div className="admin-form-row four-col">
                <label>
                  Price (₹)
                  <input
                    type="number"
                    required
                    min="100"
                    value={editingProduct.price}
                    onChange={(e) => {
                      const price = parseInt(e.target.value, 10) || 0;
                      const oldPriceNum = editingProduct.oldPrice || 0;
                      const disc = oldPriceNum && oldPriceNum > price
                        ? Math.round(((oldPriceNum - price) / oldPriceNum) * 100)
                        : (editingProduct.discountPercentage || '');
                      setEditingProduct({ ...editingProduct, price, discountPercentage: disc });
                    }}
                  />
                </label>

                <label>
                  Strike-through Price (₹)
                  <input
                    type="number"
                    placeholder="Optional"
                    value={editingProduct.oldPrice || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      const disc = val && val > editingProduct.price
                        ? Math.round(((val - editingProduct.price) / val) * 100)
                        : '';
                      setEditingProduct({ ...editingProduct, oldPrice: val, discountPercentage: disc });
                    }}
                  />
                </label>

                <label>
                  Discount (% off, optional)
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="e.g. 50"
                    value={editingProduct.discountPercentage ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const disc = parseInt(val, 10);
                      if (!isNaN(disc) && disc > 0 && disc < 100) {
                        const oldPriceNum = editingProduct.oldPrice;
                        if (oldPriceNum) {
                          const newPrice = Math.max(1, Math.round(oldPriceNum * (1 - disc / 100)));
                          setEditingProduct({ ...editingProduct, discountPercentage: disc, price: newPrice });
                        } else if (editingProduct.price) {
                          const calculatedOldPrice = Math.round(editingProduct.price / (1 - disc / 100));
                          setEditingProduct({ ...editingProduct, discountPercentage: disc, oldPrice: calculatedOldPrice });
                        } else {
                          setEditingProduct({ ...editingProduct, discountPercentage: disc });
                        }
                      } else {
                        setEditingProduct({ ...editingProduct, discountPercentage: val === '' ? '' : 0 });
                      }
                    }}
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
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emerald, Crimson, Indigo"
                    value={editingProduct.colour}
                    onChange={(e) => setEditingProduct({ ...editingProduct, colour: e.target.value })}
                  />
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

              {/* Saree Images Manager (Up to 3) */}
              <div className="admin-form-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                    Saree Photographs ({(editingProduct.images || [editingProduct.image]).length} of 3)
                  </span>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    Photo 1 is the primary cover image. You can add up to 3 photos.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(editingProduct.images || [editingProduct.image]).map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--border, rgba(0,0,0,0.12))',
                        borderRadius: '4px',
                        padding: '10px',
                        background: 'var(--card-bg, #faf8f5)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>
                          {idx === 0 ? 'Cover Photo (Primary)' : `Additional Photo ${idx + 1}`}
                        </span>
                        {(editingProduct.images || [editingProduct.image]).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentList = editingProduct.images || [editingProduct.image];
                              const updated = currentList.filter((_, i) => i !== idx);
                              setEditingProduct({
                                ...editingProduct,
                                images: updated,
                                image: updated[0] || '',
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#a03232',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div
                          style={{
                            position: 'relative',
                            width: '56px',
                            height: '70px',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            backgroundColor: '#e5dfd4',
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={imgUrl || '/assets/saree-emerald.webp'}
                            alt={`Edit Saree Photo ${idx + 1}`}
                            fill
                            sizes="56px"
                            style={{ objectFit: 'cover' }}
                            unoptimized={needsUnoptimized(imgUrl)}
                          />
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="file"
                              id={`edit-photo-file-${idx}`}
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleFileUpload(e, 'edit', idx)}
                              disabled={uploadingTarget?.target === 'edit' && uploadingTarget?.index === idx}
                            />
                            <label
                              htmlFor={`edit-photo-file-${idx}`}
                              className="btn outline"
                              style={{
                                cursor: 'pointer',
                                padding: '4px 10px',
                                fontSize: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Icon name="upload" size={12} />
                              {uploadingTarget?.target === 'edit' && uploadingTarget?.index === idx
                                ? 'Optimizing…'
                                : 'Upload Photo'}
                            </label>

                            <select
                              value={IMAGE_PRESETS.some((p) => p.value === imgUrl) ? imgUrl : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const currentList = [...(editingProduct.images || [editingProduct.image])];
                                  currentList[idx] = e.target.value;
                                  setEditingProduct({
                                    ...editingProduct,
                                    images: currentList,
                                    image: currentList[0],
                                  });
                                }
                              }}
                              style={{ fontSize: '11px', padding: '4px 6px', maxWidth: '180px' }}
                            >
                              <option value="">Preset sample…</option>
                              {IMAGE_PRESETS.map((preset) => (
                                <option key={preset.value} value={preset.value}>
                                  {preset.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <input
                            type="text"
                            placeholder="Or paste image URL"
                            value={imgUrl}
                            onChange={(e) => {
                              const url = e.target.value;
                              const error = validateImageUrl(url);
                              if (error) {
                                setUploadError(error);
                              } else {
                                setUploadError(null);
                              }
                              const currentList = [...(editingProduct.images || [editingProduct.image])];
                              currentList[idx] = url;
                              setEditingProduct({
                                ...editingProduct,
                                images: currentList,
                                image: currentList[0],
                              });
                            }}
                            style={{ fontSize: '11px', padding: '5px 8px' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {(editingProduct.images || [editingProduct.image]).length < 3 && (
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => {
                        const currentList = [...(editingProduct.images || [editingProduct.image])];
                        if (currentList.length < 3) {
                          const nextPreset = IMAGE_PRESETS[currentList.length]?.value || '/assets/saree-rose.webp';
                          const updated = [...currentList, nextPreset];
                          setEditingProduct({
                            ...editingProduct,
                            images: updated,
                            image: updated[0],
                          });
                        }
                      }}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        padding: '6px 12px',
                        marginTop: '2px',
                      }}
                    >
                      <Icon name="plus" size={12} /> Add Photo ({(editingProduct.images || [editingProduct.image]).length}/3)
                    </button>
                  )}
                </div>
              </div>

              {/* Colour Variants Manager */}
              <div style={{ marginTop: '16px', marginBottom: '16px', padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', background: '#faf8f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Colour Variants (Optional)</h4>
                    <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                      Each variant has its own colour name and up to 3 photos.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn outline"
                    style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      const current = editingProduct.variants || [];
                      setEditingProduct({
                        ...editingProduct,
                        variants: [...current, { name: '', colour: '', images: ['/assets/saree-rose.webp'] }],
                      });
                    }}
                  >
                    <Icon name="plus" size={12} /> Add Colour Variant
                  </button>
                </div>

                {(editingProduct.variants || []).map((variant, vIdx) => (
                  <VariantImageManager
                    key={vIdx}
                    variant={variant}
                    variantIndex={vIdx}
                    targetPrefix="edit-variant"
                    uploadingTarget={uploadingTarget}
                    onUpdateVariant={(updated) => {
                      const vars = [...(editingProduct.variants || [])];
                      vars[vIdx] = updated;
                      setEditingProduct({ ...editingProduct, variants: vars });
                    }}
                    onRemoveVariant={() => {
                      const vars = (editingProduct.variants || []).filter((_, i) => i !== vIdx);
                      setEditingProduct({ ...editingProduct, variants: vars });
                    }}
                    onUploadPhoto={(e, imgIdx, varIdx) => handleFileUpload(e, 'edit-variant', imgIdx, varIdx)}
                    onUrlError={setUploadError}
                  />
                ))}
                {(!editingProduct.variants || editingProduct.variants.length === 0) && (
                  <p className="muted" style={{ fontSize: '12px', margin: 0 }}>No variants added. This saree is a single colour ({editingProduct.colour}).</p>
                )}
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

              {uploadError && <p className="admin-error-badge" role="alert" style={{ marginBottom: '10px' }}>{uploadError}</p>}
              {uploadingTarget !== null && <p className="muted" style={{ fontSize: '12px', marginBottom: '8px' }}>Photo upload in flight… please wait.</p>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="submit" className="btn" disabled={isSavingEdit || uploadingTarget !== null} style={{ flex: 1 }}>
                  {uploadingTarget !== null ? 'Uploading Photo…' : isSavingEdit ? 'Saving Changes…' : 'Save Changes'}
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
