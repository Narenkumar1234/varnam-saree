import React from 'react';
import { faqs } from '@/data/products';

export default function FaqPage() {
  return (
    <>
      <div className="page-title">
        <h1>A little help</h1>
        <p>Answers to the questions on your mind.</p>
      </div>

      <article className="prose">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </article>
    </>
  );
}
