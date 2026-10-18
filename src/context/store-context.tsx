'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { CartItem, Order, OrderQuote, UserProfile } from '@/types';
import { getProductById, money, VARNAM_CONFIG } from '@/data/products';
import { validateCoupon, type CouponValidation } from '@/lib/coupons';
import { calculateOrderQuote, parseOrderItems } from '@/lib/order-pricing';

interface StoreContextType {
  cart: CartItem[];
  wish: number[];
  orders: Order[];
  profile: UserProfile | null;
  couponCode: string | null;
  cartQuote: OrderQuote;
  toastMessage: string | null;
  totalBagCount: number;
  addToCart: (id: number, qty?: number, finish?: string) => void;
  adjustCardQuantity: (id: number, delta: number) => void;
  removeItem: (id: number) => void;
  toggleWish: (id: number) => void;
  applyCoupon: (code: string) => CouponValidation;
  removeCoupon: () => void;
  placeOrder: (
    details: { first: string; last: string; email: string; phone: string; address: string; city: string; state: string; pin: string },
    customItems?: CartItem[]
  ) => Promise<string>;
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
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('varnam-cart');
      if (savedCart) {
        const items = JSON.parse(savedCart);
        if (Array.isArray(items) && items.length) {
          const validItems = parseOrderItems(items);
          calculateOrderQuote(validItems);
          setCart(validItems);
        }
      }

      const savedWish = localStorage.getItem('varnam-wish');
      if (savedWish) setWish(JSON.parse(savedWish));

      const savedOrders = localStorage.getItem('varnam-orders');
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedProfile = localStorage.getItem('varnam-profile');
      if (savedProfile) setProfileState(JSON.parse(savedProfile));

      const savedCoupon = localStorage.getItem('varnam-coupon');
      const coupon = validateCoupon(savedCoupon);
      if (coupon.valid) setCouponCode(coupon.coupon.code);
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
      if (couponCode) localStorage.setItem('varnam-coupon', couponCode);
      else localStorage.removeItem('varnam-coupon');
    } catch {
      // ignore
    }
  }, [cart, wish, orders, profile, couponCode, isLoaded]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const totalBagCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const cartQuote = useMemo(() => calculateOrderQuote(cart, couponCode), [cart, couponCode]);

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
    const result = validateCoupon(code);
    if (result.valid) setCouponCode(result.coupon.code);
    return result;
  };

  const removeCoupon = () => setCouponCode(null);

  const placeOrder = async (
    details: { first: string; last: string; email: string; phone: string; address: string; city: string; state: string; pin: string },
    customItems?: CartItem[]
  ) => {
    const id = 'VRN-' + crypto.randomUUID();
    const orderItems = customItems || [...cart];
    // Validate locally, then let the API calculate and save the authoritative price.
    calculateOrderQuote(parseOrderItems(orderItems), couponCode);
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        customerName: `${details.first} ${details.last}`.trim(),
        email: details.email,
        phone: details.phone,
        address: details.address,
        city: details.city,
        state: details.state,
        pincode: details.pin,
        items: orderItems,
        couponCode,
        uid: profile?.uid,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.order?.pricing || !Array.isArray(data.order.items)) {
      throw new Error(data?.error || 'Your order could not be saved. Please try again.');
    }
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const newOrder: Order = {
      id,
      date,
      name: details.first,
      items: data.order.items,
      pricing: data.order.pricing,
      total: data.order.total,
    };
    setOrders((prev) => [newOrder, ...prev]);
    if (!customItems) {
      setCart([]);
      setCouponCode(null);
    }
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
    setCouponCode(null);
    localStorage.removeItem('varnam-cart');
    localStorage.removeItem('varnam-wish');
    localStorage.removeItem('varnam-orders');
    localStorage.removeItem('varnam-profile');
    localStorage.removeItem('varnam-coupon');
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
    const { pricing } = calculateOrderQuote([{ id, qty, finish }], couponCode);
    openWhatsAppOrder([
      `${product.name} × ${qty}`,
      finish,
      `Subtotal: ${money(pricing.subtotal)}`,
      ...(pricing.couponCode ? [`${pricing.couponCode}: −${money(pricing.discountAmount)}`] : []),
      `Delivery: ${money(pricing.shipping)}`,
      `Order total: ${money(pricing.total)}`,
      `Product: ${origin}/product/${product.id}`,
    ]);
  };

  const orderCartOnWhatsApp = () => {
    if (!cart.length) return;
    const { pricing } = cartQuote;
    const lines = cartQuote.items.map((item) => `${item.name} × ${item.qty} — ${money(item.total)}`);
    if (pricing.couponCode) lines.push(`${pricing.couponCode}: saving ${money(pricing.discountAmount)} included above`);
    lines.push(`Delivery: ${money(pricing.shipping)}`, `Order total: ${money(pricing.total)}`);
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
        couponCode,
        cartQuote,
        toastMessage,
        totalBagCount,
        addToCart,
        adjustCardQuantity,
        removeItem,
        toggleWish,
        applyCoupon,
        removeCoupon,
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
