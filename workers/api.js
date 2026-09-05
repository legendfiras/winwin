import { ensureCustomerSchema, handleCustomerFn, customerFromToken, saveCheckoutAddress } from './customers.js';

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

async function ensureTransactions(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS store_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_email TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      type TEXT NOT NULL DEFAULT 'PRODUCT_PURCHASE',
      status TEXT NOT NULL DEFAULT 'PENDING',
      amount_usd REAL NOT NULL DEFAULT 0,
      discount_usd REAL NOT NULL DEFAULT 0,
      items_json TEXT,
      product_ids TEXT,
      product_summary TEXT,
      calculated_points INTEGER NOT NULL DEFAULT 0,
      submitted_by TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      reject_reason TEXT,
      ambassador_code TEXT,
      member_price_requested INTEGER NOT NULL DEFAULT 0,
      created_date TEXT,
      delivery_json TEXT
    )`,
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_store_transactions_status ON store_transactions (status, created_date)',
  ).run();
  try {
    await env.DB.prepare('ALTER TABLE store_transactions ADD COLUMN delivery_json TEXT').run();
  } catch {
    /* column already exists */
  }
}

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function pointsForPurchaseUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 15) return 0;
  if (n <= 20) return 20;
  if (n <= 40) return 35;
  if (n <= 60) return 50;
  if (n <= 100) return 75;
  return 100;
}

function orderDisplayId(id) {
  return `WW-${String(id || '').slice(0, 8).toUpperCase()}`;
}

function txFromRow(row) {
  if (!row) return null;
  let items = [];
  try {
    items = JSON.parse(row.items_json || '[]');
  } catch {
    items = [];
  }
  let delivery = null;
  try {
    delivery = row.delivery_json ? JSON.parse(row.delivery_json) : null;
  } catch {
    delivery = null;
  }
  return {
    ...row,
    amount_usd: Number(row.amount_usd) || 0,
    discount_usd: Number(row.discount_usd) || 0,
    calculated_points: Number(row.calculated_points) || 0,
    member_price_requested: Boolean(row.member_price_requested),
    items,
    delivery,
    display_id: orderDisplayId(row.id),
  };
}

async function requireAdminFn(env, body, request) {
  const token = String(body?.admin_session_token || request.headers.get('X-Admin-Token') || '');
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(hash, nowIso())
    .first();
}

async function submitCheckout(env, body) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return json({ error: 'Your cart is empty' }, 400);
  if (rawItems.length > 30) return json({ error: 'Too many items in this order' }, 400);

  const customer_name = String(body.customer_name || '').trim();
  const customer_phone = String(body.customer_phone || '').replace(/[^\d+]/g, '').trim();
  const customer_email = String(body.customer_email || '').trim();
  if (customer_name.length < 2) return json({ error: 'Please enter your name' }, 400);
  if (customer_phone.replace(/\D/g, '').length < 8) {
    return json({ error: 'Please enter a valid phone number' }, 400);
  }

  const address = body.address && typeof body.address === 'object' ? body.address : {};
  const governorate = String(address.governorate || body.governorate || '').trim();
  const street = String(address.street || body.street || '').trim();
  if (!governorate || !street) {
    return json({ error: 'Please enter your delivery area and street' }, 400);
  }

  const sessionCustomer = await customerFromToken(env, body.session_token);
  const customerId = sessionCustomer?.id || '';

  const delivery = {
    full_name: customer_name,
    phone: customer_phone,
    governorate,
    area: String(address.area || body.area || '').trim(),
    street,
    building: String(address.building || body.building || '').trim(),
    floor: String(address.floor || body.floor || '').trim(),
    instructions: String(address.instructions || body.instructions || '').trim(),
  };

  const qtyById = new Map();
  for (const item of rawItems) {
    const id = String(item?.id || '');
    const qty = Math.max(0, Math.min(20, Math.floor(Number(item?.qty) || 0)));
    if (!id || qty < 1) continue;
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
  }
  const ids = [...qtyById.keys()];
  if (ids.length === 0) return json({ error: 'Your cart is empty' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all();
  const products = new Map((results || []).map((row) => [row.id, productFromRow(row)]));

  const lines = [];
  let subtotal = 0;
  for (const id of ids) {
    const product = products.get(id);
    const qty = qtyById.get(id);
    if (!product) return json({ error: 'A product in your cart is no longer available' }, 400);
    if (product.in_stock === false) return json({ error: `${product.name} is out of stock` }, 400);
    const unit = Number(product.price) || 0;
    const line = roundMoney(unit * qty);
    subtotal = roundMoney(subtotal + line);
    lines.push({
      id: product.id,
      name: product.name,
      qty,
      unit_price: unit,
      price: unit,
      line_total: line,
    });
  }

  const id = randomId();
  const summary = lines.map((line) => `${line.qty}× ${line.name}`).join(', ');
  await env.DB.prepare(
    `INSERT INTO store_transactions (
      id, customer_id, customer_email, customer_name, customer_phone, type, status,
      amount_usd, discount_usd, items_json, product_ids, product_summary, calculated_points,
      submitted_by, ambassador_code, member_price_requested, created_date, delivery_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      customerId,
      customer_email,
      customer_name,
      customer_phone,
      'PRODUCT_PURCHASE',
      'PENDING',
      subtotal,
      0,
      JSON.stringify(lines),
      JSON.stringify(ids),
      summary,
      pointsForPurchaseUsd(subtotal),
      'CUSTOMER',
      String(body.ambassador_code || '').trim(),
      body.member_price_requested ? 1 : 0,
      nowIso(),
      JSON.stringify(delivery),
    )
    .run();

  if (body.save_address && customerId) {
    await saveCheckoutAddress(env, customerId, { ...delivery, id: address.id, label: address.label }, true);
  }

  const row = await env.DB.prepare('SELECT * FROM store_transactions WHERE id = ?').bind(id).first();
  return json({ success: true, transaction: txFromRow(row) }, 201);
}

