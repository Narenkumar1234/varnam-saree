import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function getFirebaseStorage() {
  try {
    const { getStorage } = await import('firebase-admin/storage');
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase credentials not configured');
    }
    
    const name = 'varnam-storage';
    const existing = getApps().find(app => app.name === name);
    const app = existing || initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    }, name);
    
    return getStorage(app);
  } catch (err: any) {
    console.error('Firebase Storage initialization failed:', err);
    throw err;
  }
}

function generateDownloadToken(): string {
  return Array.from({ length: 36 }, (_, i) => 
    i === 8 || i === 13 || i === 18 || i === 23 ? '-' :
    i === 14 ? '4' :
    i === 19 ? ((Math.random() * 4) | 8).toString(16) :
    ((Math.random() * 16) | 0).toString(16)
  ).join('');
}

export async function POST(req: NextRequest) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `Invalid file type. Please upload JPEG, PNG, WebP or AVIF images only.` 
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
      }, { status: 400 });
    }

    const cleanId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const webpName = `${cleanId}.webp`;
    
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer)
        .rotate()
        .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (sharpError: any) {
      console.warn('Sharp optimization failed, using original:', sharpError?.message);
      processedBuffer = buffer;
    }

    try {
      const storage = await getFirebaseStorage();
      const bucket = storage.bucket();
      const filePath = `products/${webpName}`;
      const fileRef = bucket.file(filePath);
      const downloadToken = generateDownloadToken();

      await fileRef.save(processedBuffer, {
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      });

      const encodedPath = encodeURIComponent(filePath);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

      return NextResponse.json({
        success: true,
        url: publicUrl,
      });
    } catch (storageError: any) {
      console.error('Firebase Storage upload failed:', storageError);
      
      if (storageError?.code === 'storage/bucket-not-found' || 
          storageError?.message?.includes('bucket') ||
          storageError?.message?.includes('not found')) {
        return NextResponse.json({
          error: 'Photo storage is not ready yet. Paste a public image link instead.',
        }, { status: 503 });
      }
      
      return NextResponse.json({
        error: 'Photo storage is not ready yet. Paste a public image link instead.',
      }, { status: 503 });
    }
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error uploading image' },
      { status: 500 }
    );
  }
}
