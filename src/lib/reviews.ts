/**
 * "Google reviews" landing-page section. Everything is entered by the owner in
 * Studio (there is no live Google API). Pure helpers shared by the storefront,
 * Studio and the API routes; database access lives in reviews-server.ts.
 */

export interface ReviewSettings {
  /** Studio "Show reviews section". Off by default: nothing is public until enabled. */
  enabled: boolean;
  title: string;
  /** Overall Google rating, 1.0–5.0 (one decimal). */
  rating: number;
  /** Total number of Google reviews ("Based on N Google reviews"). */
  reviewCount: number;
  googleUrl: string;
  writeReviewUrl: string;
}

export interface Review {
  id: number;
  name: string;
  rating: number;
  text: string;
  /** YYYY-MM-DD, optional. */
  reviewDate: string | null;
  photoUrl: string | null;
  productId: number | null;
  visible: boolean;
  sortOrder: number;
}

/** What the storefront receives: visible reviews only, no internal fields. */
export type PublicReview = Pick<Review, 'id' | 'name' | 'rating' | 'text' | 'reviewDate' | 'photoUrl' | 'productId'>;
export interface PublicReviewsSection { settings: Omit<ReviewSettings, 'enabled'>; reviews: PublicReview[] }

export type ReviewInput = Omit<Review, 'id' | 'sortOrder'>;

export const REVIEW_TEXT_MAX = 600;
export const REVIEW_NAME_MAX = 80;
export const REVIEW_TITLE_MAX = 80;
export const REVIEW_URL_MAX = 500;

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  enabled: false,
  title: 'Loved by our customers',
  rating: 5,
  reviewCount: 0,
  googleUrl: '',
  writeReviewUrl: '',
};

/** site_settings keys (kept apart from the commerce SETTING_KEYS, which are saved as a set). */
export const REVIEW_SETTING_KEYS: Record<keyof ReviewSettings, string> = {
  enabled: 'reviewsEnabled',
  title: 'reviewsTitle',
  rating: 'reviewsRating',
  reviewCount: 'reviewsCount',
  googleUrl: 'reviewsGoogleUrl',
  writeReviewUrl: 'reviewsWriteUrl',
};

export class ReviewInputError extends Error {}

function safeHttpsUrl(value: string): boolean {
  if (value.length > REVIEW_URL_MAX) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

const roundRating = (n: number) => Math.round(n * 10) / 10;

/** Tolerant read from site_settings rows; invalid stored values fall back to defaults. */
export function reviewSettingsFromRows(rows: { key: string; value: string }[]): ReviewSettings {
  const settings = { ...DEFAULT_REVIEW_SETTINGS };
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const get = (field: keyof ReviewSettings) => byKey.get(REVIEW_SETTING_KEYS[field]);
  settings.enabled = get('enabled') === 'true';
  const title = get('title');
  if (title && title.trim() && title.length <= REVIEW_TITLE_MAX) settings.title = title.trim();
  const rating = Number(get('rating'));
  if (get('rating') && Number.isFinite(rating) && rating >= 1 && rating <= 5) settings.rating = roundRating(rating);
  const count = Number(get('reviewCount'));
  if (get('reviewCount') && Number.isSafeInteger(count) && count >= 0 && count <= 10_000_000) settings.reviewCount = count;
  for (const field of ['googleUrl', 'writeReviewUrl'] as const) {
    const url = get(field);
    if (url && safeHttpsUrl(url)) settings[field] = url;
  }
  return settings;
}

/** Strict server-side validation of the Studio settings form. */
export function reviewSettingsInput(body: unknown): ReviewSettings {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReviewInputError('Enter valid review settings.');
  const value = body as Record<string, unknown>;
  const known = Object.keys(REVIEW_SETTING_KEYS);
  if (Object.keys(value).some((key) => !known.includes(key))) throw new ReviewInputError('Unknown review setting.');
  if (typeof value.enabled !== 'boolean') throw new ReviewInputError('Choose whether to show the reviews section.');
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > REVIEW_TITLE_MAX) throw new ReviewInputError(`The section title needs 1–${REVIEW_TITLE_MAX} characters.`);
  if (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < 1 || value.rating > 5) {
    throw new ReviewInputError('The overall rating must be between 1.0 and 5.0.');
  }
  if (typeof value.reviewCount !== 'number' || !Number.isSafeInteger(value.reviewCount) || value.reviewCount < 0 || value.reviewCount > 10_000_000) {
    throw new ReviewInputError('The total review count must be a whole number of 0 or more.');
  }
  const urls: Record<'googleUrl' | 'writeReviewUrl', string> = { googleUrl: '', writeReviewUrl: '' };
  for (const field of ['googleUrl', 'writeReviewUrl'] as const) {
    const raw = value[field] ?? '';
    if (typeof raw !== 'string') throw new ReviewInputError('Enter the review links as text.');
    const url = raw.trim();
    if (url && !safeHttpsUrl(url)) throw new ReviewInputError(`${field === 'googleUrl' ? 'The Google reviews link' : 'The write-a-review link'} must be a full https:// address.`);
    urls[field] = url;
  }
  return { enabled: value.enabled, title, rating: roundRating(value.rating), reviewCount: value.reviewCount, ...urls };
}

