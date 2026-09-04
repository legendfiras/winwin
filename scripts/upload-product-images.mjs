import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const BUCKET = 'winwin-product-images';
const PREFIX = 'products';
const CANDIDATE_DIRS = [
  join('assets', 'products'),
  join('New folder', 'downloaded_images'),
  'downloaded_images',
];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function findImageDir() {
  for (const dir of CANDIDATE_DIRS) {
    try {
      const info = await stat(dir);
      if (info.isDirectory()) return dir;
    } catch {
      // try next
    }
  }
  return null;
}

async function main() {
  const dir = await findImageDir();
  if (!dir) {
    console.error('No local image folder found. Put files in assets/products or New folder/downloaded_images');
    process.exit(1);
  }

  const files = (await readdir(dir)).filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()));
  if (files.length === 0) {
    console.error(`No images in ${dir}`);
    process.exit(1);
  }

  console.log(`Uploading ${files.length} images from ${dir} to r2://${BUCKET}/${PREFIX}/`);

  for (let i = 0; i < files.length; i++) {
    const name = files[i];
    const local = join(dir, name);
    const key = `${BUCKET}/${PREFIX}/${name}`;
    const contentType = MIME[extname(name).toLowerCase()] || 'application/octet-stream';
    console.log(`[${i + 1}/${files.length}] ${name}`);
    await run('npx', [
      'wrangler',
      'r2',
      'object',
      'put',
      key,
      '--file',
      local,
      '--content-type',
      contentType,
      '--remote',
    ]);
  }

  console.log('Done. Product images are on R2. The site serves them at /img/<filename>.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
