'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { products, collectionsData, COLOUR_HEX_MAP } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { PriceRangeFilter } from '@/components/PriceRangeFilter';
import { createShopFilters, filterShopProducts, getShopFilterOptions } from '@/lib/shop-filters';
import type { ShopFilterState } from '@/types';

const { collections: collectionOptions, priceBounds } = getShopFilterOptions(
  products,
  collectionsData.map((collection) => collection.query)
);

interface SareeListingProps {
  initialSearchMode?: boolean;
}

export function SareeListing({ initialSearchMode = false }: SareeListingProps) {
  const searchParams = useSearchParams();
  const initialCollection = searchParams.get('collection');

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ShopFilterState>(() => createShopFilters(
    priceBounds,
    initialCollection && collectionOptions.includes(initialCollection)
      ? initialCollection
      : 'All'
  ));

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<ShopFilterState>(filters);
  const [sortOption, setSortOption] = useState<'featured' | 'low' | 'high' | 'new'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(6);

  // Sync if URL search params change
  useEffect(() => {
    const c = searchParams.get('collection');
    if (c && collectionOptions.includes(c)) {
      setFilters((prev) => ({ ...prev, collection: c }));
    } else if (!c && !initialSearchMode) {
      setFilters((prev) => ({ ...prev, collection: 'All' }));
    }
    setVisibleCount(6);
  }, [searchParams, initialSearchMode]);

  // Compute matching products combining query + filters
  const filteredProducts = useMemo(
    () => filterShopProducts(products, filters, searchQuery),
    [searchQuery, filters]
  );

  // Sort products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortOption === 'low') list.sort((a, b) => a.price - b.price);
    if (sortOption === 'high') list.sort((a, b) => b.price - a.price);
    if (sortOption === 'new') {
      list.sort((a, b) => (b.tag === 'New arrival' ? 1 : 0) - (a.tag === 'New arrival' ? 1 : 0));
    }
    return list;
  }, [filteredProducts, sortOption]);

  const displayedProducts = sortedProducts.slice(0, visibleCount);

  // Active filter count
  const activeFilterCount =
    (filters.collection !== 'All' ? 1 : 0) +
    filters.colours.length +
    (filters.priceRange.min !== priceBounds.min || filters.priceRange.max !== priceBounds.max ? 1 : 0);

  // Draft count for mobile bottom sheet
  const draftMatchingCount = useMemo(
    () => filterShopProducts(products, sheetDraft, searchQuery).length,
    [searchQuery, sheetDraft]
  );

  const resetFilters = () => {
    setFilters(createShopFilters(priceBounds));
    setVisibleCount(6);
  };

  const handleOpenSheet = () => {
    setSheetDraft({ ...filters, colours: [...filters.colours], priceRange: { ...filters.priceRange } });
    setSheetOpen(true);
  };

  const handleApplySheet = () => {
    setFilters({ ...sheetDraft, colours: [...sheetDraft.colours], priceRange: { ...sheetDraft.priceRange } });
    setVisibleCount(6);
    setSheetOpen(false);
  };

  const handleResetSheet = () => {
    setSheetDraft(createShopFilters(priceBounds));
  };

  return (
    <section className="section shop-section">
      {/* Breadcrumb with reduced compact margins */}
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{' '}
        {initialSearchMode
          ? 'Search'
          : filters.collection === 'All'
          ? 'All sarees'
          : `${filters.collection} sarees`}
      </div>

      {/* If in search mode, display prominent search input */}
      {initialSearchMode && (
        <form
          className="search-box"
          onSubmit={(e) => e.preventDefault()}
          style={{ marginBottom: '20px' }}
        >
          <label className="sr" htmlFor="search-input">
            Search sarees
          </label>
          <div className="inline">
            <input
              type="search"
              id="search-input"
              placeholder="Try silk, emerald, cotton, banarasi…"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(6);
              }}
            />
            <button type="submit" aria-label="Search">
              <Icon name="search" />
            </button>
          </div>
        </form>
      )}

      <div className="shop-layout">
        {/* Desktop Sidebar Filters */}
        <aside className="filters desktop-filters" id="desktopFilters" aria-label="Filter sarees">
          <fieldset>
            <legend>Collection</legend>
            <div className="filter-options">
              {collectionOptions.map((c) => (
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
            <PriceRangeFilter
              bounds={priceBounds}
              value={filters.priceRange}
              onChange={(priceRange) => {
                setFilters((prev) => ({ ...prev, priceRange }));
                setVisibleCount(6);
              }}
            />
          </fieldset>

          <button className="text-link filter-reset" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        </aside>

        <div>
          {/* Toolbar (Removed 'Showing 6 of 8 sarees' per user request) */}
          <div className="toolbar shop-toolbar">
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

            {/* Custom Arrow on Sort Dropdown */}
            <div className="sort-control-wrapper">
              <label className="sr" htmlFor="sort">
                Sort sarees
              </label>
              <div className="custom-select-container">
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
                <span className="select-arrow" aria-hidden="true">
                  <Icon name="chevron" size={14} />
                </span>
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          {displayedProducts.length > 0 ? (
            <div className="products" id="shopResults">
              {displayedProducts.map((p, idx) => (
                <ProductCard key={p.id} product={p} priority={idx < 4} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>No sarees match your selection</h2>
              <p className="muted">
                {searchQuery
                  ? `No weaves found for "${searchQuery}". Try another keyword or clear filters.`
                  : 'Try another price range, colour, or collection.'}
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  resetFilters();
                }}
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Load More Button (Unified for both catalogue and search) */}
          {sortedProducts.length > displayedProducts.length && (
            <div className="shop-pagination" id="shopPagination">
              <button
                className="load-more"
                type="button"
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
                  {collectionOptions.map((c) => (
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
                <PriceRangeFilter
                  bounds={priceBounds}
                  value={sheetDraft.priceRange}
                  onChange={(priceRange) =>
                    setSheetDraft((prev) => ({ ...prev, priceRange }))
                  }
                />
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
