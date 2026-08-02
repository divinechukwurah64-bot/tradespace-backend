'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, User, ArrowLeft, Send } from 'lucide-react';
import API from '@/lib/api';

export default function AuctionDetail() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id;

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    fetchAuction();
  }, [auctionId]);

  useEffect(() => {
    if (!auction) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(auction.endsAt);
      const diff = end - now;

      if (diff < 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  const fetchAuction = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/auctions/${auctionId}`);
      setAuction(response.data);
    } catch (err) {
      setError('Failed to load auction');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setBidError('');
    setBidLoading(true);

    try {
      const amount = parseFloat(bidAmount);
      
      if (!amount || amount <= 0) {
        setBidError('Please enter a valid bid amount');
        setBidLoading(false);
        return;
      }

      if (amount <= auction.currentBid) {
        setBidError(`Bid must be higher than ₦${auction.currentBid.toLocaleString()}`);
        setBidLoading(false);
        return;
      }

      await API.post(`/auctions/${auctionId}/bid`, { amount });
      
      setBidAmount('');
      fetchAuction();
    } catch (err) {
      setBidError(err.response?.data?.error || 'Failed to place bid');
    } finally {
      setBidLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Auctions
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Auction not found'}
          </div>
        </div>
      </div>
    );
  }

  const isEnded = new Date() > new Date(auction.endsAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Auctions
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Image */}
          <div className="md:col-span-1">
            <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center sticky top-4">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">No image available</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Title & Status */}
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">{auction.title}</h1>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  isEnded ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isEnded ? 'Ended' : 'Active'}
                </span>
                <span className="text-sm text-gray-600">{auction.category}</span>
              </div>
            </div>

            {/* Time */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-900">
                <Clock className="w-5 h-5" />
                <div>
                  <p className="text-sm text-blue-600">Time Remaining</p>
                  <p className="text-2xl font-bold">{timeLeft}</p>
                </div>
              </div>
            </div>

            {/* Price Section */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Current Bid</p>
                <p className="text-4xl font-bold text-black">₦{auction.currentBid?.toLocaleString()}</p>
                <p className="text-sm text-gray-600 mt-2">{auction.bids?.length || 0} bids</p>
              </div>

              {auction.buyItNowPrice && (
                <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">Buy It Now</p>
                  <p className="text-3xl font-bold text-orange-600">₦{auction.buyItNowPrice?.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-bold text-black mb-2">Description</h2>
              <p className="text-gray-700 leading-relaxed">{auction.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Condition</p>
                  <p className="font-bold text-black">{auction.condition}</p>
                </div>
                <div>
                  <p className="text-gray-600">Shipping</p>
                  <p className="font-bold text-black">₦{auction.shippingCost?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Seller */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-300 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-black text-lg">{auction.sellerId?.fullName}</h3>
                  <p className="text-sm text-gray-600">Seller Rating: ⭐ {auction.sellerId?.sellerRating || 5}</p>
                </div>
              </div>
            </div>

            {/* Bid Form */}
            {!isEnded && (
              <form onSubmit={handlePlaceBid} className="space-y-4">
                {bidError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {bidError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Bid (₦)
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={auction.currentBid + 1}
                    step="100"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
                    placeholder={`Minimum ₦${(auction.currentBid + 1).toLocaleString()}`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={bidLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {bidLoading ? 'Placing Bid...' : 'Place Bid'}
                </button>
              </form>
            )}

            {isEnded && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                This auction has ended.
              </div>
            )}
          </div>
        </div>

        {/* Bid History */}
        {auction.bids && auction.bids.length > 0 && (
          <div className="mt-12 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-black mb-6">Bid History</h2>
            <div className="space-y-3">
              {[...auction.bids].reverse().map((bid, index) => (
                <div key={index} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-bold text-black">{bid.bidderId?.fullName || 'Anonymous'}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(bid.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-black">₦{bid.amount?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}