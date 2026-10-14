'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function LoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams updates, finish the animation
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept clicks on links across the app
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');

      // Verify it is an internal route transition
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !targetAttr &&
        !href.startsWith('/#') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          setIsNavigating(true);
          setProgress(25);

          const t1 = setTimeout(() => setProgress((p) => (p < 80 ? p + 35 : p)), 80);
          const t2 = setTimeout(() => setProgress((p) => (p < 95 ? p + 25 : p)), 240);

          return () => {
            clearTimeout(t1);
            clearTimeout(t2);
          };
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <>
      {/* Top Gold Progress Line */}
      <div
        className="route-progress-bar"
        style={{
          width: `${progress}%`,
          opacity: isNavigating || progress > 0 ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* Boutique Animated Loader Overlay */}
      {isNavigating && (
        <div className="route-loader-overlay" role="status" aria-label="Loading page">
          <div className="route-loader-card">
            <div className="route-spinner" />
            <span className="route-loader-text">Loading…</span>
          </div>
        </div>
      )}
    </>
  );
}

export function PageTransitionLoader() {
  return (
    <Suspense fallback={null}>
      <LoaderContent />
    </Suspense>
  );
}
