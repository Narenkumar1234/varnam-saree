import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'Colour is where our story begins. Learn about Varnam and our celebration of six yards.',
  alternates: {
    canonical: new URL('/story', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Our Story | Varnam',
    description: 'Colour is where our story begins. Learn about Varnam and our celebration of six yards.',
    url: new URL('/story', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function StoryPage() {
  return (
    <>
      <div className="page-title">
        <h1>Colour is where our story begins</h1>
        <p>Varnam · A celebration of six yards</p>
      </div>

      <section className="story-band">
        <div
          className="story-image"
          role="img"
          aria-label="South Indian woman wearing burgundy silk saree in a heritage courtyard"
        />
        <div className="story-copy">
          <h2>
            Tradition, with room
            <br />
            for your own story.
          </h2>
          <p>
            Some colours feel like home. Others invite us to become someone new. Varnam is imagined
            as a place for both: a collection of sarees for everyday rhythms and once-in-a-lifetime
            moments.
          </p>
          <p>
            Our name means colour. Our idea is simple — finding a saree should feel as joyful as
            wearing it.
          </p>
          <Link className="btn" href="/shop">
            Find your colours
          </Link>
        </div>
      </section>

      <article className="prose">
        <h2>A weave for every chapter</h2>
        <p>
          From the ease of cotton to the luminous richness of silk, our collection brings different
          moods together. Thoughtful details, a considered palette, and the enduring beauty of the
          saree guide the Varnam experience.
        </p>
      </article>
    </>
  );
}
