import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const IMAGE_DIR = join('public', 'img');
const CATALOG = join('public', 'data', 'products.json');
const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png']);
const MAX_EDGE = 1600;

function webpName(filename) {
  return `${basename(filename, extname(filename))}.webp`;
}

async function convertFile(name) {
  const ext = extname(name).toLowerCase();
  if (!SOURCE_EXT.has(ext)) return null;
  const source = join(IMAGE_DIR, name);
  const targetName = webpName(name);
  const target = join(IMAGE_DIR, targetName);
  const before = (await stat(source)).size;
  await sharp(source)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toFile(target);
  const after = (await stat(target)).size;
  if (target !== source) await unlink(source);
  return { name, targetName, before, after };
}

function rewriteUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  return url.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp$2');
}

async function rewriteCatalog() {
  let products;
  try {
    products = JSON.parse(await readFile(CATALOG, 'utf8'));
  } catch {
    return 0;
  }
  if (!Array.isArray(products)) return 0;
  let changed = 0;
  for (const product of products) {
    const next = rewriteUrl(product.image_url);
    if (next !== product.image_url) {
      product.image_url = next;
      changed += 1;
    }
  }
  if (changed) await writeFile(CATALOG, `${JSON.stringify(products, null, 2)}\n`);
  return changed;
}

async function main() {
  const names = await readdir(IMAGE_DIR);
  const results = [];
  for (const name of names) {
    const result = await convertFile(name);
    if (result) results.push(result);
  }
  const catalog = await rewriteCatalog();
  const before = results.reduce((sum, item) => sum + item.before, 0);
  const after = results.reduce((sum, item) => sum + item.after, 0);
  const saved = Math.max(0, before - after);
  console.log(
    `Converted ${results.length} images to WebP. Catalog paths updated: ${catalog}. ` +
    `Size ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB (saved ${Math.round(saved / 1024)} KB).`,
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
