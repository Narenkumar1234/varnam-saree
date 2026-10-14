'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './Icons';

export function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Link className="brand brand-logo footer-logo" href="/" aria-label="Varnam home">
            <Image
              src="/assets/varnam-logo.png"
              alt="Varnam — The art of six yards, by ksk sarees"
              width={300}
              height={100}
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </Link>
          <p>
            Six yards. Countless stories.
            <br />
            Find the colours that feel like you.
          </p>
          <div className="footer-socials" aria-label="Social links">
            <a
              href="https://wa.me/919360451710?text=Hello%20Varnam%2C%20I%20would%20like%20to%20know%20more%20about%20your%20sarees."
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Message Varnam on WhatsApp"
              title="WhatsApp"
            >
              <Icon name="whatsapp" />
            </a>
            <a
              href="https://www.instagram.com/ksk_sarees"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow KSK Sarees on Instagram"
              title="Instagram"
            >
              <Icon name="instagram" />
            </a>
          </div>
        </div>

        <div>
          <h4>Explore</h4>
          <Link href="/shop">All sarees</Link>
          <Link href="/collections">Our collections</Link>
          <Link href="/story">Our story</Link>
          <Link href="/journal">The Varnam journal</Link>
        </div>

        <div>
          <h4>Here to help</h4>
          <Link href="/contact">Contact us</Link>
          <Link href="/faq">Frequently asked questions</Link>
          <Link href="/shipping">Shipping & returns</Link>
          <Link href="/track">Track your order</Link>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Varnam. Crafted with care.</span>
        <span>India · INR ₹</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
