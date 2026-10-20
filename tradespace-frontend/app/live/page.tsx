'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import API from '@/lib/api';

export default function LiveNow() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/live');
        setItems(res.data);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Could not load live auctions');
      } finally {
        setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-black">Live Now</h1>
          <p className="text-gray-600 mt-2">Watch sellers show their items and bid in real time</p>
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
          <p className="text-gray-600">Nobody is live right now. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((item) => (
              <Link
                key={item._id}
                href={`/live/${item._id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
              >
                <div className="relative h-48 bg-gray-200">
                  {item.images && item.images[0] && (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  )}
                  <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    LIVE
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-black truncate">{item.title}</h2>
                  <p className="text-sm text-gray-600">{item.sellerId?.fullName || 'Unknown seller'}</p>
                  <p className="text-xl font-bold text-blue-600 mt-2">
                    {'\u20A6'}{Number(item.currentBid || item.startingBid).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}