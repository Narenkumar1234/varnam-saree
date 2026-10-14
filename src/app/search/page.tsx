'use client';

import React, { useState, useMemo } from 'react';
import { products } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.type} ${p.collection} ${p.colour}`.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="page-title">
        <h1>Find your colours</h1>
        <p>Search by colour, weave, or saree name.</p>
      </div>

      <section className="section">
        <form className="search-box" onSubmit={handleSubmit}>
          <label className="sr" htmlFor="search">
            Search sarees
          </label>
          <div className="inline">
            <input
              type="search"
              id="search"
              placeholder="Try silk, emerald, cotton…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </div>
        </form>

        <div className="products" style={{ marginTop: '35px' }}>
          {searchResults.length > 0 ? (
            searchResults.map((p) => <ProductCard key={p.id} product={p} />)
          ) : (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              <h2>No weaves found</h2>
              <p className="muted">Try a colour or material, such as rose or silk.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
