'use client';

import React, { useEffect, useState } from 'react';
import type { Product } from '@/types';
import {
  DEFAULT_REVIEW_SETTINGS,
  REVIEW_NAME_MAX,
  REVIEW_TEXT_MAX,
  REVIEW_TITLE_MAX,
  formatReviewDate,
  type Review,
  type ReviewSettings,
} from '@/lib/reviews';
import { ReviewStars } from '@/components/ReviewsSection';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;
type Draft = { id?: number; name: string; rating: number; text: string; reviewDate: string; photoUrl: string; productId: string; visible: boolean };
const emptyDraft = (): Draft => ({ name: '', rating: 5, text: '', reviewDate: '', photoUrl: '', productId: '', visible: true });
const toDraft = (review: Review): Draft => ({
  id: review.id, name: review.name, rating: review.rating, text: review.text,
  reviewDate: review.reviewDate || '', photoUrl: review.photoUrl || '',
  productId: review.productId ? String(review.productId) : '', visible: review.visible,
});
const toPayload = (draft: Draft | Review) => ({
  name: draft.name,
  rating: draft.rating,
  text: draft.text,
  reviewDate: draft.reviewDate || null,
  photoUrl: draft.photoUrl || null,
  productId: draft.productId ? Number(draft.productId) : null,
  visible: draft.visible,
});

