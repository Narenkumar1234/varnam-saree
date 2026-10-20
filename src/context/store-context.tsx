'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import { CartItem, Order, OrderPayment, OrderQuote, Product } from '@/types';
import { money } from '@/data/products';
import { validateCoupon, type CouponValidation } from '@/lib/coupons';
import { quoteFromCatalogue, previewOrderQuote, parseOrderItems } from '@/lib/pricing';
import { DEFAULT_COMMERCE, type CommerceConfig } from '@/lib/commerce';
import { customerAuthHeaders } from '@/lib/customer-auth-headers';
import { createProductWhatsAppMessage, createWhatsAppOrderUrl, formatWhatsAppOrderMessage, openWhatsAppOrder } from '@/lib/whatsapp';

interface StoreContextType {
  whatsAppFallback: { url: string | null } | null;
  clearWhatsAppFallback: () => void;
  openWhatsAppMessage: (message: string) => void;
  commerce: CommerceConfig;
  products: Product[];
  getProductById: (id: number | string) => Product | undefined;
  refreshProducts: (force?: boolean) => Promise<Product[]>;
  cartError: string | null;
  cart: CartItem[];
  wish: number[];
  orders: Order[];
  couponCode: string | null;
  cartQuote: OrderQuote;
  toastMessage: string | null;
  totalBagCount: number;
  addToCart: (id: number, qty?: number) => void;
  adjustCardQuantity: (id: number, delta: number) => void;
  removeItem: (id: number) => void;
  toggleWish: (id: number) => void;
  applyCoupon: (code: string, subtotal?: number) => CouponValidation;
  removeCoupon: () => void;
  placeOrder: (
    details: {
      first: string; last: string; email: string; phone: string; address: string;
      apartment?: string; landmark?: string; city: string; state: string; pin: string;
      saveAddress?: boolean; addressLabel?: string; saveAsDefault?: boolean;
    },
    customItems?: CartItem[]
  ) => Promise<string>;
  updateOrderPayment: (orderId: string, payment: OrderPayment) => void;
  clearDemo: () => void;
  showToast: (msg: string) => void;
  orderProductOnWhatsApp: (id: number, qty?: number) => void;
  orderCartOnWhatsApp: () => void;
  getOrderById: (id: string) => Order | undefined;
}

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children, initialProducts, initialCommerce = DEFAULT_COMMERCE }: { children: ReactNode; initialProducts: Product[]; initialCommerce?: CommerceConfig }) {
  const [whatsAppFallback, setWhatsAppFallback] = useState<{ url: string | null } | null>(null);
  const clearWhatsAppFallback = () => setWhatsAppFallback(null);
  const [commerce, setCommerce] = useState(initialCommerce);
  const commerceRef = useRef(initialCommerce);
  useEffect(() => { commerceRef.current = initialCommerce; setCommerce(initialCommerce); }, [initialCommerce]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const catalogueRef = useRef(initialProducts);
  const refreshing = useRef<Promise<Product[]> | null>(null);
  const lastCommerceFetch = useRef<number>(0);
  const COMMERCE_TTL_MS = 60_000;

  useEffect(() => { catalogueRef.current = initialProducts; setProducts(initialProducts); }, [initialProducts]);
  const refreshProducts = useCallback((force = false) => {
    if (refreshing.current) return refreshing.current;
    const now = Date.now();
    const shouldFetchCommerce = force || now - lastCommerceFetch.current > COMMERCE_TTL_MS;

    const commercialRefresh = shouldFetchCommerce
      ? fetch('/api/commerce', { cache: 'no-store' })
          .then(async (response) => {
            const data = await response.json();
            if (response.ok && Array.isArray(data.coupons) && data.settings) {
              lastCommerceFetch.current = Date.now();
              commerceRef.current = data;
              setCommerce(data);
            }
          })
          .catch(() => {})
      : Promise.resolve();

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
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refreshProducts();
    }, 60000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshProducts]);
  const getProductById = (id: number | string) => products.find((product) => product.id === Number(id));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wish, setWish] = useState<number[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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

      // Discard legacy email-only identities. Browser data never authenticates.
      localStorage.removeItem('varnam-profile');

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
      if (couponCode) localStorage.setItem('varnam-coupon', couponCode);
      else localStorage.removeItem('varnam-coupon');
    } catch {
      // ignore
    }
  }, [cart, wish, orders, couponCode, isLoaded]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const totalBagCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const { quote: cartQuote, error: cartError } = useMemo(() => previewOrderQuote(cart, couponCode, products, commerce), [cart, couponCode, products, commerce]);

  const addToCart = (id: number, qty = 1) => {
    const current = cart.find((item) => item.id === id);
    const next = current ? cart.map((item) => item.id === id ? { ...item, qty: item.qty + qty } : item) : [...cart, { id, qty }];
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
    details: {
      first: string; last: string; email: string; phone: string; address: string;
      apartment?: string; landmark?: string; city: string; state: string; pin: string;
      saveAddress?: boolean; addressLabel?: string; saveAsDefault?: boolean;
    },
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
      headers: { 'Content-Type': 'application/json', ...(await customerAuthHeaders()) },
      body: JSON.stringify({
        id,
        customerName: `${details.first} ${details.last}`.trim(),
        email: details.email,
        phone: details.phone,
        address: details.address,
        apartment: details.apartment,
        landmark: details.landmark,
        city: details.city,
        state: details.state,
        pincode: details.pin,
        items: orderItems,
        couponCode,
        expectedTotal: latestQuote.pricing.total,
        saveAddress: details.saveAddress === true,
        addressLabel: details.addressLabel,
        saveAsDefault: details.saveAsDefault === true,
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

  const updateOrderPayment = (orderId: string, payment: OrderPayment) => {
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, payment } : o));
  };

  const clearDemo = () => {
    clearWhatsAppFallback();
    setCart([]);
    setWish([]);
    setOrders([]);
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
    // Keep an ordinary retry link visible even if a browser silently refuses
    // the external-app handoff. Do not infer success from a popup return value.
    setWhatsAppFallback({ url: createWhatsAppOrderUrl(message) });
    if (!openWhatsAppOrder(message)) {
      showToast('WhatsApp could not open. Use the retry link or business number below.');
    }
  };

  const orderProductOnWhatsApp = (id: number, qty = 1) => {
    const product = getProductById(id);
    if (!product) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const { pricing } = quoteFromCatalogue([{ id, qty }], couponCode, products, true, commerce);
      openWhatsAppMessage(createProductWhatsAppMessage(product, { quantity: qty, origin, pricing }));
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
        whatsAppFallback, clearWhatsAppFallback, openWhatsAppMessage,
        commerce, products, getProductById, refreshProducts, cartError,
        cart,
        wish,
        orders,
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
        updateOrderPayment,
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
