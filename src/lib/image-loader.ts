const ALLOWED_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
  'drive.google.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'upload.wikimedia.org',
];

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.includes(hostname)) return true;
  return hostname.endsWith('.firebasestorage.app')
    || hostname.endsWith('.googleusercontent.com');
}

type ImageLoaderParams = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * Encode the full src (including %2F path segments and ?token= queries)
 * as a single `url` param so /_next/image does not split Firebase download URLs.
 */
export function imageLoader({ src, width, quality }: ImageLoaderParams): string {
  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(width));
  params.set('q', String(quality ?? 75));
  return `/_next/image?${params.toString()}`;
}

export function needsUnoptimized(src: string | undefined): boolean {
  if (!src || src.startsWith('/')) return false;
  
  try {
    const url = new URL(src);
    return !isAllowedHost(url.hostname);
  } catch {
    return false;
  }
}
