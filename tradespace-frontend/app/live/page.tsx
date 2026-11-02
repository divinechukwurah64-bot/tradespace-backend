'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Clock } from 'lucide-react';
import API from '@/lib/api';

// Shows the photo, or a grey box if there is none or it fails to load
function Photo({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
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
      className="w-full h-full object-cover"
    />
  );
}

const timeLeft = (endsAt: string) => {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending now';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m left`;
};

export default function LiveNow() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Refreshes every 10 seconds, and pauses while the tab is hidden
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await API.get('/live');
        if (!cancelled) {
          setItems(res.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load live auctions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 10000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-black">Live Now</h1>
          <p className="text-gray-600 mt-2">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? 'seller is' : 'sellers are'} live. Tap one to watch and bid in real time.`
              : 'Watch sellers show their items and bid in real time'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-700 text-lg">Nobody is live right now</p>
            <p className="text-gray-500 mt-2">Check back soon, or browse the auctions in the meantime.</p>
            <Link href="/auctions" className="inline-block mt-4 text-blue-600 font-bold hover:underline">
              Browse auctions
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Link
                key={item._id}
                href={`/live/${item._id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
              >
                <div className="relative h-52 bg-gray-200">
                  <Photo src={item.images && item.images[0] ? item.images[0] : null} alt={item.title} />
                  <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    LIVE
                  </span>
                  {item.viewers !== null && item.viewers !== undefined && (
                    <span className="absolute top-3 right-3 bg-black bg-opacity-60 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {item.viewers}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {item.sellerId?.profileImage ? (
                      <img
                        src={item.sellerId.profileImage}
                        alt={item.sellerId.fullName}
                        loading="lazy"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {item.sellerId?.fullName?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 truncate">
                      {item.sellerId?.fullName || 'Unknown seller'}
                    </p>
                  </div>
                  <h2 className="font-bold text-black truncate">{item.title}</h2>
                  <div className="flex items-end justify-between mt-2">
                    <p className="text-xl font-bold text-blue-600">
                      {'\u20A6'}{Number(item.currentBid || item.startingBid).toLocaleString()}
                    </p>
                    {item.endsAt && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeLeft(item.endsAt)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}