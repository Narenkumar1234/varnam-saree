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
        <h2>Your saved information</h2>
        <p>
          Your bag, wishlist, saved address and order confirmation snapshots are stored in this
          browser. Anyone using this browser may be able to view them. Checkout sends your contact,
          delivery details and order to the store. Google sign-in uses Firebase Authentication;
          the server verifies your identity before saving your account profile or showing order history.
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
