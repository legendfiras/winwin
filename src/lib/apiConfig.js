import { ALLOWED_ORIGINS, WORKER_ORIGIN } from '@/lib/allowedOrigins';

export { ALLOWED_ORIGINS, WORKER_ORIGIN };

export function resolveApiBase() {
  const envBase = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (envBase) return envBase;
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.replace(/^www\./, '');
  if (host === 'winwinleb.com') return WORKER_ORIGIN;
  return '';
}

export function apiUrl(path) {
  const base = resolveApiBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
