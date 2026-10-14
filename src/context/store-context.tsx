'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Order, UserProfile } from '@/types';
import { getProductById, money, VARNAM_CONFIG } from '@/data/products';

interface StoreContextType {
  cart: CartItem[];
  wish: number[];
  orders: Order[];
  profile: UserProfile | null;
  discount: boolean;
  toastMessage: string | null;
  totalBagCount: number;
  subtotal: number;
  total: number;
  shipping: number;
  discountAmount: number;
  addToCart: (id: number, qty?: number, finish?: string) => void;
  adjustCardQuantity: (id: number, delta: number) => void;
  removeItem: (id: number) => void;
  toggleWish: (id: number) => void;
  applyCoupon: (code: string) => boolean;
  placeOrder: (details: { first: string; last: string; email: string; phone: string; address: string; city: string; state: string; pin: string }) => string;
  setProfile: (p: UserProfile | null) => void;
  clearDemo: () => void;
  showToast: (msg: string) => void;
  orderProductOnWhatsApp: (id: number, qty?: number, finish?: string) => void;
  orderCartOnWhatsApp: () => void;
  getOrderById: (id: string) => Order | undefined;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wish, setWish] = useState<number[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [discount, setDiscount] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('varnam-cart');
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWish = localStorage.getItem('varnam-wish');
      if (savedWish) setWish(JSON.parse(savedWish));

      const savedOrders = localStorage.getItem('varnam-orders');
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedProfile = localStorage.getItem('varnam-profile');
      if (savedProfile) setProfileState(JSON.parse(savedProfile));
    } catch {
      // Local storage may be disabled or empty
    }
    setIsLoaded(true);
  }, []);

  // Save changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('varnam-cart', JSON.stringify(cart));
      localStorage.setItem('varnam-wish', JSON.stringify(wish));
      localStorage.setItem('varnam-orders', JSON.stringify(orders));
      localStorage.setItem('varnam-profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [cart, wish, orders, profile, isLoaded]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const totalBagCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const subtotal = cart.reduce((sum, item) => {
    const p = getProductById(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

  const discountAmount = discount ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal >= 3000 || subtotal === 0 ? 0 : 150;
  const total = Math.max(0, subtotal - discountAmount + shipping);

  const addToCart = (id: number, qty = 1, finish = 'Unstitched blouse · included') => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === id);
      if (existing) {
        return prev.map((x) => (x.id === id ? { ...x, qty: x.qty + qty, finish } : x));
      }
      return [...prev, { id, qty, finish }];
    });
    showToast('Added to your bag');
  };

  const adjustCardQuantity = (id: number, delta: number) => {
    const p = getProductById(id);
    setCart((prev) => {
      const existing = prev.find((x) => x.id === id);
      if (existing) {
        const newQty = existing.qty + delta;
        if (newQty <= 0) {
          if (p) showToast(`${p.name} removed from your bag`);
          return prev.filter((x) => x.id !== id);
        }
        if (p) showToast(`${p.name}: ${newQty} in your bag`);
        return prev.map((x) => (x.id === id ? { ...x, qty: newQty } : x));
      } else if (delta > 0) {
        if (p) showToast(`${p.name}: 1 in your bag`);
        return [...prev, { id, qty: 1, finish: 'Unstitched blouse · included' }];
      }
      return prev;
    });
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
    showToast('Item removed from bag');
  };

  const toggleWish = (id: number) => {
    setWish((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        showToast('Removed from your wishlist');
        return prev.filter((x) => x !== id);
      } else {
        showToast('Saved to your wishlist');
        return [...prev, id];
      }
    });
  };

  const applyCoupon = (code: string) => {
    if (code.trim().toUpperCase() === 'WELCOME10') {
      setDiscount(true);
      showToast('10% welcome discount applied');
      return true;
    }
    showToast('Use WELCOME10 for this demo');
    return false;
  };

  const placeOrder = (details: { first: string; last: string; email: string; phone: string; address: string; city: string; state: string; pin: string }) => {
    const id = 'VRN' + Date.now().toString().slice(-7);
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const newOrder: Order = {
      id,
      date,
      name: details.first,
      items: [...cart],
      total,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setDiscount(false);
    return id;
  };

  const setProfile = (p: UserProfile | null) => {
    setProfileState(p);
  };

  const clearDemo = () => {
    setCart([]);
    setWish([]);
    setOrders([]);
    setProfileState(null);
    setDiscount(false);
    localStorage.removeItem('varnam-cart');
    localStorage.removeItem('varnam-wish');
    localStorage.removeItem('varnam-orders');
    localStorage.removeItem('varnam-profile');
    localStorage.removeItem('varnam-address');
    localStorage.removeItem('varnam-address-label');
    showToast('Demo data cleared');
  };

  const openWhatsAppOrder = (lines: string[]) => {
    const number = String(VARNAM_CONFIG.whatsappNumber || '').replace(/\D/g, '');
    if (!number) {
      showToast('WhatsApp ordering is ready for the Varnam business number.');
      return;
    }
    const message = ['Hello Varnam, I would like to order:', ...lines, '', 'Please confirm availability and delivery details.'].join('\n');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const orderProductOnWhatsApp = (id: number, qty = 1, finish = 'Unstitched blouse · included') => {
    const product = getProductById(id);
    if (!product) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    openWhatsAppOrder([
      `${product.name} × ${qty}`,
      finish,
      `Price: ${money(product.price * qty)}`,
      `Product: ${origin}/product/${product.id}`,
    ]);
  };

  const orderCartOnWhatsApp = () => {
    if (!cart.length) return;
    const lines = cart.map((item) => {
      const p = getProductById(item.id);
      return `${p?.name || 'Saree'} × ${item.qty} — ${money((p?.price || 0) * item.qty)}`;
    });
    lines.push(`Order total shown: ${money(total)}`);
    openWhatsAppOrder(lines);
  };

  const getOrderById = (id: string) => {
    return orders.find((o) => o.id === id);
  };

  return (
    <StoreContext.Provider
      value={{
        cart,
        wish,
        orders,
        profile,
        discount,
        toastMessage,
        totalBagCount,
        subtotal,
        total,
        shipping,
        discountAmount,
        addToCart,
        adjustCardQuantity,
        removeItem,
        toggleWish,
        applyCoupon,
        placeOrder,
        setProfile,
        clearDemo,
        showToast,
        orderProductOnWhatsApp,
        orderCartOnWhatsApp,
        getOrderById,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