async function listPendingTransactions(env, body) {
  const status = body.status ? String(body.status) : '';
  let rows = [];
  if (!status || status === 'ALL') {
    const result = await env.DB.prepare(
      'SELECT * FROM store_transactions ORDER BY created_date DESC LIMIT 300',
    ).all();
    rows = result.results || [];
  } else if (status === 'PENDING') {
    const result = await env.DB.prepare(
      `SELECT * FROM store_transactions
       WHERE status IN ('PENDING', 'PROCESSING')
       ORDER BY created_date DESC LIMIT 300`,
    ).all();
    rows = result.results || [];
  } else {
    const result = await env.DB.prepare(
      'SELECT * FROM store_transactions WHERE status = ? ORDER BY created_date DESC LIMIT 300',
    )
      .bind(status)
      .all();
    rows = result.results || [];
  }
  return json({ success: true, transactions: rows.map(txFromRow) });
}

async function approveTransaction(env, body, admin) {
  const txId = String(body.transaction_id || '');
  if (!txId) return json({ error: 'Missing transaction_id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM store_transactions WHERE id = ?').bind(txId).first();
  if (!row) return json({ error: 'Transaction not found' }, 404);
  if (row.status === 'REJECTED') {
    return json({ error: 'Rejected transactions cannot be approved' }, 409);
  }
  if (row.status === 'APPROVED') {
    return json({ success: true, already_approved: true, transaction: txFromRow(row) });
  }
  await env.DB.prepare(
    'UPDATE store_transactions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
  )
    .bind('APPROVED', admin.id, nowIso(), txId)
    .run();
  const updated = await env.DB.prepare('SELECT * FROM store_transactions WHERE id = ?').bind(txId).first();
  return json({ success: true, already_approved: false, transaction: txFromRow(updated) });
}

async function rejectTransaction(env, body, admin) {
  const txId = String(body.transaction_id || '');
  if (!txId) return json({ error: 'Missing transaction_id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM store_transactions WHERE id = ?').bind(txId).first();
  if (!row) return json({ error: 'Transaction not found' }, 404);
  if (row.status === 'APPROVED') {
    return json({ error: 'Approved transactions cannot be rejected' }, 409);
  }
  if (row.status === 'REJECTED') {
    return json({ success: true, already_rejected: true, transaction: txFromRow(row) });
  }
  await env.DB.prepare(
    'UPDATE store_transactions SET status = ?, reviewed_by = ?, reviewed_at = ?, reject_reason = ? WHERE id = ?',
  )
    .bind('REJECTED', admin.id, nowIso(), String(body.reject_reason || '').trim(), txId)
    .run();
  const updated = await env.DB.prepare('SELECT * FROM store_transactions WHERE id = ?').bind(txId).first();
  return json({ success: true, transaction: txFromRow(updated) });
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
  await ensureTransactions(env);
  await ensureCustomerSchema(env);
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
    const body = await readJson(request);

    if (name === 'submitCheckout') {
      return submitCheckout(env, body);
    }
    if (name === 'listPendingTransactions') {
      const admin = await requireAdminFn(env, body, request);
      if (!admin) return json({ error: 'unauthorized' }, 401);
      return listPendingTransactions(env, body);
    }
    if (name === 'approveTransaction') {
      const admin = await requireAdminFn(env, body, request);
      if (!admin) return json({ error: 'unauthorized' }, 401);
      return approveTransaction(env, body, admin);
    }
    if (name === 'rejectTransaction') {
      const admin = await requireAdminFn(env, body, request);
      if (!admin) return json({ error: 'unauthorized' }, 401);
      return rejectTransaction(env, body, admin);
    }

    const customerRes = await handleCustomerFn(env, name, body, request);
    if (customerRes) return customerRes;

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
