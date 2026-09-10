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

async function request(path, options = {}) {
  const headers = adminHeaders(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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

export const store = {
  products: {
    list: (opts) => request(productsQuery(opts)),
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
