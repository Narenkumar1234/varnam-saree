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
