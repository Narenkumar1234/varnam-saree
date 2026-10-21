'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-1-four-models',
    src: '/assets/hero/hero-1-four-models-hd.webp',
    alt: 'Four models in plum, emerald, gold and ivory silk sarees',
  },
  {
    id: 'hero-2-emerald',
    src: '/assets/hero/hero-2-emerald-hd.webp',
    alt: 'Model in emerald saree at an arched doorway',
  },
  {
    id: 'hero-3-rose',
    src: '/assets/hero/hero-3-rose-hd.webp',
    alt: 'Model in rose pink saree seated by a brass urli',
  },
  {
    id: 'hero-4-indigo',
    src: '/assets/hero/hero-4-indigo-hd.webp',
    alt: 'Model in indigo saree walking in a courtyard',
  },
];

export function getNextSlideIndex(currentIndex: number, total: number): number {
  if (total <= 0) return 0;
  return (currentIndex + 1) % total;
}

export function getPrevSlideIndex(currentIndex: number, total: number): number {
  if (total <= 0) return 0;
  return (currentIndex - 1 + total) % total;
}

export function clampSlideIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

/** Auto-advance interval. Always on (including under reduced motion, where the
 * crossfade is shortened in CSS instead). */
export const HERO_AUTOPLAY_MS = 5000;

/** next/image quality for the full-bleed hero (must be listed in next.config images.qualities). */
export const HERO_IMAGE_QUALITY = 90;

/**
 * Whether autoplay should be paused. Only two things pause it:
 * - the pointer resting on the dots/arrows (resumes as soon as it leaves), and
 * - keyboard focus inside the carousel (resumes when focus leaves).
 * A hidden tab also pauses. Clicking a dot/arrow or swiping only resets the timer.
 */
export function isHeroAutoplayPaused(state: {
  hoveringControls: boolean;
  keyboardFocusInside: boolean;
  tabHidden: boolean;
}): boolean {
  return state.hoveringControls || state.keyboardFocusInside || state.tabHidden;
}

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveringControls, setHoveringControls] = useState(false);
  const [keyboardFocusInside, setKeyboardFocusInside] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => getNextSlideIndex(prev, HERO_SLIDES.length));
  }, []);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => getPrevSlideIndex(prev, HERO_SLIDES.length));
  }, []);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(clampSlideIndex(index, HERO_SLIDES.length));
  }, []);

  // Pause rotation when browser tab is hidden
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabHidden(document.visibilityState === 'hidden');
    };
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const isPaused = isHeroAutoplayPaused({
    hoveringControls,
    keyboardFocusInside,
    tabHidden: isTabHidden,
  });

  // Auto-advance. Keyed on activeIndex, so any manual change (dot, arrow,
  // swipe, key) restarts the full interval rather than stopping autoplay.
  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(nextSlide, HERO_AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, isPaused, nextSlide]);

  const isAutoPlaying = !isPaused;

  // Swipe handling. Listeners sit on the whole hero section (the carousel's
  // parent) so a swipe that starts on the headline/CTA also changes slide.
  // They are passive and never preventDefault, so taps on buttons/links and
  // vertical page scrolling keep working.
  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = carouselRef.current;
    const target: HTMLElement | null = el?.parentElement ?? el;
    if (!target) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    };

    target.addEventListener('touchstart', handleTouchStart, { passive: true });
    target.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      target.removeEventListener('touchstart', handleTouchStart);
      target.removeEventListener('touchend', handleTouchEnd);
    };
  }, [nextSlide, prevSlide]);

  // Keyboard navigation when carousel or its controls have focus
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  };

  return (
    <div
      ref={carouselRef}
      className="hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero saree showcase"
      onFocus={(e) => {
        // Only keyboard focus pauses; a mouse click/tap that focuses the
        // region or a dot must not stop autoplay.
        let keyboard = true;
        try {
          keyboard = (e.target as HTMLElement).matches(':focus-visible');
        } catch {
          keyboard = true;
        }
        setKeyboardFocusInside(keyboard);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setKeyboardFocusInside(false);
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="hero-slides" aria-live={isAutoPlaying ? 'off' : 'polite'}>
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.id}
              className={`hero-slide${isActive ? ' is-active' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${HERO_SLIDES.length}: ${slide.alt}`}
              aria-hidden={!isActive}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                loading={index === 0 ? undefined : 'lazy'}
                sizes="100vw"
                quality={HERO_IMAGE_QUALITY}
                className="hero-slide-img"
              />
            </div>
          );
        })}
      </div>

      {/* Controls: prev arrow, dot indicators, next arrow (arrows hidden on mobile) */}
      <div
        className="hero-controls"
        onMouseEnter={() => setHoveringControls(true)}
        onMouseLeave={() => setHoveringControls(false)}
      >
        <button
          type="button"
          className="hero-carousel-arrow hero-carousel-prev"
          aria-label="Previous slide"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Dot Indicators */}
        <div className="hero-dots" role="tablist" aria-label="Hero carousel slides">
          {HERO_SLIDES.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to slide ${index + 1}: ${slide.alt}`}
                className={`hero-dot${isActive ? ' is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(index);
                }}
              />
            );
          })}
        </div>
        <button
          type="button"
          className="hero-carousel-arrow hero-carousel-next"
          aria-label="Next slide"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default HeroCarousel;
