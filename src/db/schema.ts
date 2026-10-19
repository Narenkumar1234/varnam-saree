import { relations } from 'drizzle-orm';
import { boolean, date, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
  total: integer('total').notNull(),
  status: text('status').notNull().default('Confirmed'), // Confirmed, Handloom Finishing, Dispatched, Delivered
  itemsJson: text('items_json').notNull(), // Serialized JSON items
  createdAt: timestamp('created_at').defaultNow(),
});

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
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, {
    fields: [wishlists.userId],
    references: [users.id],
  }),
}));
