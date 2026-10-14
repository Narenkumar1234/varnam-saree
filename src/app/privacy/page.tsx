'use client';

import React from 'react';
import { useStore } from '@/context/store-context';

export default function PrivacyPage() {
  const { clearDemo } = useStore();

  return (
    <>
      <div className="page-title">
        <h1>Privacy</h1>
      </div>

      <article className="prose">
        <h2>Your data in this preview</h2>
        <p>
          The demo stores your bag, wishlist, profile, address and sample orders in your browser’s
          local storage. These entries are not submitted to a store backend. Anyone using this
          browser may be able to view them.
        </p>

        <h2>External services</h2>
        <p>
          Fonts are served by Google Fonts. Site hosting may process access information under its
          own policies. The newsletter and contact forms show local confirmation only.
        </p>

        <h2>Clear your demo data</h2>
        <p>Use the button below to remove Varnam’s saved entries from this browser.</p>
        <button className="btn outline" type="button" onClick={clearDemo}>
          Clear demo data
        </button>

        <h2>Before the store launches</h2>
        <p>
          A final privacy policy must describe the actual payment, fulfilment, analytics and
          support providers used by the business.
        </p>
      </article>
    </>
  );
}
