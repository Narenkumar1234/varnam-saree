export function isTestProduct(product?: { id?: number | string | null; name?: string | null } | null): boolean {
  if (!product) return false;
  const numId = Number(product.id);
  if (numId === 9 || numId === 10) return true;
  const name = (product.name || '').trim();
  if (/^(qa|test|sample)/i.test(name)) return true;
  return false;
}
