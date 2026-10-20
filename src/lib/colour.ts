export const NEUTRAL_SWATCH_HEX = '#d8d0c8';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Common saree colour names → hex. Keys are lowercase; lookup is case-insensitive. */
export const COLOUR_HEX_MAP: Record<string, string> = {
  maroon: '#7b1e2d',
  gold: '#c9a227',
  ivory: '#ded2ad',
  cream: '#f3e6c4',
  'off-white': '#f4efe6',
  'off white': '#f4efe6',
  red: '#c41e3a',
  pink: '#e39caf',
  rose: '#bb7c8f',
  peach: '#f0c4a0',
  orange: '#e07a3d',
  mustard: '#d4a017',
  yellow: '#e4c441',
  green: '#3f7a4c',
  emerald: '#2e6252',
  'bottle green': '#14342b',
  'bottle-green': '#14342b',
  mint: '#9dcdc0',
  teal: '#2a7a74',
  blue: '#3a5ea8',
  navy: '#1b2a4a',
  'royal blue': '#2b4c9b',
  'royal-blue': '#2b4c9b',
  'sky blue': '#7eb6d9',
  'sky-blue': '#7eb6d9',
  purple: '#6b3fa0',
  violet: '#7a4fb0',
  lavender: '#b9a0d0',
  magenta: '#c2185b',
  wine: '#6b1e3a',
  brown: '#6b4226',
  beige: '#d8c3a5',
  black: '#1a1a1a',
  white: '#f7f4ee',
  grey: '#8a8580',
  gray: '#8a8580',
  silver: '#c0c4c8',
  copper: '#b87333',
  indigo: '#323d69',
};

const COLOUR_ENTRIES = Object.entries(COLOUR_HEX_MAP).sort((a, b) => b[0].length - a[0].length);

function normalizeColourKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
}

function isHexColour(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

export function capitalizeColour(colour?: string | null): string {
  if (!colour) return '';
  const trimmed = colour.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Resolve a colour name to a swatch hex.
 * Prefers an explicit hex on the variant, then case-insensitive / partial name matches
 * (e.g. "Maroon Red" → maroon). Unknown names fall back to a neutral swatch.
 */
export function resolveColourHex(
  colourName?: string | null,
  explicitHex?: string | null,
): string {
  if (explicitHex && isHexColour(explicitHex)) return explicitHex.trim();

  const raw = colourName?.trim() ?? '';
  if (!raw) return NEUTRAL_SWATCH_HEX;
  if (isHexColour(raw)) return raw;

  const needle = normalizeColourKey(raw);
  const exact = COLOUR_HEX_MAP[needle] ?? COLOUR_HEX_MAP[needle.replace(/-/g, ' ')] ?? COLOUR_HEX_MAP[needle.replace(/ /g, '-')];
  if (exact) return exact;

  const hyphenless = needle.replace(/-/g, ' ');
  for (const [key, hex] of COLOUR_ENTRIES) {
    const normalizedKey = key.replace(/-/g, ' ');
    if (hyphenless.includes(normalizedKey)) return hex;
  }

  return NEUTRAL_SWATCH_HEX;
}
