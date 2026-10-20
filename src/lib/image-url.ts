export function normalizeImageUrl(url: string): string | null {
  const trimmed = url.trim();
  
  if (!trimmed) return null;
  
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return null;
  }
  
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of drivePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  
  return trimmed;
}

/**
 * Prepare a stored image path for Next/Image: drop blob/data URLs, rewrite
 * Google Drive share links, and turn site-relative paths into root-absolute
 * ones (`assets/foo.webp` → `/assets/foo.webp`).
 */
export function resolveDisplayImageUrl(url: string): string | null {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return null;
  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }
  if (
    normalized.startsWith('https://')
    || normalized.startsWith('http://')
    || normalized.startsWith('/')
  ) {
    return normalized;
  }
  // Reject other schemes (javascript:, about:, …). Local files have no scheme.
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized)) return null;
  return `/${normalized.replace(/^\.\/+/, '')}`;
}

export function isValidImageUrl(url: string): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function rejectTemporaryUrls(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return null;
  }
  return trimmed;
}
