'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { imageLoader, needsUnoptimized } from '@/lib/image-loader';

type ProductThumbProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

/**
 * Cart / mini-cart photo. If the URL fails, swap to a neutral tile so the
 * browser never shows a broken-image icon or leftover alt text.
 */
export function ProductThumb({ src, alt, sizes, className, priority }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span className={`product-thumb${className ? ` ${className}` : ''}`}>
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
          loader={imageLoader}
          unoptimized={needsUnoptimized(src)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="product-thumb-fallback" aria-hidden="true" />
      )}
    </span>
  );
}
