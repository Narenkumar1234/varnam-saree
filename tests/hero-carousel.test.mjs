import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import {
  HERO_SLIDES,
  getNextSlideIndex,
  getPrevSlideIndex,
  clampSlideIndex,
  HeroCarousel,
} from '../src/components/HeroCarousel.tsx';

test('slide config defines exactly 4 slides with correct asset paths and descriptive alts', () => {
  expect(HERO_SLIDES).toHaveLength(4);

  const expectedSlides = [
    {
      id: 'hero-1-four-models',
      src: '/assets/hero/hero-1-four-models.webp',
      altContains: 'four models',
    },
    {
      id: 'hero-2-emerald',
      src: '/assets/hero/hero-2-emerald.webp',
      altContains: 'emerald',
    },
    {
      id: 'hero-3-rose',
      src: '/assets/hero/hero-3-rose.webp',
      altContains: 'rose',
    },
    {
      id: 'hero-4-indigo',
      src: '/assets/hero/hero-4-indigo.webp',
      altContains: 'indigo',
    },
  ];

  expectedSlides.forEach((expected, i) => {
    const slide = HERO_SLIDES[i];
    expect(slide.id).toBe(expected.id);
    expect(slide.src).toBe(expected.src);
    expect(slide.alt.toLowerCase()).toContain(expected.altContains);

    // Verify the webp file physically exists in public/
    const diskPath = new URL(`../public${slide.src}`, import.meta.url).pathname;
    expect(existsSync(diskPath)).toBe(true);
  });
});

test('rotation helper functions advance, rewind and wrap around correctly', () => {
  const total = 4;

  // Next slide progression
  expect(getNextSlideIndex(0, total)).toBe(1);
  expect(getNextSlideIndex(1, total)).toBe(2);
  expect(getNextSlideIndex(2, total)).toBe(3);
  expect(getNextSlideIndex(3, total)).toBe(0); // wrap-around

  // Prev slide progression
  expect(getPrevSlideIndex(0, total)).toBe(3); // wrap-around
  expect(getPrevSlideIndex(3, total)).toBe(2);
  expect(getPrevSlideIndex(2, total)).toBe(1);
  expect(getPrevSlideIndex(1, total)).toBe(0);

  // Clamping helper
  expect(clampSlideIndex(0, total)).toBe(0);
  expect(clampSlideIndex(3, total)).toBe(3);
  expect(clampSlideIndex(4, total)).toBe(0);
  expect(clampSlideIndex(-1, total)).toBe(3);
  expect(clampSlideIndex(0, 0)).toBe(0);
});

test('HeroCarousel renders accessible markup, dot indicators, desktop arrows, and slides', () => {
  const markup = renderToStaticMarkup(createElement(HeroCarousel));

  // Carousel container with ARIA landmark
  expect(markup).toContain('class="hero-carousel"');
  expect(markup).toContain('role="region"');
  expect(markup).toContain('aria-roledescription="carousel"');

  // Slides container: live region stays quiet while auto-rotating (WAI-ARIA carousel pattern)
  expect(markup).toContain('aria-live="off"');

  // Arrows and dots grouped in one controls bar
  expect(markup).toContain('class="hero-controls"');

  // First slide is active initially, others inactive
  expect(markup).toContain('hero-slide is-active');
  expect(markup).toContain('hero-1-four-models.webp');
  expect(markup).toContain('hero-2-emerald.webp');
  expect(markup).toContain('hero-3-rose.webp');
  expect(markup).toContain('hero-4-indigo.webp');

  // Desktop navigation arrows with aria labels
  expect(markup).toContain('aria-label="Previous slide"');
  expect(markup).toContain('aria-label="Next slide"');
  expect(markup).toContain('hero-carousel-prev');
  expect(markup).toContain('hero-carousel-next');

  // Dot indicators tablist and 4 dot buttons
  expect(markup).toContain('role="tablist"');
  expect(markup).toContain('hero-dots');
  const dotMatches = markup.match(/class="hero-dot\b[^"]*"/g) || [];
  expect(dotMatches).toHaveLength(4);
  expect(markup).toContain('aria-selected="true"');
});

test('landing page src/app/page.tsx renders HeroCarousel alongside headline and counter', () => {
  const pageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

  expect(pageSource).toContain("import { HeroCarousel } from '@/components/HeroCarousel';");
  expect(pageSource).toContain('<section className="hero">');
  expect(pageSource).toContain('<HeroCarousel />');
  expect(pageSource).toContain('Some stories');
  expect(pageSource).toContain('Discover the collection');
  expect(pageSource).toContain('Silk, in its finest form');
});

test('globals.css configures crossfade, responsive heights, and prefers-reduced-motion', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  // Desktop hero min-height preserved
  expect(css).toContain('min-height: clamp(560px, 72vh, 760px);');
  expect(css).toContain('min-height: clamp(620px, 76vh, 840px);');

  // Crossfade transition
  expect(css).toContain('.hero-slide');
  expect(css).toContain('.hero-slide.is-active');
  expect(css).toContain('opacity: 0;');
  expect(css).toContain('opacity: 1;');

  // Respects prefers-reduced-motion
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('transition: none !important;');

  // Mobile stacked layout (height 400px and hidden arrows)
  expect(css).toContain('height: 400px;');
  expect(css).toContain('.hero-carousel-arrow');
  expect(css).toContain('display: none;');
});
