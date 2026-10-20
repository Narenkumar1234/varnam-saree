export function singleColourHelperText(colour: string | null | undefined, tense: 'will-publish' | 'is'): string {
  const value = typeof colour === 'string' ? colour.trim() : '';
  if (tense === 'will-publish') {
    return value
      ? `No variants added. This saree will be published as a single colour (${value}).`
      : 'No variants added. This saree will be published as a single colour.';
  }
  return value
    ? `No variants added. This saree is a single colour (${value}).`
    : 'No variants added. This saree is a single colour.';
}

export function productInteger(value: unknown, minimum: number): number {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < minimum || number > 2_147_483_497) {
    throw new Error(`Enter a whole number between ${minimum} and 2147483497.`);
  }
  return number;
}
