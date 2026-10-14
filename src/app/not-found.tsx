import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <div className="page-title">
        <h1>This page has wandered away</h1>
      </div>
      <div className="empty">
        <h2>Let’s find your way back</h2>
        <p className="muted">There are beautiful weaves waiting.</p>
        <Link className="btn" href="/">
          Back to Varnam
        </Link>
      </div>
    </>
  );
}
