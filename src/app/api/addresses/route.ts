import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerAddresses } from '@/db/schema';
import { AddressValidationError, parseCustomerAddressInput } from '@/lib/address-validation';
import { saveCustomerAddress } from '@/lib/customer-address-store';
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

export async function GET(req: NextRequest) {
  try {
    if (localDemoModeEnabled()) {
      return NextResponse.json({ addresses: [] }, { headers: customerPrivateHeaders });
    }
    const { user } = await requireCustomerUser(req);
    const rows = await db.select().from(customerAddresses)
      .where(eq(customerAddresses.userId, user.id))
      .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
    return NextResponse.json({ addresses: rows.map(publicAddress) }, { headers: customerPrivateHeaders });
  } catch (error) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    console.error('Failed to list addresses:', error);
    return NextResponse.json({ error: 'Your addresses could not be loaded.' }, { status: 500, headers: customerPrivateHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCustomerUser(req);
    const input = parseCustomerAddressInput(await req.json());
    if (localDemoModeEnabled()) {
      return NextResponse.json({
        success: true,
        address: { id: 0, ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      }, { status: 201, headers: customerPrivateHeaders });
    }

    const created = await saveCustomerAddress(user.id, input);

    return NextResponse.json({ success: true, address: publicAddress(created) }, { status: 201, headers: customerPrivateHeaders });
  } catch (error) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    if (error instanceof AddressValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: customerPrivateHeaders });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Enter address details.' }, { status: 400, headers: customerPrivateHeaders });
    }
    console.error('Failed to save address:', error);
    return NextResponse.json({ error: 'Your address could not be saved.' }, { status: 500, headers: customerPrivateHeaders });
  }
}
