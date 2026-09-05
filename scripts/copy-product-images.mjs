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

async function main() {
  await mkdir(DEST, { recursive: true });
  let copied = 0;
  for (const dir of CANDIDATE_DIRS) {
    let files = [];
    try {
      const info = await stat(dir);
      if (!info.isDirectory()) continue;
      files = await listImages(dir);
    } catch {
      continue;
    }
    if (files.length === 0) continue;
    console.log(`Copying ${files.length} images from ${dir} to ${DEST}`);
    await Promise.all(files.map((name) => cp(join(dir, name), join(DEST, name))));
    copied += files.length;
  }
  const existing = await listImages(DEST).catch(() => []);
  if (existing.length === 0) {
    console.warn('No local product images found; /img will be empty in this build.');
    return;
  }
  console.log(`${existing.length} product images are ready at /img/<filename> (${copied} copied this run).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
