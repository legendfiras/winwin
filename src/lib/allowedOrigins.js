export const WORKER_ORIGIN = 'https://winwin.firaskotob508.workers.dev';

export const ALLOWED_ORIGINS = [
  'https://winwinleb.com',
  'https://www.winwinleb.com',
  WORKER_ORIGIN,
];

export function corsHeaders(request) {
  const origin = request?.headers?.get?.('Origin') || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    Vary: 'Origin',
  };
}
