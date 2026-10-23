export function getArticle(word?: string | null): 'a' | 'an' {
  if (!word || !word.trim()) return 'a';
  const first = word.trim().charAt(0).toLowerCase();
  return ['a', 'e', 'i', 'o', 'u'].includes(first) ? 'an' : 'a';
}

export function aOrAn(word?: string | null): 'a' | 'an' {
  return getArticle(word);
}

export function withArticle(word?: string | null): string {
  if (!word || !word.trim()) return '';
  const trimmed = word.trim();
  return `${getArticle(trimmed)} ${trimmed}`;
}
