'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, User, ArrowLeft, Heart, Share2, Trash2 } from 'lucide-react';
import API from '@/lib/api';

export default function AuctionDetail() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id as string;

  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const response = await API.get(`/auctions/${auctionId}`);
        setAuction(response.data);
      } catch (err) {
        setError('Failed to load auction');
      } finally {
        setLoading(false);
      }
    };

    const fetchUser = async () => {
      try {
        const response = await API.get('/auth/me');
        setCurrentUser(response.data);
      } catch (err) {
        console.log('Not logged in');
      }
    };

    fetchAuction();
    fetchUser();
  }, [auctionId]);

  useEffect(() => {
    if (!auction?.endsAt) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(auction.endsAt);
      const diff = end.getTime() - now.getTime();

      if (diff < 0) {
        setTimeLeft('Auction Ended');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  const handlePlaceBid = async (e: any) => {
    e.preventDefault();
    setBidError('');
    setBidLoading(true);

    if (!currentUser) {
      setBidError('Please log in to place a bid');
      setBidLoading(false);
      return;
    }

    try {
      await API.post(`/auctions/${auctionId}/bids`, {
        amount: Number(bidAmount),
      });
      setBidAmount('');
      await fetchAuctionData();
    } catch (err: any) {
      setBidError(err.response?.data?.error || 'Failed to place bid');
    } finally {
      setBidLoading(false);
    }
  };

  const fetchAuctionData = async () => {
    try {
      const response = await API.get(`/auctions/${auctionId}`);
      setAuction(response.data);
    } catch (err) {
      console.error('Failed to fetch auction');
    }
  };

  const handleDeleteAuction = async () => {
    if (!window.confirm('Are you sure you want to delete this auction?')) return;

    try {
      await API.delete(`/auctions/${auctionId}`);
      router.push('/auctions');
    } catch (err) {
      setError('Failed to delete auction');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Auction not found</p>
          <Link href="/auctions" className="text-blue-600 hover:underline">
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  const isSellerLoggedIn = currentUser?.id === auction?.seller?.id;
  const images = auction.images && auction.images.length > 0 
    ? auction.images 
    : ['https://via.placeholder.com/500x500?text=No+Image'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to Auctions
          </Link>
          <h1 className="text-3xl font-bold text-black">{auction.title}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
              <img
                src={images[imageIndex]}
                alt={auction.title}
                className="w-full h-64 md:h-80 object-cover"
              />
              
              {images.length > 1 && (
                <div className="bg-gray-100 p-4 flex gap-2 overflow-x-auto">
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setImageIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                        idx === imageIndex ? 'border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Description</h2>
              <p className="text-gray-700 leading-relaxed mb-4">{auction.description}</p>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="text-lg font-semibold text-black">{auction.category || 'General'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Condition</p>
                  <p className="text-lg font-semibold text-black">{auction.condition || 'Good'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Seller Information
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {auction.sellerId?.name?.[0]?.toUpperCase() || auction.seller?.name?.[0]?.toUpperCase() || 'S'}
                </div>
                <div>
                  <p className="font-semibold text-black text-lg">{auction.sellerId?.name || auction.seller?.name || 'Unknown Seller'}</p>
                  <p className="text-sm text-gray-600">{auction.sellerId?.email || auction.seller?.email || 'No email'}</p>
                  <p className="text-sm text-gray-600">{auction.sellerId?.phone || auction.seller?.phone || 'No phone'}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Seller Stats</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-black">⭐ 4.8</p>
                    <p className="text-xs text-gray-600">Rating</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">127</p>
                    <p className="text-xs text-gray-600">Items Sold</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-4 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition font-semibold">
                Contact Seller
              </button>
            </div>
          </div>

          <div>
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700 font-semibold">Time Left</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{timeLeft}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Starting Bid</p>
              <p className="text-2xl font-bold text-black mb-4">₦{auction.startingBid?.toLocaleString()}</p>

              {auction.currentBid && (
                <>
                  <p className="text-sm text-gray-600 mb-2">Current Bid</p>
                  <p className="text-3xl font-bold text-blue-600 mb-4">₦{auction.currentBid?.toLocaleString()}</p>
                </>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                <p className="text-lg font-semibold text-black">{auction.bids?.length || 0} bids</p>
              </div>
            </div>

            {!isSellerLoggedIn && timeLeft !== 'Auction Ended' && (
              <form onSubmit={handlePlaceBid} className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-bold text-black mb-4">Place a Bid</h3>
                {bidError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                    {bidError}
                  </div>
                )}
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Minimum: ₦${(auction.currentBid || auction.startingBid)?.toLocaleString()}`}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={bidLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {bidLoading ? 'Placing Bid...' : 'Place Bid'}
                </button>
              </form>
            )}

            {isSellerLoggedIn && (
              <button
                onClick={handleDeleteAuction}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 mb-6"
              >
                <Trash2 className="w-5 h-5" />
                Delete Auction
              </button>
            )}

            {timeLeft === 'Auction Ended' && (
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <p className="text-gray-700 font-semibold">This auction has ended</p>
                {auction.winnerId && (
                  <p className="text-sm text-gray-600 mt-2">Winner: {auction.winner?.name}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition">
                <Heart className="w-5 h-5" />
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {auction.bids && auction.bids.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-black mb-4">Bid History</h3>
            <div className="space-y-3">
              {[...auction.bids].reverse().map((bid: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="font-semibold text-black">{bid.bidderId?.name || 'Anonymous'}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(bid.timestamp).toLocaleDateString()} at {new Date(bid.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-blue-600">₦{bid.amount?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}