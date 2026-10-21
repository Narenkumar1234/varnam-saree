'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveColourHex } from '@/lib/colour';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { PriceRangeFilter } from '@/components/PriceRangeFilter';
import { createShopFilters, filterShopProducts, getShopFilterOptions, getShopListingHeading, parseShopFiltersFromParams, parseShopSortFromParams, shopFiltersKey, shopStateToParams, DISCOUNT_FILTER_OPTIONS, type ShopSortOption } from '@/lib/shop-filters';
import type { ShopFilterState } from '@/types';

interface SareeListingProps {
  initialSearchMode?: boolean;
}

export function SareeListing({ initialSearchMode = false }: SareeListingProps) {
  const { products } = useStore();
  const { collections: collectionOptions, priceBounds, colours } = useMemo(() => getShopFilterOptions(products), [products]);
  const colourOptions = useMemo(
    () => colours.map((colour) => [colour, resolveColourHex(colour)] as [string, string]),
    [colours]
  );
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const filterOptions = { collections: collectionOptions, colours, priceBounds };

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  // Filters are read from the URL (?collection=&colour=&min=&max=&offers=) and written back to it.
  const [filters, setFilters] = useState<ShopFilterState>(() => parseShopFiltersFromParams(searchParams, filterOptions));

  const persistSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
    if (!initialSearchMode) return;
    const params = new URLSearchParams(window.location.search);
    if (value) params.set('q', value);
    else params.delete('q');
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [initialSearchMode, pathname]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<ShopFilterState>(filters);
  const [sortOption, setSortOption] = useState<ShopSortOption>(() => parseShopSortFromParams(searchParams));

  // Refresh slider bounds when live prices change, preserving a user's selection.
  const previousBounds = React.useRef(priceBounds);
  useEffect(() => {
    const previous = previousBounds.current;
    const adjust = (state: ShopFilterState): ShopFilterState => {
      const fullRange = state.priceRange.min === previous.min && state.priceRange.max === previous.max;
      const min = Math.max(priceBounds.min, Math.min(state.priceRange.min, priceBounds.max));
      const max = Math.max(min, Math.min(state.priceRange.max, priceBounds.max));
      return { ...state, priceRange: fullRange ? { ...priceBounds } : { min, max } };
    };
    setFilters(adjust); setSheetDraft(adjust); previousBounds.current = priceBounds;
  }, [priceBounds.min, priceBounds.max]);

  // The URL (?collection=&colour=&min=&max=&offers=&sort=) is the source of truth for
  // history: every user change pushes one entry (Back undoes it), and back/forward
  // rebuild the filters and sort from the URL below.
  const paramsString = searchParams.toString();
  useEffect(() => {
    const params = new URLSearchParams(paramsString);
    const next = parseShopFiltersFromParams(params, filterOptions);
    setFilters((prev) => (shopFiltersKey(prev) === shopFiltersKey(next) ? prev : next));
    setSortOption(parseShopSortFromParams(params));
  }, [paramsString, collectionOptions.join('\0'), colours.join('\0'), priceBounds.min, priceBounds.max]);

  // Initial normalisation (e.g. ?colour=rose -> ?colour=Rose, out-of-range prices dropped)
  // replaces the entry instead of adding one.
  useEffect(() => {
    const current = window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(current);
    const canonical = shopStateToParams(
      parseShopFiltersFromParams(params, filterOptions),
      parseShopSortFromParams(params),
      priceBounds,
      current,
    ).toString();
    if (canonical !== current) {
      window.history.replaceState(null, '', canonical ? `${pathname}?${canonical}` : pathname);
    }
  }, [pathname, collectionOptions.join('\0'), colours.join('\0'), priceBounds.min, priceBounds.max]);

  const sliderTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (sliderTimer.current) clearTimeout(sliderTimer.current); }, []);

  /** Apply a user change and push it as one history entry (scroll position kept). */
  const commitShopState = (
    nextFilters: ShopFilterState,
    nextSort: ShopSortOption = sortOption,
    options: { debounce?: boolean; clearQuery?: boolean } = {},
  ) => {
    setFilters(nextFilters);
    setSortOption(nextSort);
    if (sliderTimer.current) { clearTimeout(sliderTimer.current); sliderTimer.current = null; }
    const push = () => {
      sliderTimer.current = null;
      const current = window.location.search.replace(/^\?/, '');
      const params = shopStateToParams(nextFilters, nextSort, priceBounds, current);
      if (options.clearQuery) params.delete('q');
      const next = params.toString();
      if (next === current) return;
      // history.pushState is integrated with the Next router (useSearchParams updates,
      // Back/forward work) without remounting the page, so scroll stays put. router.push
      // re-keys this page segment per query, remounting it and jumping to the top.
      window.history.pushState(null, '', next ? `${pathname}?${next}` : pathname);
    };
    // Dragging the price slider adds a single entry once the thumb settles.
    if (options.debounce) sliderTimer.current = setTimeout(push, 400);
    else push();
  };

  const urlQuery = searchParams.get('q') ?? '';
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // Compute matching products combining query + filters
  const filteredProducts = useMemo(
    () => filterShopProducts(products, filters, searchQuery),
    [searchQuery, filters, products]
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

  // Active filter count
  const activeFilterCount =
    (filters.collection !== 'All' ? 1 : 0) +
    filters.colours.length +
    (filters.priceRange.min !== priceBounds.min || filters.priceRange.max !== priceBounds.max ? 1 : 0) +
    (filters.minDiscount && filters.minDiscount > 0 ? 1 : 0);

  // Draft count for mobile bottom sheet
  const draftMatchingCount = useMemo(
    () => filterShopProducts(products, sheetDraft, searchQuery).length,
    [searchQuery, sheetDraft, products]
  );

  const listingHeading = getShopListingHeading(
    filters.minDiscount || 0,
    filters.collection,
    initialSearchMode
  );

  // Clears filters (and the search text) as one history entry; the chosen sort is kept.
  const resetFilters = () => {
    setSearchQuery('');
    commitShopState(createShopFilters(priceBounds), sortOption, { clearQuery: true });
  };

  const handleOpenSheet = () => {
    setSheetDraft({
      ...filters,
      colours: [...filters.colours],
      priceRange: { ...filters.priceRange },
      minDiscount: filters.minDiscount || 0,
    });
    setSheetOpen(true);
  };

  const handleApplySheet = () => {
    commitShopState({
      ...sheetDraft,
      colours: [...sheetDraft.colours],
      priceRange: { ...sheetDraft.priceRange },
      minDiscount: sheetDraft.minDiscount || 0,
    });
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
        {listingHeading || 'Search'}
      </div>

      {listingHeading && (
        <div className="page-title shop-listing-title">
          <h1>{listingHeading}</h1>
        </div>
      )}

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
              onChange={(e) => persistSearchQuery(e.target.value)}
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
                      commitShopState({ ...filters, collection: c });
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
              {colourOptions.map(([colName, hex]) => (
                <label key={colName} htmlFor={`desktop-${colName}`}>
                  <input
                    id={`desktop-${colName}`}
                    type="checkbox"
                    name="desktop-colour"
                    value={colName}
                    checked={filters.colours.some((c) => c.toLowerCase() === colName.toLowerCase())}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const others = filters.colours.filter((c) => c.toLowerCase() !== colName.toLowerCase());
                      commitShopState({ ...filters, colours: checked ? [...others, colName] : others });
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
                commitShopState({ ...filters, priceRange }, sortOption, { debounce: true });
              }}
            />
          </fieldset>

          <fieldset>
            <legend>% of offers</legend>
            <div className="filter-options">
              {DISCOUNT_FILTER_OPTIONS.map((opt) => (
                <label key={opt.value} htmlFor={`desktop-discount-${opt.value}`}>
                  <input
                    id={`desktop-discount-${opt.value}`}
                    type="radio"
                    name="desktop-discount"
                    value={opt.value}
                    checked={(filters.minDiscount || 0) === opt.value}
                    onChange={() => {
                      commitShopState({ ...filters, minDiscount: opt.value });
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
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
                  onChange={(e) => commitShopState(filters, e.target.value as ShopSortOption)}
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
          {sortedProducts.length > 0 ? (
            <div className="products" id="shopResults">
              {sortedProducts.map((p, idx) => (
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
                onClick={resetFilters}
              >
                Clear all filters
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
                  {colourOptions.map(([colName, hex]) => (
                    <label
                      key={colName}
                      htmlFor={`sheet-${colName}`}
                      className={sheetDraft.colours.some((c) => c.toLowerCase() === colName.toLowerCase()) ? 'checked' : ''}
                    >
                      <input
                        id={`sheet-${colName}`}
                        type="checkbox"
                        name="sheet-colour"
                        value={colName}
                        checked={sheetDraft.colours.some((c) => c.toLowerCase() === colName.toLowerCase())}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSheetDraft((prev) => ({
                            ...prev,
                            colours: checked
                              ? [...prev.colours.filter((c) => c.toLowerCase() !== colName.toLowerCase()), colName]
                              : prev.colours.filter((c) => c.toLowerCase() !== colName.toLowerCase()),
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

              <fieldset>
                <legend>% of offers</legend>
                <div className="filter-options">
                  {DISCOUNT_FILTER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={`sheet-discount-${opt.value}`}
                      className={(sheetDraft.minDiscount || 0) === opt.value ? 'checked' : ''}
                    >
                      <input
                        id={`sheet-discount-${opt.value}`}
                        type="radio"
                        name="sheet-discount"
                        value={opt.value}
                        checked={(sheetDraft.minDiscount || 0) === opt.value}
                        onChange={() => setSheetDraft((prev) => ({ ...prev, minDiscount: opt.value }))}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
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

