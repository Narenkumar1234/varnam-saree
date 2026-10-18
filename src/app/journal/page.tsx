'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { articles } from '@/data/products';
import { useStore } from '@/context/store-context';
import { Icon } from '@/components/Icons';

export default function JournalPage() {
  const { products } = useStore();
  return (
    <>
      <div className="page-title">
        <h1>The Varnam journal</h1>
        <p>A few stories, a little inspiration, and the joy of six yards.</p>
      </div>

      <section className="section">
        <div className="journal-grid">
          {articles.map((a, i) => (
            <Link key={a.id} className="journal-card" href={`/journal/${a.id}`}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  overflow: 'hidden',
                  backgroundColor: '#e5dfd4',
                }}
              >
                <Image
                  src={products[i]?.image || '/assets/saree-emerald.webp'}
                  alt={a.t}
                  fill
                  sizes="(max-width: 700px) 100vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <h2>{a.t}</h2>
              <p>{a.p}</p>
              <span className="text-link">
                Read the story <Icon name="arrow-up-right" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
