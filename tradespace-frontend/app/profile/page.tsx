'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Star } from 'lucide-react';
import API from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';

const Stars = ({ value, size = 'w-4 h-4' }: { value: number; size?: string }) => (
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

export default function MyProfile() {
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: '', phone: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const meRes = await API.get('/auth/me');
      setMe(meRes.data);
      setForm({
        fullName: meRes.data.fullName || '',
        phone: meRes.data.phone || '',
        bio: meRes.data.bio || '',
      });

      try {
        const profileRes = await API.get(`/users/${meRes.data._id}`);
        setProfile(profileRes.data);
      } catch (e) {
        console.error('Failed to load profile stats');
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      setError(err.response?.data?.error || 'Could not load your profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    load();
  }, []);

  const savePatch = async (patch: any) => {
    const response = await API.put('/users/me', patch);
    const updated = response.data;
    setMe((prev: any) => ({ ...prev, ...updated }));

    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        localStorage.setItem(
          'user',
          JSON.stringify({
            ...user,
            fullName: updated.fullName,
            phone: updated.phone,
            profileImage: updated.profileImage,
          })
        );
      } catch (e) {
        // ignore
      }
    }
    return updated;
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await savePatch(form);
      toast.success('Profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('The image must be smaller than 5MB');
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('key', process.env.NEXT_PUBLIC_IMGBB_API_KEY || '');

      const upload = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body });
      const data = await upload.json();
      if (!data.success) {
        throw new Error('Upload failed');
      }

      await savePatch({ profileImage: data.data.url });
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not upload your picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    const ok = await confirmDialog({
      title: 'Remove your picture?',
      message: 'Your profile will show your initial instead.',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;

    try {
      await savePatch({ profileImage: null });
      toast.success('Profile picture removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not remove your picture');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading your profile...
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">{error || 'Could not load your profile'}</p>
      </div>
    );
  }

  const stats = profile?.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-5">
            <div className="relative">
              {me.profileImage ? (
                <img
                  src={me.profileImage}
                  alt={me.fullName}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {me.fullName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <label
                htmlFor="profile-image-input"
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700"
                title="Change picture"
              >
                <Camera className="w-4 h-4" />
              </label>
              <input
                id="profile-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploading}
                className="hidden"
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-black">{me.fullName}</h1>
              <p className="text-gray-600 text-sm">{me.email}</p>
              <p className="text-gray-500 text-xs mt-1">
                Member since {new Date(me.createdAt).toLocaleDateString()}
              </p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <Link href={`/users/${me._id}`} className="text-blue-600 hover:underline">
                  View my public profile
                </Link>
                <Link href="/profile/payout" className="text-blue-600 hover:underline">
                  Payout account
                </Link>
                {me.profileImage && (
                  <button onClick={handleRemovePhoto} className="text-red-600 hover:underline">
                    Remove picture
                  </button>
                )}
                {me.role === 'admin' && (
                  <Link href="/admin" className="text-blue-600 hover:underline">
                    Admin panel
                  </Link>
                )}
              </div>
              {uploading && <p className="text-sm text-gray-600 mt-2">Uploading your picture...</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-black mb-4">Edit profile</h2>

          <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
            minLength={2}
            maxLength={60}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+234 (optional)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
          />
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Never shown publicly. It is only shared with the winning bidder or buyer after you accept a bid.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            maxLength={300}
            placeholder="Tell buyers a little about yourself"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
          />
          <p className="text-xs text-gray-500 mt-1 mb-4">{form.bio.length}/300</p>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-5">
              {stats.rating !== null ? (
                <>
                  <p className="text-3xl font-bold text-black">{stats.rating}</p>
                  <Stars value={stats.rating} />
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
        )}

        <h2 className="text-xl font-bold text-black mb-4">My listings</h2>
        {!profile || profile.listings.length === 0 ? (
          <p className="text-gray-500 mb-8">
            You have no listings yet.{' '}
            <Link href="/create-auction" className="text-blue-600 hover:underline">
              Create an auction
            </Link>
          </p>
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

        <h2 className="text-xl font-bold text-black mb-4">Reviews about you</h2>
        {!profile || profile.reviews.length === 0 ? (
          <p className="text-gray-500">No reviews yet. Buyers can review you after winning one of your auctions.</p>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {profile.reviews.map((r: any) => (
              <div key={r._id} className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <Stars value={r.rating} />
                    <span className="font-semibold text-black text-sm">{r.reviewerId?.fullName || 'A buyer'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-gray-700 text-sm mt-2 break-words">{r.comment}</p>}
                {r.auctionId?.title && <p className="text-xs text-gray-500 mt-2">Item: {r.auctionId.title}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}