'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Clock, Search, X } from 'lucide-react';
import API from '@/lib/api';
import { AUCTION_CATEGORIES } from '@/lib/categories';

const SORT_OPTIONS = [
  { value: 'ending', label: 'Ending soon' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'bids', label: 'Most bids' },
];

// Shows the photo, or a grey box if there is none or it fails to load
function AuctionImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs md:text-sm">
        No photo
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover md:hover:scale-105 transition"
    />
  );
}

const matchesCategory = (auction: any, selected: string) => {
  if (selected === 'All') return true;

  const category = String(auction.category || '').trim().toLowerCase();
  const named = AUCTION_CATEGORIES.filter((c) => c !== 'Other').map((c) => c.toLowerCase());

  if (selected === 'Other') {
    return category === 'other' || !named.includes(category);
  }

  return category === selected.toLowerCase();
};

// Every word typed must appear in the title, category or description
const matchesSearch = (auction: any, words: string[]) => {
  if (words.length === 0) return true;

  const text = `${auction.title || ''} ${auction.category || ''} ${auction.description || ''}`.toLowerCase();
  return words.every((word) => text.includes(word));
};

const priceOf = (auction: any) => Number(auction.currentBid || auction.startingBid || 0);
const endsAtOf = (auction: any) => (auction.endsAt ? new Date(auction.endsAt).getTime() : 0);
const createdAtOf = (auction: any) => (auction.createdAt ? new Date(auction.createdAt).getTime() : 0);

const sortAuctions = (list: any[], sort: string) => {
  const items = [...list];
  const now = Date.now();

  switch (sort) {
    case 'newest':
      return items.sort((a, b) => createdAtOf(b) - createdAtOf(a));
    case 'price-low':
      return items.sort((a, b) => priceOf(a) - priceOf(b));
    case 'price-high':
      return items.sort((a, b) => priceOf(b) - priceOf(a));
    case 'bids':
      return items.sort((a, b) => (b.bids?.length || 0) - (a.bids?.length || 0));
    default:
      // Running auctions first, soonest to end at the top. Ended ones go last.
      return items.sort((a, b) => {
        const aLive = endsAtOf(a) > now;
        const bLive = endsAtOf(b) > now;
        if (aLive !== bLive) return aLive ? -1 : 1;
        return aLive ? endsAtOf(a) - endsAtOf(b) : endsAtOf(b) - endsAtOf(a);
      });
  }
};

export default function Auctions() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('ending');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const response = await API.get('/auctions');
        setAuctions(response.data);
      } catch (err) {
        console.error('Failed to fetch auctions');
      } finally {
        setLoading(false);
      }
    };

    fetchAuctions();
  }, []);

  // Closes the sort menu when you tap outside it or press Escape
  useEffect(() => {
    if (!sortOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sortOpen]);

  const words = useMemo(
    () => search.toLowerCase().split(/\s+/).filter(Boolean),
    [search]
  );

  const visibleAuctions = useMemo(() => {
    const filtered = auctions.filter(
      (auction: any) => matchesCategory(auction, selectedCategory) && matchesSearch(auction, words)
    );
    return sortAuctions(filtered, sort);
  }, [auctions, selectedCategory, words, sort]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading auctions...</p>
      </div>
    );
  }

  const categoryOptions = ['All', ...AUCTION_CATEGORIES];
  const isFiltering = words.length > 0 || selectedCategory !== 'All';
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label || 'Sort';

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-black">Live Auctions</h1>
              <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
                Browse and bid on thousands of items
              </p>
            </div>
            <Link
              href="/create-auction"
              className="flex-shrink-0 whitespace-nowrap bg-blue-600 text-white text-sm md:text-base font-semibold px-4 py-2 md:px-6 rounded-lg hover:bg-blue-700"
            >
              Create Auction
            </Link>
          </div>

          {/* Search and sort */}
          <div className="mt-5 flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search auctions"
                maxLength={80}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm md:text-base text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort menu */}
            <div className="relative flex-shrink-0" ref={sortRef}>
              <button
                type="button"
                onClick={() => setSortOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                aria-label={`Sort auctions: ${sortLabel}`}
                className="h-full flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm md:text-base text-black bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className="whitespace-nowrap">{sortLabel}</span>
                <ChevronDown
                  className={'w-4 h-4 text-gray-500 transition-transform ' + (sortOpen ? 'rotate-180' : '')}
                />
              </button>

              {sortOpen && (
                <div
                  role="listbox"
                  aria-label="Sort auctions"
                  className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30"
                >
                  {SORT_OPTIONS.map((option) => {
                    const active = option.value === sort;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSort(option.value);
                          setSortOpen(false);
                        }}
                        className={
                          'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm md:text-base transition ' +
                          (active
                            ? 'text-blue-600 font-semibold bg-blue-50'
                            : 'text-gray-800 hover:bg-gray-50')
                        }
                      >
                        <span>{option.label}</span>
                        {active && <Check className="w-4 h-4 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((category) => {
              const active = category === selectedCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={
                    'whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition ' +
                    (active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500')
                  }
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Auctions: rows on phones, cards from tablet size up */}
      <div className="max-w-6xl mx-auto px-4 py-5 md:py-8">
        {isFiltering && visibleAuctions.length > 0 && (
          <p className="text-sm text-gray-600 mb-3">
            {visibleAuctions.length} {visibleAuctions.length === 1 ? 'auction' : 'auctions'} found
          </p>
        )}

        {visibleAuctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              {words.length > 0
                ? `No auctions match "${search.trim()}"`
                : selectedCategory === 'All'
                ? 'No auctions available'
                : `No auctions in ${selectedCategory} yet`}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-blue-600 font-semibold hover:underline"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {visibleAuctions.map((auction: any) => {
              const image = auction.images && auction.images[0] ? auction.images[0] : null;

              const timeLeft = auction.endsAt
                ? Math.max(0, new Date(auction.endsAt).getTime() - new Date().getTime())
                : 0;

              const hours = Math.floor(timeLeft / (1000 * 60 * 60));
              const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
              const bidCount = auction.bids?.length || 0;

              return (
                <Link key={auction._id} href={`/auctions/${auction._id}`} className="block">
                  <div className="flex md:block bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer">
                    {/* Image: square on the left on phones, wide on top from tablet size up */}
                    <div className="relative overflow-hidden bg-gray-200 flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 md:w-full md:h-48">
                      <AuctionImage src={image} alt={auction.title} />
                      {timeLeft > 0 && (
                        <div className="absolute top-1.5 left-1.5 md:left-auto md:top-2 md:right-2 bg-red-600 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[11px] md:text-sm font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          {hours}h {minutes}m
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 md:p-4 flex-1 min-w-0 flex flex-col justify-between">
                      <h3 className="font-bold text-black text-base md:text-lg mb-1 md:mb-2 line-clamp-2">
                        {auction.title}
                      </h3>

                      <div className="flex justify-between items-end gap-2">
                        <div>
                          <p className="text-xs text-gray-600">Current Bid</p>
                          <p className="text-lg md:text-xl font-bold text-blue-600">
                            ₦{(auction.currentBid || auction.startingBid)?.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-600">
                            {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}