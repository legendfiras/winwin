import { readFile, writeFile } from 'node:fs/promises';

const SITE_URL = 'https://winwinleb.com';
const PRODUCTS_PATH = 'public/data/products.json';
const SITEMAP_PATH = 'public/sitemap.xml';

const staticPages = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/winwin-card', changefreq: 'monthly', priority: '0.8' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-and-conditions', changefreq: 'yearly', priority: '0.3' },
  { path: '/shipping-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/returns-and-refunds', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function urlEntry({ path, lastmod, changefreq, priority }) {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

async function main() {
  const products = JSON.parse(await readFile(PRODUCTS_PATH, 'utf8'));
  const productPages = products
    .filter((product) => product?.id)
    .map((product) => ({
      path: `/product/${encodeURIComponent(product.id)}`,
      lastmod: validDate(product.updated_date || product.created_date),
      changefreq: 'weekly',
      priority: product.in_stock === false ? '0.4' : '0.7',
    }));

  const entries = [...staticPages, ...productPages].map(urlEntry).join('\n');
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(SITEMAP_PATH, sitemap, 'utf8');
  console.log(`Wrote ${staticPages.length + productPages.length} URLs to ${SITEMAP_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
