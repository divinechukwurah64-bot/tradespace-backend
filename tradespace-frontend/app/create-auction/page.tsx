'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import API from '@/lib/api';

const MAX_IMAGE_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 45000;
const MIN_STARTING_PRICE = 100;

// Shrinks the photo in the browser before it is uploaded
const compressImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not supported'));
        return;
      }

      // White background so transparent PNGs do not turn black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress the image'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the image'));
    };

    img.src = objectUrl;
  });

const uploadToImgbb = async (blob: Blob): Promise<string> => {
  const body = new FormData();
  body.append('image', blob, 'photo.jpg');
  body.append('key', process.env.NEXT_PUBLIC_IMGBB_API_KEY || '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    const data = await response.json();

    if (!data.success || !data.data || !data.data.url) {
      throw new Error('Upload failed');
    }

    return String(data.data.url).replace(/^http:\/\//i, 'https://');
  } finally {
    clearTimeout(timer);
  }
};

// One automatic retry, because mobile connections drop often
const uploadWithRetry = async (blob: Blob): Promise<string> => {
  try {
    return await uploadToImgbb(blob);
  } catch (firstErr) {
    return await uploadToImgbb(blob);
  }
};

export default function CreateAuction() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startingPrice: '',
    category: 'Other',
    condition: 'New',
    image: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setCheckingAuth(false);
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    // Lets the same file be chosen again after a failed attempt
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setError('That photo is too large. Please choose one under 15 MB.');
      return;
    }

    setError('');
    setUploadingImage(true);
    try {
      const blob = await compressImage(file);
      const url = await uploadWithRetry(blob);
      setFormData((prev) => ({ ...prev, image: url }));
    } catch (err) {
      console.error('Upload error:', err);
      setError('Could not upload the photo. Check your connection and try again, or use a JPG or PNG.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.image) {
      setError('Please add a product photo');
      return;
    }

    const price = Number(formData.startingPrice);
    if (!Number.isInteger(price) || price < MIN_STARTING_PRICE) {
      setError('Starting price must be a whole number of at least ₦100');
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
        images: [formData.image],
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

  if (checkingAuth) {
    return null;
  }

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
            <label className="block text-sm font-bold text-gray-700 mb-2">Product Image</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              {formData.image ? (
                <div className="text-center">
                  <img src={formData.image} alt="Preview" className="w-32 h-32 object-cover mx-auto rounded mb-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                    id="image-input"
                  />
                  <label htmlFor="image-input" className="text-blue-600 hover:underline cursor-pointer">
                    {uploadingImage ? 'Uploading...' : 'Change Image'}
                  </label>
                </div>
              ) : (
                <div className="text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                    id="image-input"
                  />
                  <label htmlFor="image-input" className="cursor-pointer block">
                    <p className="text-gray-600 mb-2">
                      {uploadingImage ? 'Uploading...' : 'Click to upload product image'}
                    </p>
                  </label>
                </div>
              )}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="e.g. 5000"
              min={MIN_STARTING_PRICE}
              step={1}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Creating Auction...' : 'Create Auction'}
          </button>
        </form>
      </div>
    </div>
  );
}