'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { products, COLOUR_HEX_MAP } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { ShopFilterState } from '@/types';

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCollection = searchParams.get('collection');

  const [filters, setFilters] = useState<ShopFilterState>({
    collection: initialCollection && ['Silk', 'Cotton', 'Festive'].includes(initialCollection) ? initialCollection : 'All',
    colours: [],
    budget: false,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<ShopFilterState>(filters);
  const [sortOption, setSortOption] = useState<'featured' | 'low' | 'high' | 'new'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(6);

  // Sync if URL search params change
  useEffect(() => {
    const c = searchParams.get('collection');
    if (c && ['Silk', 'Cotton', 'Festive'].includes(c)) {
      setFilters((prev) => ({ ...prev, collection: c }));
    } else if (!c) {
      setFilters((prev) => ({ ...prev, collection: 'All' }));
    }
    setVisibleCount(6);
  }, [searchParams]);

  // Compute matching products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCol = filters.collection === 'All' || p.collection === filters.collection;
      const matchColour = !filters.colours.length || filters.colours.includes(p.colour);
      const matchBudget = !filters.budget || p.price < 5000;
      return matchCol && matchColour && matchBudget;
    });
  }, [filters]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortOption === 'low') list.sort((a, b) => a.price - b.price);
    if (sortOption === 'high') list.sort((a, b) => b.price - a.price);
    if (sortOption === 'new') list.sort((a, b) => (b.tag === 'New arrival' ? 1 : 0) - (a.tag === 'New arrival' ? 1 : 0));
    return list;
  }, [filteredProducts, sortOption]);

  const displayedProducts = sortedProducts.slice(0, visibleCount);

  // Count active filters
  const activeFilterCount =
    (filters.collection !== 'All' ? 1 : 0) + filters.colours.length + (filters.budget ? 1 : 0);

  // Matching count for sheet draft
  const draftMatchingCount = useMemo(() => {
    return products.filter((p) => {
      const matchCol = sheetDraft.collection === 'All' || p.collection === sheetDraft.collection;
      const matchColour = !sheetDraft.colours.length || sheetDraft.colours.includes(p.colour);
      const matchBudget = !sheetDraft.budget || p.price < 5000;
      return matchCol && matchColour && matchBudget;
    }).length;
  }, [sheetDraft]);

  const resetFilters = () => {
    setFilters({ collection: 'All', colours: [], budget: false });
    setVisibleCount(6);
  };

  const handleOpenSheet = () => {
    setSheetDraft({ ...filters, colours: [...filters.colours] });
    setSheetOpen(true);
  };

  const handleApplySheet = () => {
    setFilters({ ...sheetDraft, colours: [...sheetDraft.colours] });
    setVisibleCount(6);
    setSheetOpen(false);
  };

  const handleResetSheet = () => {
    setSheetDraft({ collection: 'All', colours: [], budget: false });
  };

  return (
    <section className="section shop-section">
      <div className="breadcrumb">
        <Link href="/">Home</Link> / {filters.collection === 'All' ? 'All sarees' : `${filters.collection} sarees`}
      </div>

      <div className="shop-layout">
        <aside className="filters desktop-filters" id="desktopFilters" aria-label="Filter sarees">
          <fieldset>
            <legend>Collection</legend>
            <div className="filter-options">
              {['All', 'Silk', 'Cotton', 'Festive'].map((c) => (
                <label key={c} htmlFor={`desktop-${c}`}>
                  <input
                    id={`desktop-${c}`}
                    type="radio"
                    name="desktop-collection"
                    value={c}
                    checked={filters.collection === c}
                    onChange={() => {
                      setFilters((prev) => ({ ...prev, collection: c }));
                      setVisibleCount(6);
                    }}
                  />
                  <span>{c === 'All' ? 'All sarees' : `${c} sarees`}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Colour</legend>
            <div className="filter-options">
              {Object.entries(COLOUR_HEX_MAP).map(([colName, hex]) => (
                <label key={colName} htmlFor={`desktop-${colName}`}>
                  <input
                    id={`desktop-${colName}`}
                    type="checkbox"
                    name="desktop-colour"
                    value={colName}
                    checked={filters.colours.includes(colName)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFilters((prev) => ({
                        ...prev,
                        colours: checked
                          ? [...prev.colours, colName]
                          : prev.colours.filter((c) => c !== colName),
                      }));
                      setVisibleCount(6);
                    }}
                  />
                  <span className="filter-colour" style={{ background: hex }} aria-hidden="true" />
                  <span>{colName}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Price range</legend>
            <label htmlFor="desktop-budget">
              <input
                id="desktop-budget"
                type="checkbox"
                name="desktop-budget"
                checked={filters.budget}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, budget: e.target.checked }));
                  setVisibleCount(6);
                }}
              />
              <span>Under ₹5,000</span>
            </label>
          </fieldset>

          <button className="text-link filter-reset" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        </aside>

        <div>
          <div className="toolbar shop-toolbar">
            <span id="resultsCount" aria-live="polite">
              {sortedProducts.length
                ? `Showing ${displayedProducts.length} of ${sortedProducts.length} sarees`
                : '0 sarees'}
            </span>

            <button
              id="openFilters"
              className="filter-trigger"
              type="button"
              aria-haspopup="dialog"
              aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'}
              onClick={handleOpenSheet}
            >
              <Icon name="sliders" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span id="filterCount">{activeFilterCount}</span>}
            </button>

            <div className="sort-control">
              <label className="sr" htmlFor="sort">
                Sort sarees
              </label>
              <select
                id="sort"
                name="sort"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
              >
                <option value="featured">Sort: Featured</option>
                <option value="low">Price: Low first</option>
                <option value="high">Price: High first</option>
                <option value="new">Newest arrivals</option>
              </select>
            </div>
          </div>

          {displayedProducts.length > 0 ? (
            <div className="products" id="shopResults">
              {displayedProducts.map((p, idx) => (
                <ProductCard key={p.id} product={p} priority={idx < 4} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>No sarees match these filters</h2>
              <p className="muted">Try another colour or collection.</p>
              <button className="btn" type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          )}

          {sortedProducts.length > displayedProducts.length && (
            <div className="shop-pagination" id="shopPagination">
              <button
                className="load-more"
                type="button"
                aria-describedby="resultsCount"
                onClick={() => setVisibleCount((prev) => prev + 6)}
              >
                Load more <Icon name="arrow-right" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      {sheetOpen && (
        <>
          <div
            className="filter-sheet-backdrop"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            id="filterSheet"
            className="filter-sheet"
            role="dialog"
            aria-labelledby="filterSheetTitle"
          >
            <div className="sheet-grip" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <h2 id="filterSheetTitle">Find your weave</h2>
                <p>Make it a little more you.</p>
              </div>
              <button
                className="sheet-close"
                type="button"
                aria-label="Close filters"
                onClick={() => setSheetOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="sheet-body" id="sheetFields">
              <fieldset>
                <legend>Collection</legend>
                <div className="filter-options">
                  {['All', 'Silk', 'Cotton', 'Festive'].map((c) => (
                    <label
                      key={c}
                      htmlFor={`sheet-${c}`}
                      className={sheetDraft.collection === c ? 'checked' : ''}
                    >
                      <input
                        id={`sheet-${c}`}
                        type="radio"
                        name="sheet-collection"
                        value={c}
                        checked={sheetDraft.collection === c}
                        onChange={() => setSheetDraft((prev) => ({ ...prev, collection: c }))}
                      />
                      <span>{c === 'All' ? 'All sarees' : `${c} sarees`}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Colour</legend>
                <div className="filter-options">
                  {Object.entries(COLOUR_HEX_MAP).map(([colName, hex]) => (
                    <label
                      key={colName}
                      htmlFor={`sheet-${colName}`}
                      className={sheetDraft.colours.includes(colName) ? 'checked' : ''}
                    >
                      <input
                        id={`sheet-${colName}`}
                        type="checkbox"
                        name="sheet-colour"
                        value={colName}
                        checked={sheetDraft.colours.includes(colName)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSheetDraft((prev) => ({
                            ...prev,
                            colours: checked
                              ? [...prev.colours, colName]
                              : prev.colours.filter((c) => c !== colName),
                          }));
                        }}
                      />
                      <span className="filter-colour" style={{ background: hex }} aria-hidden="true" />
                      <span>{colName}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Price range</legend>
                <label
                  htmlFor="sheet-budget"
                  className={sheetDraft.budget ? 'checked' : ''}
                >
                  <input
                    id="sheet-budget"
                    type="checkbox"
                    name="sheet-budget"
                    checked={sheetDraft.budget}
                    onChange={(e) =>
                      setSheetDraft((prev) => ({ ...prev, budget: e.target.checked }))
                    }
                  />
                  <span>Under ₹5,000</span>
                </label>
              </fieldset>
            </div>

            <div className="sheet-footer">
              <button className="sheet-reset" type="button" onClick={handleResetSheet}>
                Reset all
              </button>
              <button className="btn sheet-apply" type="button" onClick={handleApplySheet}>
                <span>
                  Show {draftMatchingCount} {draftMatchingCount === 1 ? 'saree' : 'sarees'}
                </span>{' '}
                <Icon name="arrow-right" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="section"><p>Loading sarees...</p></div>}>
      <ShopContent />
    </Suspense>
  );
}
