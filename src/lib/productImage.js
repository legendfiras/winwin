import { resolveApiBase } from '@/lib/apiConfig';

export function productImageFilename(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const name = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(name);
  } catch {
    return String(url).split('/').pop() || '';
  }
}

// Uploaded images live in the Worker's KV store, which the Pages site on
// winwinleb.com cannot read, so /img/ paths must be fetched from the Worker.
function workerImagePath(path) {
  return `${resolveApiBase()}${path}`;
}

export function productImageSrc(url) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('/img/')) return workerImagePath(url);
  const filename = productImageFilename(url);
  if (!filename) return url;
  return workerImagePath(`/img/${filename}`);
}

export function productImageFallback(event) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.style.objectFit = 'contain';
  img.alt = img.alt || 'Photo unavailable';
}
