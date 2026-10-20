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
    src: '/assets/hero/hero-1-four-models.webp',
    alt: 'Four models in plum, emerald, gold and ivory silk sarees',
  },
  {
    id: 'hero-2-emerald',
    src: '/assets/hero/hero-2-emerald.webp',
    alt: 'Model in emerald saree at an arched doorway',
  },
  {
    id: 'hero-3-rose',
    src: '/assets/hero/hero-3-rose.webp',
    alt: 'Model in rose pink saree seated by a brass urli',
  },
  {
    id: 'hero-4-indigo',
    src: '/assets/hero/hero-4-indigo.webp',
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

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

  // Detect user preference for reduced motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener?.('change', handler);
    return () => mediaQuery.removeEventListener?.('change', handler);
  }, []);

  // Pause rotation when browser tab is hidden
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabHidden(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto-advance every ~5 seconds when not paused, tab visible, and reduced motion not requested
  useEffect(() => {
    if (isPaused || isTabHidden || prefersReducedMotion) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeIndex, isPaused, isTabHidden, prefersReducedMotion, nextSlide]);

  const isAutoPlaying = !isPaused && !isTabHidden && !prefersReducedMotion;

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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
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
                className="hero-slide-img"
              />
            </div>
          );
        })}
      </div>

      {/* Controls: prev arrow, dot indicators, next arrow (arrows hidden on mobile) */}
      <div className="hero-controls">
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
