'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from './Icons';

/**
 * Up to 1100px the fixed WhatsApp/Instagram stack would cover card hearts, Add to
 * bag / Buy now buttons and the delivery Check button, so it only appears once the
 * footer (which also carries these links) fills the bottom of the screen. Above
 * 1100px it is always shown, slimmer, beside a right-hand gutter that page content
 * and footer links never enter (see globals.css).
 */
export function FloatingSocials() {
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') { setFooterInView(true); return; }
    // Intersecting only when the footer reaches at least 150px above the viewport bottom,
    // i.e. the stack (about 122px tall) sits over the footer, not over page content.
    const observer = new IntersectionObserver(
      ([entry]) => setFooterInView(entry.isIntersecting),
      { rootMargin: '0px 0px -150px 0px' },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`floating-socials${footerInView ? '' : ' is-compact-hidden'}`} aria-label="Connect with Varnam">
      <a
        className="social-whatsapp"
        href="https://wa.me/919360451710?text=Hello%20Varnam%2C%20I%20would%20like%20to%20know%20more%20about%20your%20sarees."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message Varnam on WhatsApp"
        title="WhatsApp"
      >
        <Icon name="whatsapp" />
      </a>
      <a
        className="social-instagram"
        href="https://www.instagram.com/ksk_sarees"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow KSK Sarees on Instagram"
        title="Instagram"
      >
        <Icon name="instagram" />
      </a>
    </div>
  );
}
