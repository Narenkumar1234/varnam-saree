const ALLOWED_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
  'drive.google.com',
];

export function needsUnoptimized(src: string): boolean {
  if (src.startsWith('/')) return false;
  
  try {
    const url = new URL(src);
    return !ALLOWED_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}
