'use client';

import React, { Suspense } from 'react';
import { SareeListing } from '@/components/SareeListing';

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="section" style={{ padding: '20px 5%' }}><p>Loading sarees...</p></div>}>
      <SareeListing initialSearchMode={false} />
    </Suspense>
  );
}
