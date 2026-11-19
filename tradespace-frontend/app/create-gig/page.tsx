'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, X, Loader2 } from 'lucide-react';
import API from '@/lib/api';

const IMGBB_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY || '';
const MAX_IMAGES = 5;
const MAX_FILE_MB = 10;

const CATEGORIES = [
  'Web Development',
  'Graphic Design',
  'Writing and Translation',
  'Video and Animation',
  'Digital Marketing',
  'Music and Audio',
  'Photography',
  'Tutoring and Lessons',
  'Repairs and Handwork',
  'Other',
];

type LocalImage = {
  id: string;
  file: File;
  preview: string;
};

// Shrinks large photos in the browser so uploads are fast and do not fail
function compressImage(file: File, maxSize = 1400, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };

    img.src = url;
  });
}

async function uploadToImgBB(file: File): Promise<string> {
  const blob = await compressImage(file);
  const formData = new FormData();
  formData.append('image', blob, 'gig.jpg');

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data?.data?.url) {
    throw new Error('Upload failed');
  }
  return data.data.url as string;
}

export default function CreateGig() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<LocalImage[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_IMAGES} images.`);
      e.target.value = '';
      return;
    }

    const accepted: LocalImage[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Each image must be smaller than ${MAX_FILE_MB}MB.`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (files.length > remaining) {
      setError(`Only ${MAX_IMAGES} images are allowed, extra files were skipped.`);
    }

    setImages((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleSubmit = async () => {
    setError('');

    if (!title.trim() || title.trim().length < 5) {
      setError('Please enter a title of at least 5 characters.');
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      setError('Please describe your service in at least 20 characters.');
      return;
    }
    if (!category) {
      setError('Please choose a category.');
      return;
    }
    const price = Number(startingPrice);
    if (!price || price <= 0) {
      setError('Please enter a valid starting price.');
      return;
    }
    const days = Number(deliveryDays);
    if (!days || days <= 0) {
      setError('Please enter a valid delivery time in days.');
      return;
    }
    if (images.length === 0) {
      setError('Please add at least one image for your gig.');
      return;
    }
    if (!IMGBB_KEY) {
      console.error('NEXT_PUBLIC_IMGBB_API_KEY is not set');
      setError('Something went wrong. Please try again later or contact support.');
      return;
    }

    setSubmitting(true);

    try {
      const uploadedUrls: string[] = [];
      for (const img of images) {
        const url = await uploadToImgBB(img.file);
        uploadedUrls.push(url);
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      await API.post('/gigs', {
        title: title.trim(),
        description: description.trim(),
        category,
        startingPrice: price,
        deliveryDays: days,
        tags,
        images: uploadedUrls,
      });

      images.forEach((img) => URL.revokeObjectURL(img.preview));
      router.push('/clear-space');
    } catch (err: any) {
      console.error('Create gig error:', err);
      setError('Something went wrong while posting your gig. Please try again later or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href="/clear-space"
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Clear Space
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-black">Post a Gig</h1>
          <p className="text-gray-600 text-sm mt-1">
            Tell buyers what you offer. Payments are held by TradeSpace until you deliver.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 md:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Images */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Gig images <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Add up to {MAX_IMAGES} images. The first image is the cover shown on the gig card.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
                >
                  <img src={img.preview} alt="Gig preview" className="w-full h-full object-cover" />
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    disabled={submitting}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 flex flex-col items-center justify-center text-gray-500 hover:text-purple-600 transition"
                >
                  <ImagePlus className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">Add image</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="I will build a modern website for your business"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Explain what you will deliver, what you need from the buyer, and what makes your service different."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/2000</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Price and delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-black mb-1">
                Starting price (NGN) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                placeholder="5000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-black mb-1">
                Delivery time (days) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="3"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="react, website, landing page"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas. Up to 10.</p>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading and posting...
                </>
              ) : (
                'Post Gig'
              )}
            </button>
            <Link
              href="/clear-space"
              className="flex-1 text-center border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}