'use client';

import React from 'react';
import { useStore } from '@/context/store-context';

export function ClearSavedData() {
  const { clearDemo } = useStore();
  return (
    <button className="btn outline" type="button" onClick={clearDemo}>
      Clear saved data on this browser
    </button>
  );
}
