'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import API from '@/lib/api';

export default function Auctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading auctions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-black">Live Auctions</h1>
              <p className="text-gray-600 mt-2">Browse and bid on thousands of items</p>
            </div>
            <Link href="/create-auction" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Create Auction
            </Link>
          </div>
        </div>
      </div>

      {/* Auctions Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {auctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No auctions available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction: any) => {
              const image = auction.images && auction.images[0] 
                ? auction.images[0]
                : 'https://via.placeholder.com/300x300?text=No+Image';
              
              const timeLeft = auction.endsAt 
                ? Math.max(0, new Date(auction.endsAt).getTime() - new Date().getTime())
                : 0;
              
              const hours = Math.floor(timeLeft / (1000 * 60 * 60));
              const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

              return (
                <Link key={auction._id} href={`/auctions/${auction._id}`}>
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer">
                    {/* Image */}
                    <div className="relative overflow-hidden bg-gray-200 h-48">
                      <img
                        src={image}
                        alt={auction.title}
                        className="w-full h-full object-cover hover:scale-105 transition"
                      />
                      {timeLeft > 0 && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {hours}h {minutes}m
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-bold text-black text-lg mb-2 line-clamp-2">{auction.title}</h3>
                      
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-gray-600">Current Bid</p>
                          <p className="text-xl font-bold text-blue-600">
                            ₦{(auction.currentBid || auction.startingBid)?.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">{auction.bids?.length || 0} bids</p>
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