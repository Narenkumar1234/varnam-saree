import { relations, sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Define the 'products' table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  collection: text('collection').notNull(),
  price: integer('price').notNull(),
  oldPrice: integer('old_price'),
  colour: text('colour').notNull(),
  stock: integer('stock').notNull().default(5),
  tag: text('tag'),
  image: text('image').notNull(),
  images: text('images'),
  variants: text('variants'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'orders' table
export const orders = pgTable('orders', {
  id: text('id').primaryKey(), // Order ID like VS-1042
  userId: integer('user_id').references(() => users.id),
  customerName: text('customer_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  shippingFullName: text('shipping_full_name'),
  shippingPhone: text('shipping_phone'),
  shippingLine1: text('shipping_line1'),
  shippingLine2: text('shipping_line2'),
  shippingLandmark: text('shipping_landmark'),
  shippingCity: text('shipping_city'),
  shippingState: text('shipping_state'),
  shippingPincode: text('shipping_pincode'),
  total: integer('total').notNull(),
  status: text('status').notNull().default('Payment pending'), // Payment pending, Confirmed, Delivered, Cancelled
  itemsJson: text('items_json').notNull(), // Serialized JSON items
  createdAt: timestamp('created_at').defaultNow(),
});

export const customerAddresses = pgTable('customer_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  label: text('label'),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  landmark: text('landmark'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  country: text('country').notNull().default('India'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('customer_addresses_user_id_idx').on(table.userId),
  uniqueIndex('customer_addresses_one_default').on(table.userId).where(sql`${table.isDefault} = true`),
]);

// Define the 'wishlists' table
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  productId: integer('product_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  percentage: integer('percentage').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  minSubtotal: integer('min_subtotal').notNull().default(0),
  expiresOn: date('expires_on'),
});

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  wishlists: many(wishlists),
  addresses: many(customerAddresses),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  user: one(users, {
    fields: [customerAddresses.userId],
    references: [users.id],
  }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, {
    fields: [wishlists.userId],
    references: [users.id],
  }),
}));
