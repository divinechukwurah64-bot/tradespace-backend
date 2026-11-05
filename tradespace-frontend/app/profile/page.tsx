'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Star } from 'lucide-react';
import API from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';
import { PROFILE_PHOTO, prepareAndUploadImage } from '@/lib/image';

const DAY_MS = 24 * 60 * 60 * 1000;

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

// Shows the photo, or a grey box if there is none or it fails to load
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
        No photo
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}

// What stage a paid sale is at, in plain words
const saleStage = (sale: any, role: 'buyer' | 'seller') => {
  if (sale.paymentStatus === 'refunded') {
    return role === 'buyer' ? 'Your payment was refunded' : 'Refunded to the buyer';
  }
  if (sale.disputeStatus === 'filed') {
    if (sale.buyerReported && sale.sellerComplained) {
      return 'Both sides reported a problem. Under review';
    }
    if (sale.buyerReported) {
      return role === 'buyer'
        ? 'You reported a problem. Under review'
        : 'The buyer reported a problem. Under review';
    }
    if (sale.sellerComplained) {
      return role === 'seller'
        ? 'You reported a problem. Under review'
        : 'The seller reported a problem. Under review';
    }
    return 'A problem is under review';
  }
  if (sale.paymentStatus === 'released' || sale.payoutStatus === 'paid') {
    return role === 'buyer' ? 'Completed. The seller has been paid' : 'You have been paid';
  }
  if (sale.payoutStatus === 'queued' || sale.payoutStatus === 'processing') {
    return role === 'buyer'
      ? 'You confirmed the item. The seller is being paid'
      : 'Your payout is on its way';
  }
  if (sale.payoutStatus === 'failed') {
    return role === 'buyer' ? 'The seller is being paid' : 'Payout problem. Our team has been told';
  }
  if (sale.paymentStatus === 'captured') {
    return 'Payment received. Being checked';
  }
  return role === 'buyer'
    ? 'Payment held. Confirm when the item arrives'
    : 'Paid and held. Get the item to the buyer';
};

const saleTone = (sale: any) => {
  if (sale.disputeStatus === 'filed') return 'text-red-600';
  if (sale.paymentStatus === 'released' || sale.payoutStatus === 'paid') return 'text-green-700';
  if (sale.paymentStatus === 'refunded') return 'text-yellow-700';
  return 'text-blue-700';
};

const windowNote = (sale: any) => {
  if (sale.disputeStatus === 'filed') return 'Stays here until it is resolved';
  if (!sale.windowEndsAt) return '';
  const left = new Date(sale.windowEndsAt).getTime() - Date.now();
  if (left <= 0) return 'Leaves this list soon';
  const days = Math.ceil(left / DAY_MS);
  return `Shown here for ${days} more ${days === 1 ? 'day' : 'days'}`;
};

function SaleCard({ sale, role }: { sale: any; role: 'buyer' | 'seller' }) {
  return (
    <Link
      href={`/auctions/${sale.auctionId}`}
      className="bg-white rounded-lg shadow hover:shadow-lg transition flex gap-4 p-3"
    >
      <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
        <Thumb src={sale.image} alt={sale.title} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-black truncate">{sale.title}</p>
        <p className="text-sm text-gray-700">
          {role === 'buyer' ? (
            <>₦{Number(sale.amount).toLocaleString()}</>
          ) : (
            <>You receive ₦{Number(sale.sellerPayout ?? sale.amount).toLocaleString()}</>
          )}
          {sale.otherName ? (role === 'buyer' ? ` from ${sale.otherName}` : ` - buyer ${sale.otherName}`) : ''}
        </p>
        <p className={`text-sm font-semibold mt-1 ${saleTone(sale)}`}>{saleStage(sale, role)}</p>
        <p className="text-xs text-gray-500 mt-1">{windowNote(sale)}</p>
      </div>
    </Link>
  );
}

export default function MyProfile() {
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bought, setBought] = useState<any[]>([]);
  const [sold, setSold] = useState<any[]>([]);
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

      try {
        const [boughtRes, soldRes] = await Promise.all([
          API.get('/payments/bought'),
          API.get('/payments/sold'),
        ]);
        setBought(boughtRes.data);
        setSold(soldRes.data);
      } catch (e) {
        console.error('Failed to load purchases and sales');
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

    setUploading(true);
    try {
      // Shrinks the picture to 512 px in the browser, then uploads it
      let url: string;
      try {
        url = await prepareAndUploadImage(file, PROFILE_PHOTO);
      } catch (err: any) {
        toast.error(err.message || 'Could not upload your picture. Please try again.');
        return;
      }

      try {
        await savePatch({ profileImage: url });
        toast.success('Profile picture updated');
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Could not save your picture. Please try again.');
      }
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

        <h2 className="text-xl font-bold text-black mb-1">My purchases</h2>
        <p className="text-sm text-gray-500 mb-4">
          Items you paid for in the last 7 days. Open one to confirm you received it or to report a problem.
        </p>
        {bought.length === 0 ? (
          <p className="text-gray-500 mb-8">Nothing bought in the last 7 days.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {bought.map((sale: any) => (
              <SaleCard key={sale.transactionId} sale={sale} role="buyer" />
            ))}
          </div>
        )}

        {sold.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-black mb-1">Sold this week</h2>
            <p className="text-sm text-gray-500 mb-4">
              Only you can see this. Open a sale to see the buyer's contact details or to report a problem within 7
              days of payment.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {sold.map((sale: any) => (
                <SaleCard key={sale.transactionId} sale={sale} role="seller" />
              ))}
            </div>
          </>
        )}

        <h2 className="text-xl font-bold text-black mb-4">My listings</h2>
        {!profile || profile.listings.length === 0 ? (
          <p className="text-gray-500 mb-8">
            You have no active listings.{' '}
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
                  <Thumb src={l.images && l.images[0] ? l.images[0] : null} alt={l.title} />
                  {l.isLive && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      LIVE
                    </span>
                  )}
                  {l.status === 'awaiting_payment' && (
                    <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      PAYMENT PENDING
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-black truncate">{l.title}</p>
                  <p className="text-lg font-bold text-blue-600">
                    ₦{Number(l.currentBid || l.startingBid).toLocaleString()}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}