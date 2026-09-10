import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CATEGORY_ALIASES,
  PRODUCT_CATEGORY_OVERRIDES,
  resolveProductCategory,
} from '../src/lib/categories.js';

const OUT_PATH = join('public', 'data', 'products.json');

async function main() {
  const raw = JSON.parse(await readFile(OUT_PATH, 'utf8'));
  if (!Array.isArray(raw)) throw new Error(`${OUT_PATH} is not an array`);

  const before = raw.length;
  const moved = [];
  const products = raw.map((product) => {
    const nextCategory = resolveProductCategory(product);
    if (nextCategory !== product.category) {
      moved.push({
        id: product.id,
        name: product.name,
        from: product.category,
        to: nextCategory,
      });
    }
    return { ...product, category: nextCategory };
  });

  if (products.length !== before) {
    throw new Error('Refusing to write: product count changed during category normalization');
  }

  await writeFile(OUT_PATH, `${JSON.stringify(products, null, 2)}\n`);

  const counts = {};
  for (const product of products) {
    counts[product.category] = (counts[product.category] || 0) + 1;
  }

  console.log(`Normalized ${products.length} products in ${OUT_PATH}`);
  console.log('Aliases:', CATEGORY_ALIASES);
  console.log('Id overrides:', PRODUCT_CATEGORY_OVERRIDES);
  console.log(`Reassigned: ${moved.length}`);
  for (const row of moved) {
    console.log(`  ${row.id}  ${JSON.stringify(row.from)} → ${row.to}  (${row.name})`);
  }
  console.log('Canonical counts:', counts);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
