'use client';

import React, { Suspense } from 'react';
import { SareeListing } from '@/components/SareeListing';

export default function SearchPage() {
  return (
    <>
      <div className="page-title" style={{ padding: '24px 5% 10px' }}>
        <h1 style={{ marginBottom: '6px' }}>Find your colours</h1>
        <p>Search by colour, weave, or saree name.</p>
      </div>

      <Suspense fallback={<div className="section" style={{ padding: '20px 5%' }}><p>Loading search...</p></div>}>
        <SareeListing initialSearchMode={true} />
      </Suspense>
    </>
  );
}
