import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure public/uploads exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique, clean filename
    const cleanName = `saree-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
    const filePath = path.join(uploadsDir, cleanName);

    // Resize and optimize to WebP
    await sharp(buffer)
      .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(filePath);

    const publicUrl = `/uploads/${cleanName}`;
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process and upload saree photo' },
      { status: 500 }
    );
  }
}
