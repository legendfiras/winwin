export function uploadErrorMessage(err) {
  if (err?.status === 401) return 'Your admin session expired. Please log in again, then re-upload.';
  return `Image upload failed: ${err?.message || 'unknown error'}`;
}
