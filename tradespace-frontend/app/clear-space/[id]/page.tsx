'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, User, ArrowLeft, ShoppingCart } from 'lucide-react';
import API from '@/lib/api';

export default function GigDetail() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id;

  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    fetchGig();
  }, [gigId]);

  const fetchGig = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/gigs/${gigId}`);
      setGig(response.data);
    } catch (err) {
      setError('Failed to load gig');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderGig = async () => {
    setOrdering(true);
    try {
      await API.post(`/gigs/${gigId}/order`, {});
      alert('Order placed! Check your messages for details.');
      router.push('/profile');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading gig...</p>
        </div>
      </div>
    );
  }

  if (error || !gig) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Link href="/clear-space" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Gigs
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Gig not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <Link href="/clear-space" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Gigs
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Image */}
          <div className="md:col-span-1">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg h-64 md:h-80 flex items-center justify-center sticky top-20">
              <div className="text-white text-center">
                <div className="text-6xl mb-2">💼</div>
                <p className="text-sm">Gig Preview</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Title & Category */}
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-black mb-2">{gig.title}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {gig.category}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                  {gig.deliveryDays} days delivery
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-bold text-black mb-2">About this gig</h2>
              <p className="text-gray-700 leading-relaxed">{gig.description}</p>
            </div>

            {/* Tags */}
            {gig.tags && gig.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-600 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {gig.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Seller Info */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-300 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {gig.sellerId?.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-black text-lg">{gig.sellerId?.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-black">{gig.rating || 5}</span>
                    <span className="text-gray-600 text-sm">({gig.orders || 0} orders)</span>
                  </div>
                </div>
              </div>
            </div>

  {/* Price & Order */}
<div className="bg-white rounded-lg border border-gray-200 p-6">
  <div className="mb-6">
    <p className="text-sm text-gray-600 mb-1">Starting from</p>
    <p className="text-4xl font-bold text-black">₦{gig.startingPrice?.toLocaleString()}</p>
  </div>

  <button
    onClick={handleOrderGig}
    disabled={ordering}
    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-base md:text-lg mb-3"
  >
    <ShoppingCart className="w-5 h-5" />
    {ordering ? 'Placing Order...' : 'Order Now'}
  </button>

  <button
    onClick={() => {
      if (confirm('Delete this gig?')) {
        API.delete(`/gigs/${gigId}`).then(() => {
          router.push('/clear-space');
        }).catch(err => alert('Failed to delete'));
      }
    }}
    className="w-full border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2 font-medium"
  >
    <Trash2 className="w-4 h-4" />
    Delete Gig
  </button>

  <p className="text-xs text-gray-600 text-center mt-4">
    Contact the seller for details after ordering
  </p>
</div>
          </div>
        </div>
      </div>
    </div>
  );
}