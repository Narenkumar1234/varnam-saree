export function getSiteUrl(): URL {
  try {
    const url = new URL(process.env.SITE_URL?.trim() || 'http://localhost:3000');
    if (url.protocol === 'http:' || url.protocol === 'https:') return new URL(url.origin);
  } catch {
    // A missing/malformed deployment setting must not break page rendering.
  }
  return new URL('http://localhost:3000');
}
