'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react';
import API from '@/lib/api';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchMyAuctions();
  }, [router]);

  const fetchMyAuctions = async () => {
    try {
      setLoading(true);
      const response = await API.get('/auctions/user/my-auctions');
      setAuctions(response.data);
    } catch (err) {
      setError('Failed to load your auctions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (auctionId) => {
    if (!confirm('Delete this auction?')) {
      return;
    }

    setDeleting(true);
    try {
      await API.delete(`/auctions/${auctionId}`);
      setAuctions(auctions.filter(a => a._id !== auctionId));
    } catch (err) {
      alert('Failed to delete auction');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-12">
        
        {/* User Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-300 rounded-full flex items-center justify-center text-white text-3xl md:text-4xl font-bold flex-shrink-0">
              {user.fullName?.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-black">{user.fullName}</h1>
              <p className="text-gray-600 text-sm md:text-base mt-1">{user.email}</p>
              {user.phone && <p className="text-gray-600 text-sm md:text-base">{user.phone}</p>}
              
              <div className="mt-6 grid grid-cols-3 gap-4 md:gap-6">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Rating</p>
                  <p className="text-xl md:text-2xl font-bold text-black">⭐ {user.sellerRating || 5}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Sales</p>
                  <p className="text-xl md:text-2xl font-bold text-black">{user.totalSalesCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Bids</p>
                  <p className="text-xl md:text-2xl font-bold text-black">{user.totalBidsCount || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auctions Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-bold text-black">My Auctions</h2>
            <Link href="/create-auction" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm md:text-base font-medium">
              <Plus className="w-4 h-4" />
              Create
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Loading...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600 mb-4 text-sm md:text-base">No auctions yet</p>
              <Link href="/create-auction" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm">
                Create First
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {auctions.map((auction) => (
                <div key={auction._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  
                  <div className="bg-gray-100 h-32 md:h-40 flex items-center justify-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                  </div>

                  <div className="p-4 md:p-6">
                    <h3 className="font-bold text-gray-900 line-clamp-2 text-base md:text-lg mb-2">
                      {auction.title}
                    </h3>

                    <p className="text-xs md:text-sm text-gray-600 mb-3">{auction.category}</p>

                    <div className="mb-4">
                      <p className="text-xs text-gray-500">Current Bid</p>
                      <p className="text-xl md:text-2xl font-bold text-black">
                        ₦{auction.currentBid?.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/auctions/${auction._id}`}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-center font-medium text-sm"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => alert('Edit coming soon')}
                        className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(auction._id)}
                        disabled={deleting}
                        className="flex items-center justify-center gap-1 px-3 py-2 border border-red-300 rounded-lg hover:bg-red-50 text-red-600 text-sm disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}