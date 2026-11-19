'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X } from 'lucide-react';
import API from '@/lib/api';
import { AUCTION_PHOTO, prepareAndUploadImage } from '@/lib/image';

const MIN_STARTING_PRICE = 500;
const MAX_IMAGES = 5;

export default function CreateAuction() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startingPrice: '',
    category: 'Other',
    condition: 'New',
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setCheckingAuth(false);
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setUploadingSlot(slot);
    try {
      const url = await prepareAndUploadImage(file, AUCTION_PHOTO);
      setImages((prev) => {
        const next = [...prev];
        if (slot < next.length) {
          next[slot] = url;
        } else {
          next.push(url);
        }
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Could not upload the photo. Please try again.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (images.length === 0) {
      setError('Add at least one photo');
      return;
    }

    const price = Number(formData.startingPrice);
    if (!Number.isInteger(price) || price < MIN_STARTING_PRICE) {
      setError(`Starting price must be a whole number of at least ₦${MIN_STARTING_PRICE.toLocaleString()}`);
      return;
    }

    setLoading(true);
    try {
      await API.post('/auctions', {
        title: formData.title,
        description: formData.description,
        category: formData.category || 'Other',
        condition: formData.condition || 'New',
        startingBid: price,
        images,
      });
      router.push('/auctions');
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      setError(err.response?.data?.error || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) return null;

  const slots = Array.from({ length: MAX_IMAGES });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to Auctions
          </Link>
          <h1 className="text-3xl font-bold text-black">Create Auction</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Photos <span className="font-normal text-gray-500">({images.length} of {MAX_IMAGES})</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              First photo is the main one. Tap an uploaded photo to replace it.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {slots.map((_, idx) => {
                const filled = images[idx];
                const isUploading = uploadingSlot === idx;
                const isLocked = idx > images.length;

                return (
                  <div key={idx} className="relative aspect-square">
                    {filled ? (
                      <>
                        <label
                          htmlFor={`img-${idx}`}
                          className="block w-full h-full cursor-pointer rounded-lg overflow-hidden border-2 border-blue-400"
                        >
                          <img
                            src={filled}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <input
                            type="file"
                            id={`img-${idx}`}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, idx)}
                            className="hidden"
                            disabled={uploadingSlot !== null}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
                          aria-label="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold bg-blue-600 text-white py-0.5 rounded-b-lg">
                            Main
                          </span>
                        )}
                      </>
                    ) : (
                      <label
                        htmlFor={`img-${idx}`}
                        className={`flex flex-col items-center justify-center w-full h-full rounded-lg border-2 border-dashed transition ${
                          isLocked
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                            : 'border-gray-300 bg-white hover:border-blue-400 cursor-pointer'
                        }`}
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus className={`w-5 h-5 ${isLocked ? 'text-gray-300' : 'text-gray-400'}`} />
                            {idx === 0 && (
                              <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight">
                                Add photo
                              </span>
                            )}
                          </>
                        )}
                        <input
                          type="file"
                          id={`img-${idx}`}
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, idx)}
                          className="hidden"
                          disabled={isLocked || uploadingSlot !== null}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What are you selling?"
              maxLength={150}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your item in detail..."
              rows={5}
              maxLength={5000}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
              >
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home">Home</option>
                <option value="Sports">Sports</option>
                <option value="Books">Books</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
              >
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Starting Price (₦)</label>
            <input
              type="number"
              value={formData.startingPrice}
              onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })}
              placeholder={`Minimum ₦${MIN_STARTING_PRICE.toLocaleString()}`}
              min={MIN_STARTING_PRICE}
              step={1}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading || uploadingSlot !== null}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Creating Auction...' : 'Create Auction'}
          </button>
        </form>
      </div>
    </div>
  );
}