import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const CSV_PATH = 'Product_export.csv';
const OUT_PATH = join('public', 'data', 'products.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      row.push(field);
      field = '';
      if (row.some((x) => x.length)) rows.push(row);
      row = [];
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((x) => x.length)) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function filenameFromUrl(url) {
  if (!url) return '';
  try {
    const name = new URL(url, 'https://local.invalid').pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(name);
  } catch {
    return String(url).split('/').pop() || '';
  }
}

function localImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/img/')) return url;
  const name = filenameFromUrl(url);
  return name ? `/img/${name}` : '';
}

async function main() {
  try {
    await access(CSV_PATH);
  } catch {
    try {
      await access(OUT_PATH);
      console.log(`No ${CSV_PATH}; keeping existing ${OUT_PATH}`);
      return;
    } catch {
      console.warn(`No ${CSV_PATH} and no ${OUT_PATH}; product catalog will be empty until admin adds items.`);
      await mkdir(dirname(OUT_PATH), { recursive: true });
      await writeFile(OUT_PATH, '[]\n');
      return;
    }
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    throw new Error(`${CSV_PATH} has no product rows`);
  }
  const headers = rows[0].map((h) => h.trim());
  const products = rows.slice(1).map((cols) => {
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price) || 0,
      points_price: Number(row.points_price) || 0,
      category: row.category || 'must_have',
      image_url: localImageUrl(row.image_url),
      in_stock: String(row.in_stock).toLowerCase() !== 'false',
      created_date: row.created_date || new Date().toISOString(),
      updated_date: row.updated_date || row.created_date || new Date().toISOString(),
    };
  }).filter((p) => p.id && p.name);

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(products, null, 2)}\n`);
  console.log(`Wrote ${products.length} products to ${OUT_PATH} with Cloudflare /img/ paths.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
