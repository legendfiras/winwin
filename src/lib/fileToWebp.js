export async function fileToWebp(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Choose an image file');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('Could not convert that image to WebP');
  const base = String(file.name || 'product')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 40) || 'product';
  return new File([blob], `${base}.webp`, { type: 'image/webp' });
}
