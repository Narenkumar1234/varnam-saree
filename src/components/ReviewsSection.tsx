'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { formatReviewDate, reviewAvatar, starFillPercent, type PublicReview, type PublicReviewsSection } from '@/lib/reviews';

/**
 * Reviews this long may overflow the 5-line clamp, so the server renders a "Read more"
 * slot for them. After mount the text is measured: if it fits, the button is hidden
 * but keeps its space (visibility), so nothing shifts.
 */
const READ_MORE_CANDIDATE_AT = 140;
const STAR_PATH = 'M10 1.6l2.47 5.3 5.8.68-4.3 3.96 1.15 5.73L10 14.4l-5.12 2.87 1.15-5.73-4.3-3.96 5.8-.68z';

/** Five stars with a partial fill (e.g. 4.8). Decorative layers; the label carries the value. */
export function ReviewStars({ rating, size = 16, label }: { rating: number; size?: number; label?: string }) {
  const row = (className: string) => (
    <svg className={className} width={size * 5} height={size} viewBox="0 0 100 20" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={STAR_PATH} transform={`translate(${i * 20} 0)`} />)}
    </svg>
  );
  return (
    <span className="review-stars" role="img" aria-label={label || `Rated ${rating} out of 5`} style={{ width: size * 5, height: size }}>
      {row('review-stars-base')}
      <span className="review-stars-fill" style={{ width: `${starFillPercent(rating)}%` }}>{row('')}</span>
    </span>
  );
}

/** Google "G" mark, inline (no external request). */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg className="google-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function ReviewAvatar({ review }: { review: PublicReview }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const { initial, colour } = reviewAvatar(review.name);
  if (review.photoUrl && !photoFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- owner-supplied external URL, fixed 40px box
      <img className="review-avatar" src={review.photoUrl} alt="" width={40} height={40} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
    );
  }
  return <span className="review-avatar review-avatar-initial" style={{ background: colour }} aria-hidden="true">{initial}</span>;
}

function ReviewCard({ review }: { review: PublicReview }) {
  const { getProductById } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [fits, setFits] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();
  const product = review.productId ? getProductById(review.productId) : undefined;
  const date = formatReviewDate(review.reviewDate);
  const long = review.text.length > READ_MORE_CANDIDATE_AT;

  useEffect(() => {
    const text = textRef.current;
    if (!long || expanded || !text) return;
    const measure = () => setFits(text.scrollHeight <= text.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [long, expanded]);
  return (
    <li className="review-card">
      <article aria-label={`Review by ${review.name}`}>
        <div className="review-card-head">
          <ReviewAvatar review={review} />
          <div className="review-card-meta">
            <strong className="review-name">{review.name}</strong>
            <div className="review-card-sub">
              <ReviewStars rating={review.rating} size={14} />
              {date && <time dateTime={review.reviewDate || undefined}>{date}</time>}
            </div>
          </div>
          <GoogleMark size={16} />
        </div>
        <p id={textId} ref={textRef} className={`review-text${long && !expanded ? ' is-clamped' : ''}`}>{review.text}</p>
        {long && (
          <button
            type="button"
            className={`review-more${fits && !expanded ? ' is-unneeded' : ''}`}
            aria-expanded={expanded}
            aria-controls={textId}
            aria-hidden={fits && !expanded ? true : undefined}
            tabIndex={fits && !expanded ? -1 : undefined}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {product && (
          <p className="review-product">
            Bought: <Link href={`/product/${product.id}`}>{product.name}</Link>
          </p>
        )}
      </article>
    </li>
  );
}

export function ReviewsSection({ section }: { section: PublicReviewsSection }) {
  const { settings, reviews } = section;
  const trackRef = useRef<HTMLUListElement>(null);
  const trackId = useId();
  const [edges, setEdges] = useState({ start: true, end: false });
  const count = settings.reviewCount > 0 ? settings.reviewCount : reviews.length;

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({ start: track.scrollLeft <= 2, end: track.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    updateEdges();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateEdges]);

  const scrollByCard = (direction: 1 | -1, toEnd = false) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.review-card');
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
    const step = card ? card.offsetWidth + gap : track.clientWidth * 0.8;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (toEnd) track.scrollTo({ left: direction > 0 ? track.scrollWidth : 0, behavior });
    else track.scrollBy({ left: direction * step, behavior });
  };

  // With mandatory snapping a small key scroll snaps back, so keys move a whole card.
  const onTrackKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget) return;
    const moves: Record<string, [1 | -1, boolean]> = { ArrowRight: [1, false], ArrowLeft: [-1, false], Home: [-1, true], End: [1, true] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    scrollByCard(move[0], move[1]);
  };

  return (
    <section className="section reviews-section" aria-labelledby={`${trackId}-title`}>
      <div className="reviews-head">
        <div className="reviews-heading">
          <h2 id={`${trackId}-title`}>{settings.title}</h2>
          <div className="reviews-summary">
            <GoogleMark size={22} />
            <strong className="reviews-score">{settings.rating.toFixed(1)}</strong>
            <ReviewStars rating={settings.rating} size={18} label={`Rated ${settings.rating.toFixed(1)} out of 5 on Google`} />
            <span className="reviews-count">Based on {count.toLocaleString('en-IN')} Google review{count === 1 ? '' : 's'}</span>
          </div>
          {(settings.googleUrl || settings.writeReviewUrl) && (
            <div className="reviews-links">
              {settings.googleUrl && (
                <a className="text-link" href={settings.googleUrl} target="_blank" rel="noopener noreferrer">
                  See all reviews on Google<span className="sr"> (opens in a new tab)</span>
                </a>
              )}
              {settings.writeReviewUrl && (
                <a className="text-link" href={settings.writeReviewUrl} target="_blank" rel="noopener noreferrer">
                  Write a review<span className="sr"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          )}
        </div>
        <div className="reviews-arrows">
          <button type="button" aria-controls={trackId} aria-label="Previous reviews" disabled={edges.start} onClick={() => scrollByCard(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" aria-controls={trackId} aria-label="Next reviews" disabled={edges.end} onClick={() => scrollByCard(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      {/* Focusable scroller: arrow keys scroll it; cards snap on swipe. */}
      <ul id={trackId} ref={trackRef} className="reviews-track" tabIndex={0} aria-label="Customer reviews, scroll sideways for more" onScroll={updateEdges} onKeyDown={onTrackKeyDown}>
        {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </ul>
    </section>
  );
}
