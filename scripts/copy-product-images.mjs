import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DEST = join('public', 'img');
const CANDIDATE_DIRS = [
  join('assets', 'products'),
  join('New folder', 'downloaded_images'),
  'downloaded_images',
];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

async function listImages(dir) {
  const names = await readdir(dir);
  return names.filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()));
}

async function findImageDir() {
  for (const dir of CANDIDATE_DIRS) {
    try {
      const info = await stat(dir);
      if (!info.isDirectory()) continue;
      const files = await listImages(dir);
      if (files.length > 0) return { dir, files };
    } catch {
      // try next
    }
  }
  return null;
}

async function main() {
  const found = await findImageDir();
  if (!found) {
    const existing = await listImages(DEST).catch(() => []);
    if (existing.length > 0) {
      console.log(`Using ${existing.length} images already in ${DEST}`);
      return;
    }
    console.warn('No local product images found; /img will be empty in this build.');
    return;
  }

  await mkdir(DEST, { recursive: true });
  const { dir, files } = found;
  console.log(`Copying ${files.length} images from ${dir} to ${DEST}`);
  await Promise.all(files.map((name) => cp(join(dir, name), join(DEST, name))));
  console.log('Product images are ready at /img/<filename>.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
