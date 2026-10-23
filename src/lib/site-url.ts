export function getSiteUrl(): URL {
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelUrl = vercelProd
    ? (vercelProd.startsWith('http://') || vercelProd.startsWith('https://') ? vercelProd : `https://${vercelProd}`)
    : undefined;

  const candidates: (string | undefined)[] = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl,
    'https://varnam-saree.vercel.app',
  ];

  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) continue;
    try {
      const url = new URL(candidate.trim());
      if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        !url.hostname.includes('localhost') &&
        url.hostname !== '127.0.0.1' &&
        url.hostname !== '0.0.0.0'
      ) {
        return new URL(url.origin);
      }
    } catch {
      // Continue to next candidate
    }
  }

  return new URL('https://varnam-saree.vercel.app');
}
