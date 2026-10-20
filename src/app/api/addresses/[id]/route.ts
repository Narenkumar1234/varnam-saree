import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerAddresses, users } from '@/db/schema';
import { AddressValidationError, parseCustomerAddressInput } from '@/lib/address-validation';
import { customerAuthFailure, customerPrivateHeaders } from '@/lib/customer-auth-server';
import { requireCustomerUser } from '@/lib/customer-user';
import { localDemoModeEnabled } from '@/lib/local-demo-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicAddress(row: typeof customerAddresses.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function ownedAddress(userId: number, id: number) {
  const [row] = await db.select().from(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
    .limit(1);
  return row || null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireCustomerUser(req);
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: customerPrivateHeaders });
    const input = parseCustomerAddressInput(await req.json());
    if (localDemoModeEnabled()) {
      return NextResponse.json({ success: true, address: { id, ...input } }, { headers: customerPrivateHeaders });
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(customerAddresses)
        .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, user.id)))
        .limit(1);
      if (!current) return null;
      if (input.isDefault) {
        await tx.update(customerAddresses)
          .set({ isDefault: false })
          .where(and(eq(customerAddresses.userId, user.id), eq(customerAddresses.isDefault, true)));
      }
      const [row] = await tx.update(customerAddresses).set({
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
        isDefault: input.isDefault,
        updatedAt: new Date(),
      }).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, user.id))).returning();
      await tx.update(users).set({ phone: input.phone }).where(eq(users.id, user.id));
      return row;
    });

    if (!updated) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: customerPrivateHeaders });
    return NextResponse.json({ success: true, address: publicAddress(updated) }, { headers: customerPrivateHeaders });
  } catch (error) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    if (error instanceof AddressValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: customerPrivateHeaders });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Enter address details.' }, { status: 400, headers: customerPrivateHeaders });
    }
    console.error('Failed to update address:', error);
    return NextResponse.json({ error: 'Your address could not be updated.' }, { status: 500, headers: customerPrivateHeaders });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireCustomerUser(req);
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: customerPrivateHeaders });
    if (localDemoModeEnabled()) {
      return NextResponse.json({ success: true }, { headers: customerPrivateHeaders });
    }
    const current = await ownedAddress(user.id, id);
    if (!current) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: customerPrivateHeaders });
    await db.delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, user.id)));
    return NextResponse.json({ success: true }, { headers: customerPrivateHeaders });
  } catch (error) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    console.error('Failed to delete address:', error);
    return NextResponse.json({ error: 'Your address could not be deleted.' }, { status: 500, headers: customerPrivateHeaders });
  }
}
