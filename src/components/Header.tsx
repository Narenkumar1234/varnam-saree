'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { Icon } from './Icons';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalBagCount } = useStore();
  const pathname = usePathname();

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <>
      <div className="announcement">
        A little tradition. A lot of you.{' '}
        <span>Complimentary delivery on orders over ₹3,000</span>
      </div>

      <header>
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

        <nav id="main-nav" className={menuOpen ? 'open' : ''} aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/shop">All sarees</Link>
          <Link href="/shop?collection=Silk">Silk stories</Link>
          <Link href="/shop?collection=Cotton">Everyday cottons</Link>
          <Link href="/shop?collection=Festive">The festive edit</Link>
          <Link className="offers-nav-link" href="/shop" aria-label="Offers: 50% off">
            <span>Offers</span>
            <span className="offers-nav-badge" aria-hidden="true">50% OFF</span>
          </Link>
          <Link href="/story">Our story</Link>
          <Link className="mobile-nav-link" href="/account">
            My account
          </Link>
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
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </header>
    </>
  );
}
