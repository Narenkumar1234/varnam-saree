import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, getMarqueeMessages } from '../src/lib/commerce.ts';
import { HERO_IMAGE_SIZES } from '../src/components/HeroCarousel.tsx';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('announcement messages are rendered, blank-free and de-duplicated', () => {
  const settings = { ...DEFAULT_SETTINGS, marqueeMessage1: 'Dispatch in 2 days', marqueeMessage2: 'Free delivery on orders above {freeDeliveryThreshold}', marqueeMessage3: '  dispatch   in 2 DAYS ' };
  const messages = getMarqueeMessages(settings);
  expect(messages).toHaveLength(2);
  expect(messages[0]).toBe('Dispatch in 2 days');
  expect(messages[1]).toContain('₹2,999');
  expect(getMarqueeMessages({ ...settings, marqueeMessage3: '' })).toHaveLength(2);
});

test('reduced motion shows a single 38px line instead of the stacked track', () => {
  const block = css.slice(css.indexOf('.site-marquee-single {'), css.indexOf('header {\n  height: 106px;'));
  expect(block).toContain('height: 38px;');
  expect(block).toContain('white-space: nowrap;');
  expect(block).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.site-marquee-track \{\s*display: none;/);
  expect(block).not.toContain('flex-wrap: wrap');
  const header = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
  expect(header).toContain('className="site-marquee-single"');
  expect(header).toContain('4000');
});

test('hero sizes reflect the cropped render width so phones at DPR2+ get >=1920w', () => {
  expect(HERO_IMAGE_SIZES.startsWith('(max-width: 700px) 712px')).toBe(true);
  expect(HERO_IMAGE_SIZES).toBe('(max-width: 700px) 712px, (max-width: 1600px) 100vw, 1600px');
  expect(HERO_IMAGE_SIZES).not.toContain('1352px');
  const src = readFileSync(new URL('../src/components/HeroCarousel.tsx', import.meta.url), 'utf8');
  expect(src).toContain('sizes={HERO_IMAGE_SIZES}');
});

test('route loading placeholder fills the viewport so streamed content does not shift the footer', () => {
  expect(css).toMatch(/\.page-loading-container \{[^}]*min-height: 100svh;/);
});

test('wide screens never show the same marquee message twice at once', () => {
  expect(css).toMatch(/@media \(min-width: 701px\) \{\s*\.site-marquee-dup \{\s*display: none;/);
  expect(css).toContain('min-width: calc(100vw + 400px);');
  const header = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
  expect(header).toContain('site-marquee-dup');
});
