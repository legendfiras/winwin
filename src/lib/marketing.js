import { apiUrl } from '@/lib/apiConfig';

export async function unsubscribeMarketing(token) {
  const response = await fetch(apiUrl('/api/marketing/unsubscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to unsubscribe.');
  return data;
}
