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
  return `/img/${filename}`;
}

export function productImageFallback(event) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.style.objectFit = 'contain';
  img.alt = img.alt || 'Photo unavailable';
}
