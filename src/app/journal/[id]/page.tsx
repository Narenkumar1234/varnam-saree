import React, { use } from 'react';
import Link from 'next/link';
import { articles } from '@/data/products';

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const article = articles.find((a) => a.id === Number(resolvedParams.id));

  if (!article) {
    return (
      <article className="prose" style={{ marginTop: '40px' }}>
        <h2>Story not found</h2>
        <p>Explore our journal for more stories.</p>
        <Link className="text-link" href="/journal">
          Back to the journal
        </Link>
      </article>
    );
  }

  return (
    <>
      <div className="page-title">
        <h1>{article.t}</h1>
        <p>{article.p}</p>
      </div>

      <article className="prose">
        <p style={{ fontSize: '16px', lineHeight: 1.8 }}>{article.body}</p>
        <p style={{ marginTop: '30px' }}>
          <Link className="text-link" href="/journal">
            ← Back to the journal
          </Link>
        </p>
      </article>
    </>
  );
}
