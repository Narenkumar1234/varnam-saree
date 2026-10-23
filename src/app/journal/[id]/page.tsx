import type { Metadata } from 'next';
import React, { use } from 'react';
import Link from 'next/link';
import { articles } from '@/data/products';
import { getSiteUrl } from '@/lib/site-url';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = articles.find((a) => a.id === Number(id));
  if (!article) {
    return {
      title: 'Story not found | Varnam',
      robots: { index: false, follow: false },
    };
  }
  const url = new URL(`/journal/${article.id}`, getSiteUrl()).href;
  return {
    title: article.t,
    description: article.p,
    alternates: { canonical: url },
    openGraph: {
      title: `${article.t} | Varnam`,
      description: article.p,
      url,
      siteName: 'Varnam',
      type: 'article',
    },
  };
}

export default function ArticlePage({ params }: Props) {
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
