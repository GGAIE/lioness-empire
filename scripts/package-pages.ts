import { mkdir, readFile, writeFile, copyFile, stat, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { root } from './load-content';
import covers from '../content/covers/library.json' with { type: 'json' };

const output = resolve(root, 'github-pages');
await stat(resolve(output, 'index.html')); // Vite must build the compiled entry first.
const manifest = JSON.parse(
  await readFile(resolve(root, 'apps/web-vn/public/content/manifests/story.json'), 'utf8')
);
const assets = JSON.parse(
  await readFile(resolve(root, 'content/manifests/assets.json'), 'utf8')
) as { id: string; src: string }[];
const webPath = (path: string) => path.replace(/\.(png|jpe?g)$/i, '.webp');
const runtimeFiles = new Set<string>([
  'manifests/story.json',
  'manifests/assets.json',
  'characters/index.json',
  'endings/rules.json',
  ...manifest.chapters.flatMap((c: { file?: string }) => (c.file ? [c.file] : [])),
  ...(manifest.planningFile ? [manifest.planningFile] : []),
]);
for (const path of runtimeFiles) {
  const source = resolve(root, 'apps/web-vn/public/content', path);
  const target = resolve(output, 'content', path);
  await mkdir(dirname(target), { recursive: true });
  if (path === 'manifests/assets.json')
    await writeFile(
      target,
      JSON.stringify(
        assets.map((a) => ({ ...a, src: webPath(a.src) })),
        null,
        2
      ) + '\n'
    );
  else await copyFile(source, target);
}
const paths = [
  ...new Set([...assets.map((a) => a.src), ...covers.flatMap((c) => [c.desktop, c.mobile])]),
];
const audit: {
  source: string;
  output: string;
  originalBytes: number;
  bytes: number;
  sourceSha256: string;
  sha256: string;
  width?: number;
  height?: number;
}[] = [];
let cursor = 0,
  done = 0;
sharp.concurrency(1);
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < paths.length) {
      const path = paths[cursor++];
      if (!/^assets\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..'))
        throw Error('Unsafe asset path');
      const source = resolve(root, path),
        dest = resolve(output, webPath(path));
      const original = await readFile(source);
      await mkdir(dirname(dest), { recursive: true });
      let width: number | undefined, height: number | undefined;
      if (/\.(png|jpe?g)$/i.test(path)) {
        const info = await sharp(original).metadata();
        width = info.width;
        height = info.height;
        // A separate web delivery encoding; original art and the original-image dist stay untouched.
        await sharp(original).keepIccProfile().webp({ quality: 95, effort: 4 }).toFile(dest);
        const result = await sharp(dest).metadata();
        if (result.width !== width || result.height !== height)
          throw Error('Changed image dimensions');
      } else await copyFile(source, dest);
      const bytes = await readFile(dest);
      audit.push({
        source: path,
        output: webPath(path),
        originalBytes: original.length,
        bytes: bytes.length,
        sourceSha256: createHash('sha256').update(original).digest('hex'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
        width,
        height,
      });
      if (++done % 50 === 0) console.log(`Web assets ${done}/${paths.length}`);
    }
  })
);
await writeFile(resolve(output, '.nojekyll'), '');
const walk = async (path: string): Promise<string[]> => {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? walk(resolve(path, e.name)) : [resolve(path, e.name)]))
    )
  ).flat();
};
const files = await walk(output);
const totalBytes = (await Promise.all(files.map((p) => stat(p)))).reduce((n, s) => n + s.size, 0);
if (totalBytes >= 1_000_000_000) throw Error('GitHub Pages output exceeds 1 GB');
const report = {
  contentVersion: manifest.version,
  mode: 'pages',
  quality: 95,
  resizing: false,
  totalBytes,
  files: files.length,
  assets: audit.sort((a, b) => a.source.localeCompare(b.source)),
};
await writeFile(
  resolve(root, 'docs/github-pages-package-report.json'),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(
  `GitHub Pages ready: ${files.length} files, ${(totalBytes / 1_000_000).toFixed(1)} MB; entry github-pages/index.html`
);
