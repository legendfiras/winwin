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

export function productImageSrc(url) {
  if (!url) return '';
  if (
    url.startsWith('/img/') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const filename = productImageFilename(url);
  if (!filename) return url;
  const base = import.meta.env.VITE_PRODUCT_IMAGE_BASE_URL;
  if (base) {
    return `${String(base).replace(/\/$/, '')}/${filename}`;
  }
  return `/img/${filename}`;
}

export function productImageFallback(event) {
  const img = event.currentTarget;
  img.style.visibility = 'hidden';
}
