import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { QuantityStepper } from '../src/components/QuantityStepper.tsx';

const render = (props) => renderToStaticMarkup(createElement(QuantityStepper, props));

test('quantity stepper is a labelled group with 40px tap targets and disabled min/max', () => {
  const markup = render({
    value: 1,
    onDecrease: () => {},
    onIncrease: () => {},
    decreaseDisabled: true,
    increaseDisabled: false,
  });
  expect(markup).toContain('class="quantity-stepper"');
  expect(markup).toContain('role="group"');
  expect(markup).toContain('aria-label="Quantity"');
  expect(markup).toContain('aria-label="Decrease quantity"');
  expect(markup).toContain('aria-label="Increase quantity"');
  expect(markup).toContain('disabled=""');
  expect(markup).toContain('>1<');

  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('.quantity-stepper');
  expect(css).toContain('border-radius: 999px');
  expect(css).toContain('min-width: 40px');
  expect(css).toContain('min-height: 40px');
  expect(css).toContain('width: 36px');
  expect(css).toContain('line-height: 40px');
  expect(css).toContain('border: 1px solid var(--ink)');
});

test('cart, product page and listing cards share QuantityStepper', () => {
  const cart = readFileSync(new URL('../src/app/cart/page.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf8');
  expect(cart).toContain('<QuantityStepper');
  expect(detail).toContain('<QuantityStepper');
  expect(card).toContain('<QuantityStepper');
  expect(card).toContain('variant="square"');
  expect(cart).not.toContain('variant="square"');
  expect(detail).not.toContain('variant="square"');
  expect(cart).not.toMatch(/className="qty"/);
  expect(detail).not.toMatch(/className="qty"/);
});

test('quantity stepper square variant reproduces the card square stepper markup and classes', () => {
  const markup = render({
    variant: 'square',
    value: 2,
    onDecrease: () => {},
    onIncrease: () => {},
    decreaseDisabled: false,
    increaseDisabled: true,
    decreaseLabel: 'Remove one Mayil saree',
    increaseLabel: 'Add one Mayil saree',
    'aria-label': 'Quantity of Mayil saree in bag',
  });
  expect(markup).toContain('class="card-quantity"');
  expect(markup).toContain('role="group"');
  expect(markup).toContain('aria-label="Quantity of Mayil saree in bag"');
  expect(markup).toContain('data-step="minus"');
  expect(markup).toContain('data-step="plus"');
  expect(markup).toContain('aria-label="Remove one Mayil saree"');
  expect(markup).toContain('aria-label="Add one Mayil saree"');
  expect(markup).toContain('aria-label="2 in bag"');
  expect(markup).toContain('>2<');
  expect(markup).not.toContain('quantity-stepper');
});

