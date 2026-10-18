'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import { CartItem, Order, OrderQuote, UserProfile, Product } from '@/types';
import { money } from '@/data/products';
import { validateCoupon, type CouponValidation } from '@/lib/coupons';
import { quoteFromCatalogue, previewOrderQuote, parseOrderItems } from '@/lib/pricing';
import { usePathname } from 'next/navigation';
import { DEFAULT_COMMERCE, type CommerceConfig } from '@/lib/commerce';
import { createProductWhatsAppMessage, formatWhatsAppOrderMessage, openWhatsAppOrder } from '@/lib/whatsapp';

interface StoreContextType {
  commerce: CommerceConfig;
  products: Product[];
  getProductById: (id: number | string) => Product | undefined;
  refreshProducts: () => Promise<Product[]>;
  cartError: string | null;
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
  applyCoupon: (code: string, subtotal?: number) => CouponValidation;
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

export function StoreProvider({ children, initialProducts, initialCommerce = DEFAULT_COMMERCE }: { children: ReactNode; initialProducts: Product[]; initialCommerce?: CommerceConfig }) {
  const [commerce, setCommerce] = useState(initialCommerce);
  const commerceRef = useRef(initialCommerce);
  useEffect(() => { commerceRef.current = initialCommerce; setCommerce(initialCommerce); }, [initialCommerce]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const catalogueRef = useRef(initialProducts);
  const refreshing = useRef<Promise<Product[]> | null>(null);
  const pathname = usePathname();
  useEffect(() => { catalogueRef.current = initialProducts; setProducts(initialProducts); }, [initialProducts]);
  const refreshProducts = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const commercialRefresh = fetch('/api/commerce', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (response.ok && Array.isArray(data.coupons) && data.settings) { commerceRef.current = data; setCommerce(data); }
    }).catch(() => {});
    refreshing.current = fetch('/api/products', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && Array.isArray(data.products) && data.products.length) {
          catalogueRef.current = data.products;
          setProducts(data.products);
        }
        return catalogueRef.current;
      }).catch(() => catalogueRef.current).then(async (catalogue) => { await commercialRefresh; return catalogue; }).finally(() => { refreshing.current = null; });
    return refreshing.current;
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshProducts(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer); };
  }, [pathname, refreshProducts]);
  const getProductById = (id: number | string) => products.find((product) => product.id === Number(id));
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
      if (savedCoupon?.trim()) setCouponCode(savedCoupon.trim().toUpperCase());
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

  const { quote: cartQuote, error: cartError } = useMemo(() => previewOrderQuote(cart, couponCode, products, commerce), [cart, couponCode, products, commerce]);

  const addToCart = (id: number, qty = 1, finish = 'Unstitched blouse · included') => {
    const current = cart.find((item) => item.id === id);
    const next = current ? cart.map((item) => item.id === id ? { ...item, qty: item.qty + qty, finish } : item) : [...cart, { id, qty, finish }];
    try { quoteFromCatalogue(next, null, products, true, commerce); }
    catch (error) { showToast(error instanceof Error ? error.message : 'This saree is unavailable.'); return; }
    setCart(next);
    showToast('Added to your bag');
  };

  const adjustCardQuantity = (id: number, delta: number) => {
    const current = cart.find((item) => item.id === id);
    if (!current) { if (delta > 0) addToCart(id, delta); return; }
    const qty = current.qty + delta;
    if (qty <= 0) { setCart(cart.filter((item) => item.id !== id)); return; }
    const next = cart.map((item) => item.id === id ? { ...item, qty } : item);
    if (delta > 0) {
      try { quoteFromCatalogue(next, null, products, true, commerce); }
      catch (error) { showToast(error instanceof Error ? error.message : 'Please review your bag.'); return; }
    }
    setCart(next);
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

  const applyCoupon = (code: string, subtotal = cartQuote.pricing.subtotal) => {
    const result = validateCoupon(code, commerce.coupons, subtotal);
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
    const displayedQuote = quoteFromCatalogue(parseOrderItems(orderItems), couponCode, products, true, commerce);
    const latest = await refreshProducts();
    const latestQuote = quoteFromCatalogue(orderItems, couponCode, latest, true, commerceRef.current);
    if (displayedQuote.pricing.total !== latestQuote.pricing.total) throw new Error('Prices have changed. Please review the updated total and place your order again.');
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
        expectedTotal: latestQuote.pricing.total,
        uid: profile?.uid,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.order?.pricing || !Array.isArray(data.order.items)) {
      await refreshProducts();
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

  const openWhatsAppMessage = (message: string) => {
    if (!openWhatsAppOrder(message)) {
      showToast('WhatsApp ordering is ready for the Varnam business number.');
    }
  };

  const orderProductOnWhatsApp = (id: number, qty = 1, finish = 'Unstitched blouse · included') => {
    const product = getProductById(id);
    if (!product) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const { pricing } = quoteFromCatalogue([{ id, qty, finish }], couponCode, products, true, commerce);
      openWhatsAppMessage(createProductWhatsAppMessage(product, { quantity: qty, finish, origin, pricing }));
    } catch (error) { showToast(error instanceof Error ? error.message : 'This saree is unavailable.'); }
  };

  const orderCartOnWhatsApp = () => {
    if (!cart.length) return;
    if (cartError) { showToast(cartError); return; }
    const { pricing } = cartQuote;
    const lines = cartQuote.items.map((item) => `${item.name} × ${item.qty} — ${money(item.total)}`);
    if (pricing.couponCode) lines.push(`${pricing.couponCode}: saving ${money(pricing.discountAmount)} included above`);
    lines.push(`Delivery: ${money(pricing.shipping)}`, `Order total: ${money(pricing.total)}`);
    openWhatsAppMessage(formatWhatsAppOrderMessage(lines));
  };

  const getOrderById = (id: string) => {
    return orders.find((o) => o.id === id);
  };

  return (
    <StoreContext.Provider
      value={{
        commerce, products, getProductById, refreshProducts, cartError,
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
