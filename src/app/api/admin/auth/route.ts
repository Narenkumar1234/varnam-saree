import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'varnam2026';
const AUTHORIZED_EMAILS = ['naren9239@gmail.com', 'admin@varnamsaree.com'];

export async function POST(req: NextRequest) {
  try {
    const { passcode, email } = await req.json();

    const isPasscodeValid = passcode && passcode.trim() === ADMIN_PASSCODE;
    const isEmailValid = email && AUTHORIZED_EMAILS.includes(email.trim().toLowerCase());

    if (isPasscodeValid || isEmailValid) {
      return NextResponse.json({
        success: true,
        message: 'Admin authorization granted',
        role: 'boutique_manager',
      });
    }

    return NextResponse.json(
      { error: 'Invalid access key or unauthorized email' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
