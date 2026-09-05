const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const DEFAULT_SETTINGS = [
  ['whatsapp_number', '0096181629538'],
  ['background_color', '#FFF8F0'],
  ['admin_password', '1234'],
  ['admin_email', ''],
  ['winwin_card_image', ''],
  ['customer_feedback', ''],
];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function randomToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function productFromRow(row) {
  if (!row) return null;
  return {
    ...row,
    in_stock: Boolean(row.in_stock),
    price: Number(row.price) || 0,
    points_price: Number(row.points_price) || 0,
  };
}

function mimeFor(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function fetchAsset(env, request, pathname) {
  const url = new URL(pathname, new URL(request.url).origin);
  url.search = '';
  return env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
}

async function ensureSettings(env) {
  const setStmt = env.DB.prepare(
    'INSERT OR IGNORE INTO settings (setting_key, setting_value, id) VALUES (?, ?, ?)',
  );
  await env.DB.batch(DEFAULT_SETTINGS.map(([k, v]) => setStmt.bind(k, v, randomId())));
}

async function upsertProducts(env, products) {
  if (!Array.isArray(products) || products.length === 0) return;
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO products (id, name, description, price, points_price, category, image_url, in_stock, created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const batch = products
    .filter((p) => p && p.id && p.name)
    .map((p) =>
      stmt.bind(
        p.id,
        p.name,
        p.description || '',
        Number(p.price) || 0,
        Number(p.points_price) || 0,
        p.category || 'must_have',
        p.image_url || '',
        p.in_stock === false ? 0 : 1,
        p.created_date || nowIso(),
        p.updated_date || p.created_date || nowIso(),
      ),
    );
  for (let i = 0; i < batch.length; i += 50) {
    await env.DB.batch(batch.slice(i, i + 50));
  }
}

async function ensureCatalog(env, request) {
  await ensureSettings(env);
  const res = await fetchAsset(env, request, '/data/products.json');
  if (!res.ok) return;
  const text = await res.text();
  const hash = await sha256(text);
  const row = await env.DB.prepare('SELECT setting_value FROM settings WHERE setting_key = ?')
    .bind('catalog_hash')
    .first();
  if (row?.setting_value === hash) return;
  let products;
  try {
    products = JSON.parse(text);
  } catch {
    return;
  }
  await upsertProducts(env, products);
  const existing = await env.DB.prepare('SELECT setting_key FROM settings WHERE setting_key = ?')
    .bind('catalog_hash')
    .first();
  if (existing) {
    await env.DB.prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?')
      .bind(hash, 'catalog_hash')
      .run();
  } else {
    await env.DB.prepare('INSERT INTO settings (setting_key, setting_value, id) VALUES (?, ?, ?)')
      .bind('catalog_hash', hash, randomId())
      .run();
  }
}

async function requireAdmin(request, env) {
  const token = request.headers.get('X-Admin-Token') || '';
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(hash, nowIso())
    .first();
}

function fnStub(name) {
  if (name === 'listPendingTransactions') return { transactions: [] };
  if (name === 'listMemberships') return { memberships: [] };
  if (name === 'getLedger') return { entries: [] };
  if (name === 'getMyAccount') return { error: 'Customer accounts are not on Cloudflare yet' };
  if (name === 'loginCustomer' || name === 'registerCustomer') {
    return { error: 'Customer accounts are not on Cloudflare yet. Shop admin is at /admin-login.' };
  }
  return { error: 'This feature is not on Cloudflare yet' };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      },
    });
  }

  await ensureCatalog(env, request);

  if (path === '/api/health' && method === 'GET') {
    const products = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
    return json({ ok: true, products: Number(products?.n) || 0 });
  }

  if (path === '/api/products' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM products ORDER BY created_date DESC',
    ).all();
    return json((results || []).map(productFromRow));
  }

  if (path === '/api/products' && method === 'POST') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const id = body.id || randomId();
    const created = body.created_date || nowIso();
    await env.DB.prepare(
      `INSERT INTO products (id, name, description, price, points_price, category, image_url, in_stock, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.name || '',
        body.description || '',
        Number(body.price) || 0,
        Number(body.points_price) || 0,
        body.category || 'must_have',
        body.image_url || '',
        body.in_stock === false ? 0 : 1,
        created,
        nowIso(),
      )
      .run();
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    return json(productFromRow(row), 201);
  }

  const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === 'PUT') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const id = decodeURIComponent(productMatch[1]);
    const body = await readJson(request);
    const current = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'not found' }, 404);
    const next = { ...current, ...body, id, updated_date: nowIso() };
    await env.DB.prepare(
      `UPDATE products SET name=?, description=?, price=?, points_price=?, category=?, image_url=?, in_stock=?, updated_date=?
       WHERE id=?`,
    )
      .bind(
        next.name || '',
        next.description || '',
        Number(next.price) || 0,
        Number(next.points_price) || 0,
        next.category || 'must_have',
        next.image_url || '',
        next.in_stock === false || next.in_stock === 0 ? 0 : 1,
        next.updated_date,
        id,
      )
      .run();
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    return json(productFromRow(row));
  }

  if (productMatch && method === 'DELETE') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const id = decodeURIComponent(productMatch[1]);
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (path === '/api/settings' && method === 'GET') {
    const admin = await requireAdmin(request, env);
    const { results } = await env.DB.prepare('SELECT * FROM settings').all();
    const rows = (results || []).filter((row) => admin || row.setting_key !== 'admin_password');
    return json(rows);
  }

  if (path === '/api/settings' && method === 'POST') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const key = String(body.setting_key || '');
    if (!key || key === 'catalog_hash') return json({ error: 'setting_key required' }, 400);
    const existing = await env.DB.prepare('SELECT * FROM settings WHERE setting_key = ?').bind(key).first();
    if (existing) {
      await env.DB.prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?')
        .bind(String(body.setting_value ?? ''), key)
        .run();
      const row = await env.DB.prepare('SELECT * FROM settings WHERE setting_key = ?').bind(key).first();
      return json(row);
    }
    const id = randomId();
    await env.DB.prepare('INSERT INTO settings (setting_key, setting_value, id) VALUES (?, ?, ?)')
      .bind(key, String(body.setting_value ?? ''), id)
      .run();
    return json({ setting_key: key, setting_value: String(body.setting_value ?? ''), id }, 201);
  }

  if (path === '/api/slides' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, title, image_url, sort_order AS "order", created_date FROM slides ORDER BY sort_order ASC',
    ).all();
    return json(results || []);
  }

  if (path === '/api/slides' && method === 'POST') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const id = randomId();
    const order = Number(body.order) || 1;
    await env.DB.prepare(
      'INSERT INTO slides (id, title, image_url, sort_order, created_date) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, body.title || '', body.image_url || '', order, nowIso())
      .run();
    return json({ id, title: body.title || '', image_url: body.image_url || '', order }, 201);
  }

  const slideMatch = path.match(/^\/api\/slides\/([^/]+)$/);
  if (slideMatch && method === 'DELETE') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    await env.DB.prepare('DELETE FROM slides WHERE id = ?').bind(decodeURIComponent(slideMatch[1])).run();
    return json({ ok: true });
  }

  if (path === '/api/upload' && method === 'POST') {
    if (!(await requireAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'file required' }, 400);
    const original = file.name || 'upload.bin';
    const ext = original.includes('.') ? `.${original.split('.').pop().toLowerCase()}` : '';
    const filename = `${randomId().slice(0, 9)}_${Date.now()}${ext}`;
    const bytes = await file.arrayBuffer();
    if (env.IMAGES) {
      await env.IMAGES.put(filename, bytes);
    }
    if (env.PRODUCT_IMAGES) {
      await env.PRODUCT_IMAGES.put(`products/${filename}`, bytes, {
        httpMetadata: { contentType: file.type || MIME[ext] || 'application/octet-stream' },
      });
    }
    return json({ file_url: `/img/${filename}` });
  }

  if (path === '/api/fn/adminLogin' && method === 'POST') {
    const body = await readJson(request);
    const password = String(body.password || '').trim();
    const row = await env.DB.prepare('SELECT setting_value FROM settings WHERE setting_key = ?')
      .bind('admin_password')
      .first();
    const adminPass = String(row?.setting_value || '1234').trim();
    if (!password || password !== adminPass) {
      return json({ error: 'Incorrect password. If you just moved to Cloudflare, try 1234 then change it in Settings.' }, 401);
    }
    const token = randomToken();
    const id = randomId();
    await env.DB.prepare('INSERT INTO admin_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)')
      .bind(id, await sha256(token), addDaysIso(30))
      .run();
    return json({ success: true, admin_session_token: token, admin_session_id: id });
  }

  if (path.startsWith('/api/fn/') && method === 'POST') {
    const name = path.slice('/api/fn/'.length);
    const stub = fnStub(name);
    const status = stub.error ? 501 : 200;
    return json(stub, status);
  }

  return json({ error: 'not found' }, 404);
}

function imageResponse(body, contentType) {
  const headers = new Headers();
  headers.set('Content-Type', contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(body, { headers });
}

async function handleImage(request, env) {
  const filename = decodeURIComponent(new URL(request.url).pathname.replace(/^\/img\//, ''));
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new Response('Not found', { status: 404 });
  }

  if (env.IMAGES) {
    const data = await env.IMAGES.get(filename, { type: 'arrayBuffer' });
    if (data && data.byteLength > 0) {
      return imageResponse(data, mimeFor(filename));
    }
  }

  if (env.PRODUCT_IMAGES) {
    const object =
      (await env.PRODUCT_IMAGES.get(`products/${filename}`)) ||
      (await env.PRODUCT_IMAGES.get(filename));
    if (object) {
      const type = object.httpMetadata?.contentType || mimeFor(filename);
      return imageResponse(object.body, type);
    }
  }

  const asset = await fetchAsset(env, request, `/img/${filename}`);
  const type = asset.headers.get('content-type') || '';
  if (asset.ok && !type.includes('text/html')) {
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(asset.body, { status: 200, headers });
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        return json({ error: err.message || 'server error' }, 500);
      }
    }
    if (url.pathname.startsWith('/img/')) {
      return handleImage(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
