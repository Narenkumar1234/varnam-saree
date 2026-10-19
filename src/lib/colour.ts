export function capitalizeColour(colour?: string | null): string {
  if (!colour) return '';
  const trimmed = colour.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
