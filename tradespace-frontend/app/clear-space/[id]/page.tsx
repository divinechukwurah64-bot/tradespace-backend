'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import API from '@/lib/api';

export default function GigDetail() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id as string;

  const [gig, setGig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchGig = async () => {
      try {
        const response = await API.get(`/gigs/${gigId}`);
        setGig(response.data);
      } catch (err) {
        setError('Failed to load gig');
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

    fetchGig();
    fetchUser();
  }, [gigId]);

  const handleDeleteGig = async () => {
    if (!window.confirm('Are you sure you want to delete this gig?')) return;

    try {
      await API.delete(`/gigs/${gigId}`);
      router.push('/clear-space');
    } catch (err) {
      setError('Failed to delete gig');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading gig...</p>
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Gig not found</p>
          <Link href="/clear-space" className="text-blue-600 hover:underline">
            Back to Clear Space
          </Link>
        </div>
      </div>
    );
  }

  const isSellerLoggedIn = currentUser?.id === gig?.seller?.id;
  const image = gig.images && gig.images[0] 
    ? gig.images[0]
    : 'https://via.placeholder.com/400x400?text=No+Image';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/clear-space" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to Clear Space
          </Link>
          <h1 className="text-3xl font-bold text-black">{gig.title}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <img
                src={image}
                alt={gig.title}
                className="w-full h-96 object-cover"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">About this gig</h2>
              <p className="text-gray-700 leading-relaxed">{gig.description}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-black mb-4">Seller Information</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {gig.seller?.name?.[0]?.toUpperCase() || 'S'}
                </div>
                <div>
                  <p className="font-semibold text-black">{gig.seller?.name}</p>
                  <p className="text-sm text-gray-600">{gig.seller?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-gray-600">4.8 (127 reviews)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Starting from</p>
              <p className="text-4xl font-bold text-blue-600 mb-6">₦{gig.startingPrice?.toLocaleString()}</p>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Category</p>
                <p className="font-semibold text-black">{gig.category}</p>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Delivery Time</p>
                <p className="font-semibold text-black">{gig.deliveryDays} days</p>
              </div>

              {!isSellerLoggedIn && (
                <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition mb-3">
                  Order Now
                </button>
              )}

              {isSellerLoggedIn && (
                <button
                  onClick={handleDeleteGig}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Gig
                </button>
              )}
            </div>

            {gig.tags && gig.tags.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-black mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {gig.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}