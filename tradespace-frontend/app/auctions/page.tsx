'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Gavel, Clock, User } from 'lucide-react';
import API from '@/lib/api';

export default function Auctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const response = await API.get('/auctions');
      setAuctions(response.data);
    } catch (err) {
      setError('Failed to load auctions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const timeRemaining = (endsAt) => {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end - now;
    
    if (diff < 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-black">Live Auctions</h1>
          <p className="text-gray-600 mt-2">Browse and bid on thousands of items</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Loading auctions...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <Gavel className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No auctions available yet</p>
            <Link href="/create-auction" className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Create First Auction
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {auctions.map((auction) => (
              <Link key={auction._id} href={`/auctions/${auction._id}`}>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition cursor-pointer">
                  
                  <div className="bg-gray-100 h-48 flex items-center justify-center">
                    <Gavel className="w-12 h-12 text-gray-400" />
                  </div>

                  <div className="p-4">
                    
                    <h3 className="font-bold text-gray-900 line-clamp-2 text-sm">
                      {auction.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{auction.sellerId?.fullName || 'Unknown'}</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-gray-500">Current Bid</p>
                          <p className="text-xl font-bold text-black">
                            ₦{auction.currentBid?.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Bids</p>
                          <p className="text-lg font-bold text-blue-600">
                            {auction.bids?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold text-gray-900">
                        {timeRemaining(auction.endsAt)}
                      </span>
                    </div>

                    <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 text-sm">
                      Place Bid
                    </button>
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