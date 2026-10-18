export interface Product {
  id: number;
  name: string;
  type: string;
  collection: 'Silk' | 'Cotton' | 'Festive';
  price: number;
  old?: number;
  pos: string;
  colour: 'Emerald' | 'Rose' | 'Indigo' | 'Ivory';
  tag: string;
  image: string;
}

export interface CartItem {
  id: number;
  qty: number;
  finish: string;
}

export interface Order {
  id: string;
  date: string;
  name: string;
  items: CartItem[];
  total: number;
}

export interface UserProfile {
  name: string;
  email: string;
  uid?: string;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface ShopFilterState {
  collection: string;
  colours: string[];
  priceRange: PriceRange;
}
