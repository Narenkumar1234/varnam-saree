'use client';

import React from 'react';
import { useStore } from '@/context/store-context';

export function Toast() {
  const { toastMessage } = useStore();

  if (!toastMessage) return null;

  return (
    <div id="toast" role="status" style={{ display: 'block' }}>
      {toastMessage}
    </div>
  );
}
