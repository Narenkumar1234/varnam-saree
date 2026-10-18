'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collectionsData } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import { useStore } from '@/context/store-context';
import { Icon } from '@/components/Icons';

export default function HomePage() {
  const { products } = useStore();
  const featuredProducts = products.slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="hero-visual-mobile" aria-hidden="true" />
        <div className="hero-copy">
          <h1>
            Some stories
            <br />
            are woven.
          </h1>
          <p>
            Timeless weaves. Beautiful colours.
            <br />
            Sarees to become a part of your story.
          </p>
          <Link className="btn" href="/shop">
            Discover the collection <Icon name="arrow-up-right" />
          </Link>
        </div>
        <div className="hero-counter">Silk, in its finest form</div>
      </section>

      <div className="benefits">
        <span>
          <Icon name="sparkle" /> Thoughtfully selected weaves
        </span>
        <span>
          <Icon name="leaf" /> Made for moments that matter
        </span>
        <span>
          <Icon name="truck" /> Free delivery on orders above ₹2,999
        </span>
        <span>
          <Icon name="heart" /> A little care in every fold
        </span>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Find your kind of beautiful</h2>
            <p>From everyday rituals to extraordinary celebrations.</p>
          </div>
          <Link className="text-link" href="/collections">
            Explore collections <Icon name="arrow-up-right" />
          </Link>
        </div>

        <div className="collections">
          {collectionsData.map((c) => (
            <Link
              key={c.name}
              className="collection"
              href={c.query ? `/shop?collection=${c.query}` : '/shop'}
            >
              <div className="collection-img-container">
                <Image
                  src={c.image}
                  alt={`${c.name} sarees`}
                  fill
                  sizes="(max-width: 700px) 50vw, 25vw"
                  className="collection-img"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="caption">
                <h3>{c.name === 'All' ? 'All sarees' : `${c.name} sarees`}</h3>
                <small>
                  {c.subtitle} <Icon name="arrow-up-right" />
                </small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: '10px' }}>
        <div className="section-heading">
          <div>
            <h2>Loved, for a reason</h2>
            <p>The weaves you keep coming back to.</p>
          </div>
          <Link className="text-link" href="/shop">
            Shop all sarees <Icon name="arrow-up-right" />
          </Link>
        </div>

        <div className="products">
          {featuredProducts.map((p, idx) => (
            <ProductCard key={p.id} product={p} priority={idx < 2} />
          ))}
        </div>
      </section>

      <section className="story-band">
        <div
          className="story-image"
          role="img"
          aria-label="Woman wearing burgundy silk saree in a heritage courtyard"
        />
        <div className="story-copy">
          <div className="eyebrow">The heart of Varnam</div>
          <h2>
            A little heritage.
            <br />
            A world of colour.
          </h2>
          <p>
            Varnam means colour. And to us, colour is a feeling — the green of a new beginning, the
            gold of a celebration, the familiar comfort of a favourite saree.
          </p>
          <Link className="text-link" href="/story">
            Get to know Varnam <Icon name="arrow-up-right" />
          </Link>
        </div>
      </section>

      <section className="quote">
        <p>
          “A saree is more than what we wear.
          <br />
          It is a little of who we are.”
        </p>
        <small>The Varnam philosophy</small>
      </section>
    </>
  );
}
