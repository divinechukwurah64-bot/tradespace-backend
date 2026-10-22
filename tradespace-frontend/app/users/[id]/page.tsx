'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, ShieldCheck } from 'lucide-react';
import API from '@/lib/api';

const Stars = ({ value, size = 'w-5 h-5' }: { value: number; size?: string }) => (
  <div className="flex">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`${size} ${n <= Math.round(value) ? 'text-yellow-500' : 'text-gray-300'}`}
        fill={n <= Math.round(value) ? 'currentColor' : 'none'}
      />
    ))}
  </div>
);

export default function UserProfile() {
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await API.get(`/users/${userId}`);
        setProfile(response.data);
      } catch (err: any) {
        setError(
          err.response?.status === 404
            ? 'This profile does not exist'
            : err.response?.data?.error || 'Could not load this profile'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-4">{error || 'Profile not found'}</p>
          <Link href="/auctions" className="text-blue-600 hover:underline">
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  const stats = profile.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
            <ArrowLeft className="w-5 h-5" />
            Back to Auctions
          </Link>

          <div className="flex items-center gap-5">
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt={profile.fullName}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {profile.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-black flex items-center gap-2">
                {profile.fullName}
                {profile.isVerified && <ShieldCheck className="w-6 h-6 text-blue-600" />}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Member since {new Date(profile.joinedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {profile.bio && <p className="text-gray-700 mt-4">{profile.bio}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-5">
            {stats.rating !== null ? (
              <>
                <p className="text-3xl font-bold text-black">{stats.rating}</p>
                <Stars value={stats.rating} size="w-4 h-4" />
              </>
            ) : (
              <p className="text-xl font-bold text-gray-500">No ratings yet</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              {stats.ratingCount} {stats.ratingCount === 1 ? 'review' : 'reviews'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-3xl font-bold text-black">{stats.itemsSold}</p>
            <p className="text-xs text-gray-600 mt-1">Items sold</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-3xl font-bold text-black">{stats.activeListings}</p>
            <p className="text-xs text-gray-600 mt-1">Active auctions</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-3xl font-bold text-black">{stats.activeGigs}</p>
            <p className="text-xs text-gray-600 mt-1">Active gigs</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-black mb-4">Listings</h2>
        {profile.listings.length === 0 ? (
          <p className="text-gray-500 mb-8">No listings yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {profile.listings.map((l: any) => (
              <Link
                key={l._id}
                href={`/auctions/${l._id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
              >
                <div className="relative h-36 bg-gray-200">
                  {l.images && l.images[0] && (
                    <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                  )}
                  {l.isLive && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      LIVE
                    </span>
                  )}
                  {l.status === 'sold' && (
                    <span className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      SOLD
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-black truncate">{l.title}</p>
                  <p className="text-lg font-bold text-blue-600">
                    ₦{Number(l.status === 'sold' ? l.winningBid : l.currentBid || l.startingBid).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold text-black mb-4">Reviews</h2>
        {profile.reviews.length === 0 ? (
          <p className="text-gray-500">No reviews yet. Buyers can review a seller after winning an auction.</p>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {profile.reviews.map((r: any) => (
              <div key={r._id} className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <Stars value={r.rating} size="w-4 h-4" />
                    {r.reviewerId?._id ? (
                      <Link href={`/users/${r.reviewerId._id}`} className="font-semibold text-black hover:text-blue-600 text-sm">
                        {r.reviewerId.fullName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-black text-sm">A buyer</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-gray-700 text-sm mt-2 break-words">{r.comment}</p>}
                {r.auctionId?.title && (
                  <p className="text-xs text-gray-500 mt-2">Item: {r.auctionId.title}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}