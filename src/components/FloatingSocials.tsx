'use client';

import React from 'react';
import { Icon } from './Icons';

export function FloatingSocials() {
  return (
    <div className="floating-socials" aria-label="Connect with Varnam">
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
