import { spawn } from 'node:child_process';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const NAMESPACE_ID = '2224090d2ada49b290b846af15271c92';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const CANDIDATE_DIRS = [
  join('public', 'img'),
  join('assets', 'products'),
  join('New folder', 'downloaded_images'),
  'downloaded_images',
];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function findImages() {
  const found = new Map();
  for (const dir of CANDIDATE_DIRS) {
    try {
      const info = await stat(dir);
      if (!info.isDirectory()) continue;
      const names = await readdir(dir);
      for (const name of names) {
        if (!IMAGE_EXT.has(extname(name).toLowerCase())) continue;
        if (!found.has(name)) found.set(name, join(dir, name));
      }
    } catch {
      // try next
    }
  }
  return found;
}

async function main() {
  const files = await findImages();
  if (files.size === 0) {
    throw new Error('No product images found to upload');
  }
  console.log(`Uploading ${files.size} images to Cloudflare KV IMAGES`);

  const entries = [];
  for (const [name, filePath] of files) {
    const buf = await readFile(filePath);
    entries.push({ key: name, value: buf.toString('base64'), base64: true });
  }

  const batches = [];
  let current = [];
  let bytes = 0;
  for (const entry of entries) {
    const size = entry.value.length;
    if (current.length && bytes + size > 8_000_000) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(entry);
    bytes += size;
  }
  if (current.length) batches.push(current);

  const dir = join(tmpdir(), 'winwin-kv');
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < batches.length; i++) {
    const file = join(dir, `batch-${i}.json`);
    await writeFile(file, JSON.stringify(batches[i]));
    console.log(`KV batch ${i + 1}/${batches.length} (${batches[i].length} files)`);
    await run('npx', [
      'wrangler',
      'kv',
      'bulk',
      'put',
      file,
      '--namespace-id',
      NAMESPACE_ID,
      '--remote',
    ]);
  }
  console.log('Product photos are on Cloudflare KV and will be served at /img/<filename>.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
