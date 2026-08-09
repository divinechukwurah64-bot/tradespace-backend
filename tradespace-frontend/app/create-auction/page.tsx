'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import API from '@/lib/api';

export default function CreateAuction() {
  const router = useRouter();
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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const imgbbFormData = new FormData();
      imgbbFormData.append('image', file);
      imgbbFormData.append('key', process.env.NEXT_PUBLIC_IMGBB_API_KEY || '');

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: imgbbFormData,
      });

      const data = await response.json();
      if (data.success) {
        setFormData({ ...formData, image: data.data.url });
      } else {
        setError('Failed to upload image');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await API.post('/auctions', {
        title: formData.title,
        description: formData.description,
        category: formData.category || 'Other',
        condition: formData.condition || 'New',
        startingBid: Number(formData.startingPrice),
        images: formData.image ? [formData.image] : ['https://via.placeholder.com/400x300?text=Product+Image'],
      });
      router.push('/auctions');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

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
              placeholder="0.00"
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