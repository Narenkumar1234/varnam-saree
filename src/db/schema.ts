import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'products' table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  collection: text('collection').notNull(), // 'Silk' | 'Cotton' | 'Festive'
  price: integer('price').notNull(),
  oldPrice: integer('old_price'),
  colour: text('colour').notNull(),
  stock: integer('stock').notNull().default(5),
  tag: text('tag'),
  image: text('image').notNull(),
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
