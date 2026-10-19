'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { Icon } from './Icons';
import { renderMarquee } from '@/lib/commerce';
import { validateCoupon } from '@/lib/coupons';
import { getProductDiscountPercentage } from '@/lib/shop-filters';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dialogOpen = menuOpen && isMobile;
  const { totalBagCount, commerce, products } = useStore();
  const collectionLinks = [...new Set(products.map((product) => product.collection))].filter(Boolean).slice(0, 3);
  const couponOffer = commerce.coupons.filter((coupon) => validateCoupon(coupon.code, commerce.coupons, Number.MAX_SAFE_INTEGER).valid).sort((a, b) => b.percentage - a.percentage)[0];
  const couponDiscount = couponOffer?.percentage || 0;
  const productDiscounts = (products || []).map(getProductDiscountPercentage).filter((pct) => pct > 0);
  const maxProductDiscount = productDiscounts.length > 0 ? Math.max(...productDiscounts) : 0;
  const bestDiscount = Math.max(couponDiscount, maxProductDiscount);
  const hasOffer = bestDiscount > 0;
  const offersHref = bestDiscount >= 50 ? '/shop?offers=50' : (bestDiscount > 0 ? `/shop?offers=${bestDiscount}` : '/shop?offers=50');
  const pathname = usePathname();

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Keep dialog behavior aligned with the CSS mobile breakpoint.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 850px)');
    const update = () => { setIsMobile(media.matches); if (!media.matches) setMenuOpen(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!dialogOpen || !nav) return;
    const focusable = () => Array.from(nav.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]')).filter((element) => {
      const style = window.getComputedStyle(element);
      return element.tabIndex >= 0 && !element.closest('[hidden], [inert]') && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const focusFirst = () => (focusable()[0] || nav).focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenuOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); nav.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !nav.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const containFocus = (event: FocusEvent) => { if (!nav.contains(event.target as Node)) focusFirst(); };
    // Inert sibling branches up to body, never the dialog's own ancestors.
    const background = new Map<HTMLElement, string | null>();
    let branch: HTMLElement = nav;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.set(sibling, sibling.getAttribute('inert')); sibling.setAttribute('inert', '');
        }
      }
      branch = branch.parentElement;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', containFocus, true);
    focusFirst();
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', containFocus, true);
      for (const [element, original] of background) {
        if (original === null) element.removeAttribute('inert'); else element.setAttribute('inert', original);
      }
      document.body.style.overflow = overflow;
      toggleRef.current?.focus({ preventScroll: true });
    };
  }, [dialogOpen]);

  return (
    <>
      <div className="site-marquee" role="region" aria-label="Store updates">
        <div className="site-marquee-track">
          {(() => {
            const rawMessages = [
              commerce.settings.marqueeMessage1,
              commerce.settings.marqueeMessage2,
              commerce.settings.marqueeMessage3,
            ].filter((m): m is string => Boolean(m && m.trim()));
            const messages = rawMessages.length > 0 ? rawMessages : [commerce.settings.marqueeMessage1, commerce.settings.marqueeMessage2];
            const repeated = [...messages, ...messages];
            return (
              <>
                <p className="site-marquee-group">
                  {repeated.map((msg, idx) => (
                    <React.Fragment key={`p1-${idx}`}>
                      <span>{renderMarquee(msg, commerce.settings)}</span>
                      <span className="site-marquee-star" aria-hidden="true">✦</span>
                    </React.Fragment>
                  ))}
                </p>
                <p className="site-marquee-group" aria-hidden="true">
                  {repeated.map((msg, idx) => (
                    <React.Fragment key={`p2-${idx}`}>
                      <span>{renderMarquee(msg, commerce.settings)}</span>
                      <span className="site-marquee-star">✦</span>
                    </React.Fragment>
                  ))}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      <header className={dialogOpen ? 'mobile-nav-is-open' : undefined}>
        <Link className="brand brand-logo" href="/" aria-label="Varnam home">
          <Image
            src="/assets/varnam-logo.png"
            alt="Varnam — The art of six yards, by ksk sarees"
            width={300}
            height={100}
            priority
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </Link>

        <nav ref={navRef} id="main-nav" className={dialogOpen ? 'open' : ''} aria-label="Main navigation" role={dialogOpen ? 'dialog' : undefined} aria-modal={dialogOpen ? true : undefined} aria-hidden={isMobile && !dialogOpen ? true : undefined} tabIndex={dialogOpen ? -1 : undefined} onClick={(event) => { if ((event.target as Element).closest('a[href]')) setMenuOpen(false); }}>
          <Link href="/">Home</Link>
          <Link href="/shop">All sarees</Link>
          {collectionLinks.map((collection) => <Link key={collection} href={`/shop?collection=${encodeURIComponent(collection)}`}>{collection}</Link>)}
          <Link
            className="offers-nav-link"
            href={offersHref}
            aria-label={hasOffer ? `Offers: up to ${bestDiscount}% off` : 'Offers'}
          >
            <span>Offers</span>
            {hasOffer && <span className="offers-nav-badge" aria-hidden="true">{bestDiscount}% OFF</span>}
          </Link>
          <Link href="/story">Our story</Link>
          <Link className="mobile-nav-link" href="/account">
            My account
          </Link>
          {dialogOpen && <button type="button" className="mobile-nav-close" onClick={() => setMenuOpen(false)}><Icon name="close" /> Close menu</button>}
        </nav>

        <div className="tools">
          <Link href="/search" aria-label="Search" title="Search">
            <Icon name="search" />
          </Link>
          <Link href="/account" aria-label="Account" title="Account">
            <Icon name="user" />
          </Link>
          <Link href="/wishlist" aria-label="Wishlist" title="Wishlist">
            <Icon name="heart" />
          </Link>
          <Link
            href="/cart"
            aria-label={totalBagCount ? `Shopping bag, ${totalBagCount} item${totalBagCount === 1 ? '' : 's'}` : 'Shopping bag'}
            title="Shopping bag"
          >
            <Icon name="bag" />
            {totalBagCount > 0 && (
              <small id="bagCount" aria-hidden="true">
                {totalBagCount > 99 ? '99+' : totalBagCount}
              </small>
            )}
          </Link>
        </div>

        <button
          ref={toggleRef}
          className="mobile-menu"
          type="button"
          aria-label={dialogOpen ? 'Close menu' : 'Open menu'}
          aria-controls="main-nav"
          aria-expanded={dialogOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={dialogOpen ? 'close' : 'menu'} />
        </button>
      </header>
    </>
  );
}
