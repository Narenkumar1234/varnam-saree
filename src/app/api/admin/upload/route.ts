import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { requireAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Ensure public/uploads exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Try sharp compression & auto-rotation to WebP
    const cleanId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const webpName = `saree-${cleanId}.webp`;
    const webpPath = path.join(uploadsDir, webpName);

    try {
      await sharp(buffer)
        .rotate() // Auto-orient based on EXIF
        .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(webpPath);

      return NextResponse.json({
        success: true,
        url: `/uploads/${webpName}`,
      });
    } catch (sharpError: any) {
      console.warn('Sharp optimization bypassed, saving raw image file:', sharpError?.message);

      // Fallback: save original buffer directly
      const originalExt = path.extname(file.name) || '.jpg';
      const rawName = `saree-${cleanId}${originalExt}`;
      const rawPath = path.join(uploadsDir, rawName);

      await fs.writeFile(rawPath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${rawName}`,
      });
    }
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error uploading image' },
      { status: 500 }
    );
  }
}
