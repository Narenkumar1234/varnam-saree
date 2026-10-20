export interface ProductVariant {
  name: string;
  colour?: string;
  images: string[];
}

export interface Product {
  id: number;
  name: string;
  type: string;
  collection: string;
  price: number;
  oldPrice?: number | null;
  pos?: string;
  colour: string;
  tag: string;
  image: string;
  images?: string[] | null;
  variants?: ProductVariant[] | null;
  stock?: number | null;
  description?: string | null;
}

export interface CartItem {
  id: number;
  qty: number;
  /** Legacy blouse/finishing field. Ignored for new orders; kept so old bags still load. */
  finish?: string;
}

export interface Order {
  id: string;
  date: string;
  name: string;
  items: OrderItem[];
  total: number;
  pricing?: OrderPricing;
  payment?: OrderPayment;
}

export interface OrderPayment {
  provider: 'razorpay';
  status: 'pending' | 'authorized' | 'paid';
  razorpayOrderId: string;
  /** Amount in paise, including the saved coupon discount and shipping. */
  amount: number;
  currency: 'INR';
  paymentId?: string;
  paidAt?: string;
}

export interface OrderItem extends CartItem {
  name?: string;
  unitPrice?: number;
  subtotal?: number;
  discountAmount?: number;
  total?: number;
}

export interface PricedOrderItem extends CartItem {
  name: string;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface OrderPricing {
  subtotal: number;
  discountAmount: number;
  shipping: number;
  total: number;
  couponCode?: string;
  discountPercentage?: number;
}

export interface OrderQuote {
  items: PricedOrderItem[];
  pricing: OrderPricing;
}

export interface CustomerOrder extends Pick<Order, 'id' | 'items' | 'total' | 'pricing' | 'payment'> {
  date?: string;
  createdAt?: string | null;
  status?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  uid: string;
}

export interface DeliveryAddress {
  first: string;
  last: string;
  phone: string;
  address: string;
  apartment: string;
  landmark: string;
  city: string;
  pin: string;
  state: string;
}

export interface CustomerAddress {
  id: number;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface ShopFilterState {
  collection: string;
  colours: string[];
  priceRange: PriceRange;
  minDiscount?: number;
}
