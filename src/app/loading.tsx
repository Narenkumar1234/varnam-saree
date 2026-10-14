import React from 'react';

export default function Loading() {
  return (
    <div className="page-loading-container" role="status" aria-label="Loading page">
      <div className="route-spinner" />
      <span className="route-loader-text">Loading…</span>
    </div>
  );
}
