import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { ChapterFileSchema, AssetSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parsePrologue } from './prologue-parser';
const source = await readFile(resolve(root, 'content/sources/prologue/source-v0.6.md'));
const { scenes, roles } = parsePrologue(source.toString('utf8'));
const pack = ChapterFileSchema.parse({
  schemaVersion: 1,
  id: 'PROLOGUE',
  version: '0.6.0',
  status: 'DRAFT',
  source: '使用者提供序幕 v0.6；原稿 DRAFT 標記保留，依本輪要求接入試演。',
  scenes,
});
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[];
const imageReport = [];
for (let i = 1; i <= 8; i++) {
  const id = `PRO-CG${String(i).padStart(2, '0')}`,
    path = `assets/cg/prologue/${id}_v1.png`,
    bytes = await readFile(resolve(root, path));
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error(`Invalid PNG ${id}`);
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (Math.abs(width / height - 16 / 9) > 0.01) throw Error(`Expected widescreen CG: ${id}`);
  const entry = AssetSchema.parse({
    id,
    type: 'cg',
    src: path,
    label: `${id} · ${scenes[i - 1].title}`,
    status: 'APPROVED',
    source: '使用者提供 Prologue_SC01-SC08_md_v0.6_CG_v1.zip；原圖直接使用，未改圖。',
  });
  const index = assets.findIndex((a) => a.id === id);
  if (index < 0) assets.push(entry);
  else assets[index] = entry;
  imageReport.push({
    id,
    path,
    width,
    height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) if (!characters[id]) characters[id] = name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
manifest.version = manifest.chapters.find((c) => c.id === 'EP01')?.entry
  ? manifest.version
  : '0.2.0-prologue-v0.6';
manifest.start = 'PRO-SC01';
const chapter = manifest.chapters.find((c) => c.id === 'PROLOGUE')!;
Object.assign(chapter, {
  title: '母獅登基',
  status: 'DRAFT_AVAILABLE',
  file: 'episodes/prologue/chapter.json',
  entry: 'PRO-SC01',
});
await mkdir(resolve(root, 'content/episodes/prologue'), { recursive: true });
const write = async (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/prologue/chapter.json', pack);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('content/manifests/story.json', manifest);
await write('docs/prologue-import-report.json', {
  source: 'content/sources/prologue/source-v0.6.md',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  scenes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choices: 0,
  scoring: 'NONE',
  images: imageReport,
  notes: [
    '圖片逐一核對 SC01–SC08，保留原始位元組',
    '英語 CG 提示詞及製作註記不當成對白',
    '未提供配樂與音效檔；音效指示保留為製作註記',
    '結尾銜接已提供的 EP01 第一幕；不自動生成未提供內容',
  ],
});
console.log(
  `Imported ${scenes.length} scenes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs / 8 CG / 0 choices.`
);
