// Shared image helpers: shrink a photo in the browser, then upload it to ImgBB.

export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 45000;

export type CompressOptions = {
  maxSide: number;
  quality: number;
};

// Auction photos stay large. Profile pictures only show as small avatars, so they can be much smaller.
export const AUCTION_PHOTO: CompressOptions = { maxSide: 1280, quality: 0.8 };
export const PROFILE_PHOTO: CompressOptions = { maxSide: 512, quality: 0.8 };

// Shrinks the photo in the browser before it is uploaded
export const compressImage = (file: File, options: CompressOptions = AUCTION_PHOTO): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, options.maxSide / Math.max(img.width, img.height));
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
        options.quality
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
export const uploadWithRetry = async (blob: Blob): Promise<string> => {
  try {
    return await uploadToImgbb(blob);
  } catch (firstErr) {
    return await uploadToImgbb(blob);
  }
};

// Checks the file, shrinks it, uploads it and returns the https link.
// Throws an Error whose message is safe to show to the person.
export const prepareAndUploadImage = async (
  file: File,
  options: CompressOptions = AUCTION_PHOTO
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error('That photo is too large. Please choose one under 15 MB.');
  }

  try {
    const blob = await compressImage(file, options);
    return await uploadWithRetry(blob);
  } catch (err) {
    console.error('Upload error:', err);
    throw new Error('Could not upload the photo. Check your connection and try again, or use a JPG or PNG.');
  }
};