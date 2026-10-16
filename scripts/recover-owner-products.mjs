// Rebuild the owner's product catalog after a deploy overwrote it with the repo copy.
//
// Usage:
//   node scripts/recover-owner-products.mjs <before.sql> <now.sql> <cutoff-iso> [out.sql]
//
//   before.sql  products table exported from D1 at a time before the bad deploy
//   now.sql     products table exported from D1 as it is now
//   cutoff-iso  when the bad deploy went live, e.g. 2026-10-15T00:30:00Z
//
// It only writes a SQL file and a report; nothing touches Cloudflare until you run
//   npx wrangler d1 execute winwin --remote --file <out.sql>
//
// Rules, per product:
//   - changed by the admin after the cutoff (updated_date later)  -> keep today's row
//   - created by the admin after the cutoff                        -> keep today's row
//   - present before, missing now (owner deleted it after cutoff)  -> stays deleted
//   - missing before, present now, created before the cutoff       -> the repo brought
//     back a product the owner had deleted                         -> delete it
//   - otherwise                                                     -> restore the
//     owner's pre-deploy row (his photos, names, prices, stock)
import { readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const [beforePath, nowPath, cutoffArg, outPath = 'recover-products.sql'] = process.argv.slice(2);

function usage(message) {
  console.error(message);
  console.error('Usage: node scripts/recover-owner-products.mjs <before.sql> <now.sql> <cutoff-iso> [out.sql]');
  process.exit(1);
}

if (!beforePath || !nowPath || !cutoffArg) usage('Missing arguments.');
const cutoff = Date.parse(cutoffArg);
if (!Number.isFinite(cutoff)) usage(`Cutoff "${cutoffArg}" is not a date.`);

async function loadProducts(path) {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(path, 'utf8'));
  const rows = db.prepare('SELECT * FROM products').all();
  const columns = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  db.close();
  return { rows: new Map(rows.map((r) => [r.id, r])), columns };
}

function after(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) && t > cutoff;
}

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sameRow(a, b, columns) {
  return columns.every((c) => String(a[c] ?? '') === String(b[c] ?? ''));
}

const before = await loadProducts(beforePath);
const now = await loadProducts(nowPath);
const columns = before.columns.filter((c) => now.columns.includes(c) && c !== 'id');

const sql = [];
const report = { restored: [], keptNewer: [], keptNew: [], removedResurrected: [], stayDeleted: [] };

for (const [id, old] of before.rows) {
  const cur = now.rows.get(id);
  if (!cur) {
    report.stayDeleted.push(old.name);
    continue;
  }
  if (after(cur.updated_date)) {
    report.keptNewer.push(cur.name);
    continue;
  }
  if (sameRow(old, cur, columns)) continue;
  const sets = columns.map((c) => `${c} = ${literal(old[c])}`).join(', ');
  sql.push(`UPDATE products SET ${sets} WHERE id = ${literal(id)};`);
  report.restored.push(old.name);
}

for (const [id, cur] of now.rows) {
  if (before.rows.has(id)) continue;
  if (after(cur.created_date) || after(cur.updated_date)) {
    report.keptNew.push(cur.name);
    continue;
  }
  sql.push(`DELETE FROM products WHERE id = ${literal(id)};`);
  report.removedResurrected.push(cur.name);
}

await writeFile(outPath, `${sql.join('\n')}\n`);

const show = (label, list) => {
  console.log(`\n${label}: ${list.length}`);
  for (const name of list) console.log(`  - ${name}`);
};
show('Restored to the owner\'s version (photo, name, price, stock)', report.restored);
show('Deleted again (the repo had brought back products the owner removed)', report.removedResurrected);
show('Kept as they are now (owner edited them after the deploy)', report.keptNewer);
show('Kept as they are now (owner added them after the deploy)', report.keptNew);
show('Left deleted (owner removed them after the deploy)', report.stayDeleted);
console.log(`\nWrote ${sql.length} statements to ${outPath}. Review it, then apply with:`);
console.log(`  npx wrangler d1 execute winwin --remote --file ${outPath}`);