/** Strict server-side validation of one review from Studio. */
export function reviewInput(body: unknown, productIds?: Set<number>): ReviewInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReviewInputError('Enter valid review details.');
  const value = body as Record<string, unknown>;
  const name = typeof value.name === 'string' ? value.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > REVIEW_NAME_MAX) throw new ReviewInputError(`Enter the reviewer's name (up to ${REVIEW_NAME_MAX} characters).`);
  if (typeof value.rating !== 'number' || !Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5) {
    throw new ReviewInputError('Choose a star rating from 1 to 5.');
  }
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!text) throw new ReviewInputError('Enter the review text.');
  if (text.length > REVIEW_TEXT_MAX) throw new ReviewInputError(`Review text must be ${REVIEW_TEXT_MAX} characters or less.`);

  const rawDate = value.reviewDate === '' || value.reviewDate == null ? null : value.reviewDate;
  if (rawDate !== null && (typeof rawDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    || Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) || new Date(`${rawDate}T00:00:00Z`).toISOString().slice(0, 10) !== rawDate)) {
    throw new ReviewInputError('Enter a valid review date.');
  }

  const rawPhoto = value.photoUrl === '' || value.photoUrl == null ? null : value.photoUrl;
  if (rawPhoto !== null && (typeof rawPhoto !== 'string' || !safeHttpsUrl(rawPhoto.trim()))) {
    throw new ReviewInputError('The photo must be a full https:// image address.');
  }

  const rawProduct = value.productId === '' || value.productId == null ? null : value.productId;
  if (rawProduct !== null && (typeof rawProduct !== 'number' || !Number.isSafeInteger(rawProduct) || rawProduct < 1)) {
    throw new ReviewInputError('Choose a saree from the list.');
  }
  if (rawProduct !== null && productIds && !productIds.has(rawProduct)) throw new ReviewInputError('That saree no longer exists. Choose another one.');

  if (value.visible !== undefined && typeof value.visible !== 'boolean') throw new ReviewInputError('Choose whether the review is shown.');
  return {
    name,
    rating: value.rating,
    text,
    reviewDate: rawDate,
    photoUrl: rawPhoto === null ? null : (rawPhoto as string).trim(),
    productId: rawProduct,
    visible: value.visible === undefined ? true : value.visible,
  };
}

/** Reorder payload: every existing review ID exactly once. */
export function reviewOrderInput(body: unknown, existingIds: number[]): number[] {
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'number' || !Number.isSafeInteger(id))) throw new ReviewInputError('Send the review order as a list of IDs.');
  const unique = new Set(ids as number[]);
  if (unique.size !== ids.length || ids.length !== existingIds.length || existingIds.some((id) => !unique.has(id))) {
    throw new ReviewInputError('The review list changed. Refresh and try again.');
  }
  return ids as number[];
}

/**
 * The visibility rule: the storefront section renders only when the owner switched
 * it on AND at least one review is marked visible. Hidden reviews never leave the server.
 */
export function publicReviewsSection(settings: ReviewSettings, reviews: Review[]): PublicReviewsSection | null {
  if (!settings.enabled) return null;
  const visible = reviews
    .filter((review) => review.visible === true)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map(({ id, name, rating, text, reviewDate, photoUrl, productId }) => ({ id, name, rating, text, reviewDate, photoUrl, productId }));
  if (!visible.length) return null;
  const { enabled: _enabled, ...publicSettings } = settings;
  return { settings: publicSettings, reviews: visible };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "21 Oct 2026" for a stored YYYY-MM-DD (a calendar date, so no time-zone shift). */
export function formatReviewDate(value: string | null | undefined): string {
  const match = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}

const AVATAR_COLOURS = ['#5b2333', '#8a5a2b', '#176047', '#3d4f7c', '#7a3e65', '#a0522d'];
export function reviewAvatar(name: string): { initial: string; colour: string } {
  const initial = (name.trim().match(/\p{L}|\p{N}/u)?.[0] || '?').toLocaleUpperCase('en-IN');
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return { initial, colour: AVATAR_COLOURS[hash % AVATAR_COLOURS.length] };
}

/** Width (0–100%) of the filled layer for a rating, e.g. 4.8 → 96. */
export function starFillPercent(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.round(Math.min(5, Math.max(0, rating)) / 5 * 1000) / 10;
}