async function readJson(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

export function StudioReviews({ adminFetch, products }: { adminFetch: AdminFetch; products: Pick<Product, 'id' | 'name'>[] }) {
  const [settings, setSettings] = useState<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const productName = (id: number | null) => (id ? products.find((p) => p.id === id)?.name : undefined);
  const visibleCount = reviews.filter((r) => r.visible).length;

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await readJson(await adminFetch('/api/admin/reviews'), 'Unable to load reviews.');
      setSettings(data.settings); setReviews(data.reviews); setLoaded(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load reviews.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function run(task: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }

  const saveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await readJson(await adminFetch('/api/admin/reviews/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      }), 'Unable to save the review settings.');
      setSettings(data.settings);
    }, 'Review settings saved. The landing page shows them on its next load.');
  };

  const saveReview = (event: React.FormEvent) => {
    event.preventDefault();
    const editing = draft.id != null;
    void run(async () => {
      const data = await readJson(await adminFetch(editing ? `/api/admin/reviews/${draft.id}` : '/api/admin/reviews', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPayload(draft)),
      }), 'Unable to save the review.');
      setReviews((list) => editing ? list.map((r) => r.id === data.review.id ? data.review : r) : [...list, data.review]);
      setDraft(emptyDraft());
    }, editing ? 'Review updated.' : 'Review added.');
  };

  const toggleVisible = (review: Review) => void run(async () => {
    const data = await readJson(await adminFetch(`/api/admin/reviews/${review.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...toPayload(review), visible: !review.visible }),
    }), 'Unable to update the review.');
    setReviews((list) => list.map((r) => r.id === data.review.id ? data.review : r));
  }, review.visible ? `Hidden: ${review.name}'s review.` : `Shown: ${review.name}'s review.`);

  const remove = (review: Review) => {
    if (busy || !window.confirm(`Delete the review by ${review.name}? This cannot be undone.`)) return;
    void run(async () => {
      await readJson(await adminFetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' }), 'Unable to delete the review.');
      setReviews((list) => list.filter((r) => r.id !== review.id));
      if (draft.id === review.id) setDraft(emptyDraft());
    }, 'Review deleted.');
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= reviews.length) return;
    const ids = reviews.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(async () => {
      const data = await readJson(await adminFetch('/api/admin/reviews/order', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      }), 'Unable to reorder the reviews.');
      setReviews(data.reviews);
    }, 'Order saved.');
  };

  const status = !settings.enabled
    ? 'The reviews section is off, so nothing shows on the landing page.'
    : visibleCount === 0
      ? 'The section is on, but stays hidden until at least one review is shown.'
      : `Live on the landing page with ${visibleCount} review${visibleCount === 1 ? '' : 's'}.`;

  return (
    <section className="admin-panel-card studio-reviews">
      <div className="admin-panel-header">
        <div>
          <h2>Reviews</h2>
          <p className="muted">The &quot;Google reviews&quot; section near the bottom of the landing page. Copy real reviews from your Google Business profile; nothing is fetched from Google automatically.</p>
        </div>
        <button type="button" className="btn outline" disabled={busy || loading} onClick={() => void load()}>Refresh</button>
      </div>
      {error && <p className="admin-error-badge" role="alert">{error}</p>}
      {notice && <p role="status" className="coupon-feedback">{notice}</p>}
      {loading ? <p role="status">Loading…</p> : <>
        <p className={`studio-reviews-status${settings.enabled && visibleCount ? ' is-live' : ''}`} role="status">{status}</p>

        <form className="admin-edit-form studio-commerce-form" onSubmit={saveSettings} aria-labelledby="studio-reviews-settings">
          <fieldset disabled={busy || !loaded}>
            <h3 id="studio-reviews-settings">Section settings</h3>
            <label className="studio-commerce-checkbox">
              <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              Show reviews section
            </label>
            <div className="admin-form-row two-col">
              <label>Section title<input required maxLength={REVIEW_TITLE_MAX} value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} /></label>
              <label>Overall rating (1.0–5.0)<input required type="number" min={1} max={5} step={0.1} value={settings.rating} onChange={(e) => setSettings({ ...settings, rating: Number(e.target.value) })} /></label>
            </div>
            <div className="admin-form-row two-col">
              <label>Total Google reviews<input required type="number" min={0} max={10000000} step={1} value={settings.reviewCount} onChange={(e) => setSettings({ ...settings, reviewCount: Number(e.target.value) })} /></label>
              <label>Google reviews link<input type="url" inputMode="url" placeholder="https://g.page/r/…" maxLength={500} value={settings.googleUrl} onChange={(e) => setSettings({ ...settings, googleUrl: e.target.value })} /></label>
            </div>
            <div className="admin-form-row">
              <label>Write-a-review link (optional)<input type="url" inputMode="url" placeholder="https://g.page/r/…/review" maxLength={500} value={settings.writeReviewUrl} onChange={(e) => setSettings({ ...settings, writeReviewUrl: e.target.value })} /></label>
            </div>
            <div className="studio-commerce-actions"><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save review settings'}</button></div>
          </fieldset>
        </form>

        <h3 className="studio-reviews-list-title">Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <div className="studio-reviews-empty">
            <p><strong>No reviews yet.</strong> Copy your best Google reviews here: the reviewer&apos;s name, their star rating and their words exactly as written on Google.</p>
            <p className="muted">Only add genuine reviews. Customers see this section only after you switch it on and at least one review is shown.</p>
          </div>
        ) : (
          <ol className="studio-reviews-list">
            {reviews.map((review, index) => (
              <li key={review.id} className={review.visible ? '' : 'is-hidden'}>
                <div className="studio-review-main">
                  <div className="studio-review-title">
                    <strong>{review.name}</strong>
                    <ReviewStars rating={review.rating} size={13} />
                    {review.reviewDate && <span className="muted">{formatReviewDate(review.reviewDate)}</span>}
                    {!review.visible && <span className="studio-review-badge">Hidden</span>}
                  </div>
                  <p className="studio-review-text">{review.text}</p>
                  {review.productId && <p className="muted studio-review-product">Bought: {productName(review.productId) || `Saree #${review.productId} (no longer listed)`}</p>}
                </div>
                <div className="studio-review-actions">
                  <button type="button" className="btn outline" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${review.name}'s review up`}>↑</button>
                  <button type="button" className="btn outline" disabled={busy || index === reviews.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${review.name}'s review down`}>↓</button>
                  <button type="button" className="btn outline" disabled={busy} onClick={() => toggleVisible(review)}>{review.visible ? 'Hide' : 'Show'}</button>
                  <button type="button" className="btn outline" disabled={busy} onClick={() => { setDraft(toDraft(review)); setError(''); setNotice(''); }}>Edit</button>
                  <button type="button" className="btn outline" disabled={busy} onClick={() => remove(review)}>Delete</button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <form className="admin-edit-form studio-commerce-form" onSubmit={saveReview} aria-labelledby="studio-review-form-title">
          <fieldset disabled={busy || !loaded}>
            <h3 id="studio-review-form-title">{draft.id != null ? `Edit review by ${draft.name || '…'}` : 'Add a review'}</h3>
            <div className="admin-form-row two-col">
              <label>Reviewer name<input required maxLength={REVIEW_NAME_MAX} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label>Star rating
                <select required value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>)}
                </select>
              </label>
            </div>
            <label className="studio-review-textarea">Review text
              <textarea required rows={5} maxLength={REVIEW_TEXT_MAX} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              <span className="muted studio-review-counter">{draft.text.length}/{REVIEW_TEXT_MAX}</span>
            </label>
            <div className="admin-form-row two-col">
              <label>Review date (optional)<input type="date" value={draft.reviewDate} onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })} /></label>
              <label>Photo URL (optional)<input type="url" inputMode="url" placeholder="https://…" maxLength={500} value={draft.photoUrl} onChange={(e) => setDraft({ ...draft, photoUrl: e.target.value })} /></label>
            </div>
            <div className="admin-form-row two-col">
              <label>Saree they bought (optional)
                <select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}>
                  <option value="">None</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="studio-commerce-checkbox studio-review-visible">
                <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
                Show this review
              </label>
            </div>
            <div className="studio-commerce-actions">
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : draft.id != null ? 'Save review' : 'Add review'}</button>
              {draft.id != null && <button type="button" className="btn outline" onClick={() => { setDraft(emptyDraft()); setError(''); }}>Cancel edit</button>}
            </div>
          </fieldset>
        </form>
      </>}
    </section>
  );
}
