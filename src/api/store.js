import { apiUrl } from '@/lib/apiConfig';

function adminHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const token = localStorage.getItem('winwin_admin_session');
    if (token) headers['X-Admin-Token'] = token;
  } catch {
    // ignore
  }
  return headers;
}

function logApiError(details) {
  console.error('[WinWin API] product/store request failed', details);
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const url = apiUrl(path);
  const headers = adminHeaders(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    logApiError({
      endpoint: url,
      method,
      status: 0,
      error: err?.message || String(err),
      responseBody: null,
    });
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      logApiError({
        endpoint: url,
        method,
        status: res.status,
        contentType,
        error: 'Response was not JSON (often the custom domain served the HTML app instead of the Worker API)',
        responseBody: raw.slice(0, 500),
      });
      const error = new Error(`API ${method} ${url} returned ${res.status} ${contentType || 'non-JSON'}`);
      error.status = res.status;
      error.data = { error: 'invalid_api_response', raw: raw.slice(0, 200) };
      throw error;
    }
  }

  if (!res.ok) {
    logApiError({
      endpoint: url,
      method,
      status: res.status,
      contentType,
      error: data.error || res.statusText,
      responseBody: raw.slice(0, 1000),
    });
    const error = new Error(data.error || res.statusText);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

function productsQuery(opts = {}) {
  const params = new URLSearchParams();
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.cat) params.set('cat', opts.cat);
  if (opts.q) params.set('q', opts.q);
  if (opts.sort) params.set('sort', opts.sort);
  const qs = params.toString();
  return qs ? `/api/products?${qs}` : '/api/products';
}

export function asProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export const store = {
  products: {
    list: (opts) => request(productsQuery(opts)),
    get: (id) => request(`/api/products/${encodeURIComponent(id)}`),
    create: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  },
  settings: {
    list: () => request('/api/settings'),
    upsert: (key, value) =>
      request('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ setting_key: key, setting_value: value }),
      }),
  },
  slides: {
    list: () => request('/api/slides'),
    create: (data) => request('/api/slides', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/slides/${id}`, { method: 'DELETE' }),
  },
  upload: async (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/upload', { method: 'POST', body: form });
  },
};
