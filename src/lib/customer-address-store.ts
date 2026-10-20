import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerAddresses, users } from '@/db/schema';
import type { CustomerAddressInput } from '@/lib/address-validation';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function saveCustomerAddress(userId: number, input: CustomerAddressInput) {
  return db.transaction(async (tx) => writeCustomerAddress(tx, userId, input));
}

async function writeCustomerAddress(tx: Transaction, userId: number, input: CustomerAddressInput) {
  const existing = await tx.select({ id: customerAddresses.id }).from(customerAddresses)
    .where(eq(customerAddresses.userId, userId));
  const isDefault = input.isDefault || existing.length === 0;
  if (isDefault) {
    await tx.update(customerAddresses)
      .set({ isDefault: false })
      .where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.isDefault, true)));
  }
  const [row] = await tx.insert(customerAddresses).values({
    userId,
    label: input.label,
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2,
    landmark: input.landmark,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    country: input.country,
    isDefault,
    updatedAt: new Date(),
  }).returning();
  await tx.update(users).set({ phone: input.phone }).where(eq(users.id, userId));
  return row;
}
