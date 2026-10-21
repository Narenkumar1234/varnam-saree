'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
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

const textLength = (text: string) => text.trim().length;

/**
 * Add / edit form. The text box has no maxLength, so a long paste is never cut off
 * silently: the live counter turns into an error and saving is blocked until it fits.
 */
function ReviewForm({ draft, setDraft, products, busy, disabled, onSubmit, onCancel, autoFocus = false }: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  products: Pick<Product, 'id' | 'name'>[];
  busy: boolean;
  disabled: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [pasteNote, setPasteNote] = useState('');
  const length = textLength(draft.text);
  const over = length - REVIEW_TEXT_MAX;
  const editing = draft.id != null;

  useEffect(() => {
    if (!autoFocus) return;
    nameRef.current?.focus({ preventScroll: true });
    // Bring the whole form into view from its heading (it can be taller than a phone screen).
    nameRef.current?.closest('form')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [autoFocus]);

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text');
    const target = event.currentTarget;
    const next = target.value.slice(0, target.selectionStart) + pasted + target.value.slice(target.selectionEnd);
    setPasteNote(textLength(next) > REVIEW_TEXT_MAX ? `The pasted text makes the review ${textLength(next)} characters long. Google reviews can be longer than ${REVIEW_TEXT_MAX}, so shorten it before saving; nothing was cut off.` : '');
  };

  const submit = (event: React.FormEvent) => {
    if (over > 0) { event.preventDefault(); document.getElementById(`${id}-text`)?.focus(); return; }
    onSubmit(event);
  };

  return (
    <form className={`admin-edit-form studio-commerce-form studio-review-form${editing ? ' is-editing' : ''}`} onSubmit={submit} aria-labelledby={`${id}-title`}>
      <fieldset disabled={disabled}>
        <h3 id={`${id}-title`}>{editing ? `Edit review by ${draft.name || '…'}` : 'Add a review'}</h3>
        <div className="admin-form-row two-col">
          <label>Reviewer name<input ref={nameRef} required maxLength={REVIEW_NAME_MAX} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Star rating
            <select required value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>)}
            </select>
          </label>
        </div>
        <div className="studio-review-textfield">
          <label htmlFor={`${id}-text`}>Review text</label>
          <textarea
            id={`${id}-text`}
            className="studio-review-textbox"
            required
            rows={5}
            value={draft.text}
            aria-invalid={over > 0 || undefined}
            aria-describedby={`${id}-count${over > 0 ? ` ${id}-over` : ''}`}
            onPaste={onPaste}
            onChange={(e) => { setDraft({ ...draft, text: e.target.value }); if (textLength(e.target.value) <= REVIEW_TEXT_MAX) setPasteNote(''); }}
          />
          <div className="studio-review-count-row">
            <span id={`${id}-count`} className={`studio-review-counter${over > 0 ? ' is-over' : ''}`}>{length}/{REVIEW_TEXT_MAX}</span>
          </div>
          <p id={`${id}-over`} className="studio-review-over" role="alert" hidden={over <= 0}>
            {over > 0 ? (pasteNote || `The review is ${over} character${over === 1 ? '' : 's'} over the ${REVIEW_TEXT_MAX}-character limit. Shorten it to save.`) : ''}
          </p>
        </div>
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
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save review' : 'Add review'}</button>
          {onCancel && <button type="button" className="btn outline" onClick={onCancel}>Cancel edit</button>}
        </div>
      </fieldset>
    </form>
  );
}

const ArrowIcon = ({ up }: { up: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={up ? 'M12 19V5m-6 6l6-6 6 6' : 'M12 5v14m-6-6l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function StudioReviews({ adminFetch, products }: { adminFetch: AdminFetch; products: Pick<Product, 'id' | 'name'>[] }) {
  const [settings, setSettings] = useState<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  /** The review being edited in place in the list (separate from the "Add a review" form). */
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
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

  const addReview = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await readJson(await adminFetch('/api/admin/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPayload(draft)),
      }), 'Unable to save the review.');
      setReviews((list) => [...list, data.review]);
      setDraft(emptyDraft());
    }, 'Review added.');
  };

  const focusRowAction = (reviewId: number) => {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-edit-review="${reviewId}"]`)?.focus());
  };

  const startEdit = (review: Review) => {
    setEditDraft(toDraft(review)); setError(''); setNotice('');
  };
  const cancelEdit = () => {
    const id = editDraft?.id;
    setEditDraft(null); setError('');
    if (id != null) focusRowAction(id);
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editDraft || editDraft.id == null) return;
    const current = editDraft;
    void run(async () => {
      const data = await readJson(await adminFetch(`/api/admin/reviews/${current.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPayload(current)),
      }), 'Unable to save the review.');
      setReviews((list) => list.map((r) => r.id === data.review.id ? data.review : r));
      setEditDraft(null);
      focusRowAction(data.review.id);
    }, 'Review updated.');
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
      if (editDraft?.id === review.id) setEditDraft(null);
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
              <label>Overall rating
                <input required type="number" inputMode="decimal" min={1} max={5} step={0.1} value={settings.rating} aria-describedby="studio-reviews-rating-hint" onChange={(e) => setSettings({ ...settings, rating: Number(e.target.value) })} />
                <span id="studio-reviews-rating-hint" className="muted studio-field-hint">e.g. 4.8, from 1.0 to 5.0 (one decimal, as shown on Google)</span>
              </label>
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
            {reviews.map((review, index) => editDraft?.id === review.id ? (
              <li key={review.id} className="is-editing">
                <ReviewForm draft={editDraft} setDraft={setEditDraft} products={products} busy={busy} disabled={busy || !loaded} onSubmit={saveEdit} onCancel={cancelEdit} autoFocus />
              </li>
            ) : (
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
                <div className="studio-review-actions" role="group" aria-label={`Actions for ${review.name}'s review`}>
                  <div className="studio-review-move">
                    <button type="button" className="studio-review-btn is-icon" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${review.name}'s review up`} title="Move up"><ArrowIcon up /></button>
                    <button type="button" className="studio-review-btn is-icon" disabled={busy || index === reviews.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${review.name}'s review down`} title="Move down"><ArrowIcon up={false} /></button>
                  </div>
                  <button type="button" className="studio-review-btn" disabled={busy} onClick={() => toggleVisible(review)} aria-label={`${review.visible ? 'Hide' : 'Show'} ${review.name}'s review`}>{review.visible ? 'Hide' : 'Show'}</button>
                  <button type="button" className="studio-review-btn" data-edit-review={review.id} disabled={busy || editDraft != null} onClick={() => startEdit(review)} aria-label={`Edit ${review.name}'s review`}>Edit</button>
                  <button type="button" className="studio-review-btn is-danger" disabled={busy} onClick={() => remove(review)} aria-label={`Delete ${review.name}'s review`}>Delete</button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <ReviewForm draft={draft} setDraft={setDraft} products={products} busy={busy} disabled={busy || !loaded} onSubmit={addReview} />
      </>}
    </section>
  );
}
