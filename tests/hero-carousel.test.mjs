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
  HERO_AUTOPLAY_MS,
  HERO_IMAGE_QUALITY,
  isHeroAutoplayPaused,
} from '../src/components/HeroCarousel.tsx';

test('slide config defines exactly 4 slides with correct asset paths and descriptive alts', () => {
  expect(HERO_SLIDES).toHaveLength(4);

  const expectedSlides = [
    {
      id: 'hero-1-four-models',
      src: '/assets/hero/hero-1-four-models-hd.webp',
      altContains: 'four models',
    },
    {
      id: 'hero-2-emerald',
      src: '/assets/hero/hero-2-emerald-hd.webp',
      altContains: 'emerald',
    },
    {
      id: 'hero-3-rose',
      src: '/assets/hero/hero-3-rose-hd.webp',
      altContains: 'rose',
    },
    {
      id: 'hero-4-indigo',
      src: '/assets/hero/hero-4-indigo-hd.webp',
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
  expect(markup).toContain('hero-1-four-models-hd.webp');
  expect(markup).toContain('hero-2-emerald-hd.webp');
  expect(markup).toContain('hero-3-rose-hd.webp');
  expect(markup).toContain('hero-4-indigo-hd.webp');

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
  expect(css).toContain('transition: opacity 150ms linear, visibility 150ms linear !important;');

  // Mobile stacked layout (height 400px and hidden arrows)
  expect(css).toContain('height: 400px;');
  expect(css).toContain('.hero-carousel-arrow');
  expect(css).toContain('display: none;');
});

test('hero caption sits in the left copy column and the copy has a readability wash', () => {
  const pageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const copyStart = pageSource.indexOf('<div className="hero-copy">');
  const caption = pageSource.indexOf('<div className="hero-counter">');
  const sectionEnd = pageSource.indexOf('</section>', copyStart);
  const copyEnd = pageSource.lastIndexOf('</div>', sectionEnd);
  expect(copyStart).toBeGreaterThan(-1);
  expect(caption).toBeGreaterThan(copyStart);
  expect(caption).toBeLessThan(copyEnd);

  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('@media (min-width: 1101px) {\n  .hero-carousel::after');
  expect(css).not.toMatch(/\.hero-counter \{\s*position: absolute;/);
});

test('tablet hero stacks like phone with no wash, phone caption aligns left', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  const tabletStart = css.indexOf('@media (min-width: 701px) and (max-width: 1100px) {\n  .hero {');
  expect(tabletStart).toBeGreaterThan(-1);
  const tablet = css.slice(tabletStart, css.indexOf('\n}\n', tabletStart));
  expect(tablet).toContain('flex-direction: column;');
  expect(tablet).toContain('position: relative;');
  expect(tablet).not.toContain('::after');
  // No wash rule anywhere targets the tablet range
  expect(css).not.toMatch(/@media \(min-width: 701px\)[^{]*\{\s*\.hero-carousel::after/);

  const phoneCounter = css.match(/@media \(max-width: 700px\)[\s\S]*?\.hero-counter \{([^}]*)\}/);
  expect(phoneCounter).not.toBeNull();
  expect(phoneCounter[1]).toContain('text-align: left;');
  expect(phoneCounter[1]).not.toContain('text-align: center;');
});

test('autoplay always runs except while hovering controls, keyboard-focused, or tab hidden', () => {
  expect(HERO_AUTOPLAY_MS).toBe(5000);
  const idle = { hoveringControls: false, keyboardFocusInside: false, tabHidden: false };
  expect(isHeroAutoplayPaused(idle)).toBe(false);
  expect(isHeroAutoplayPaused({ ...idle, hoveringControls: true })).toBe(true);
  expect(isHeroAutoplayPaused({ ...idle, keyboardFocusInside: true })).toBe(true);
  expect(isHeroAutoplayPaused({ ...idle, tabHidden: true })).toBe(true);

  const src = readFileSync(new URL('../src/components/HeroCarousel.tsx', import.meta.url), 'utf8');
  // Reduced motion no longer disables autoplay
  expect(src).not.toContain('prefersReducedMotion');
  // Mouse click focus must not pause; only :focus-visible does
  expect(src).toContain(":focus-visible");
});

test('hero images are high-res sources served at quality 90 with retina widths', () => {
  expect(HERO_IMAGE_QUALITY).toBe(90);
  // (Other test files mock next/image globally, so assert on source not markup.)
  const src = readFileSync(new URL('../src/components/HeroCarousel.tsx', import.meta.url), 'utf8');
  expect(src).toContain('quality={HERO_IMAGE_QUALITY}');
  expect(src).toContain('sizes={HERO_IMAGE_SIZES}');

  const cfg = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  expect(cfg).toMatch(/qualities:\s*\[[^\]]*90/);
  expect(cfg).toMatch(/deviceSizes:\s*\[[^\]]*2560[^\]]*3840/);

  for (const slide of HERO_SLIDES) {
    expect(existsSync(new URL(`../public${slide.src}`, import.meta.url))).toBe(true);
  }
});
