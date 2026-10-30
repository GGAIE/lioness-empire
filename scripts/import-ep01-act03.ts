import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { AssetSchema, ChapterFileSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp01Act02 } from './ep01-act02-parser';
import { act03CompletionFlags, parseEp01Act03 } from './ep01-act03-parser';
const sourcePath = 'content/sources/ep01/source-act03-v0.3.md';
const source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp01Act03(source.toString('utf8'));
const chapter = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
const act02 = parseEp01Act02(
  await readFile(resolve(root, 'content/sources/ep01/source-act02-v0.2.md'), 'utf8')
).scenes;
chapter.scenes = [
  ...chapter.scenes.filter((s) => s.act === 'ACT01'),
  ...act02,
  ...scenes,
  ...chapter.scenes.filter((s) => !['ACT01', 'ACT02', 'ACT03'].includes(s.act)),
];
chapter.version = '0.5.0';
chapter.source =
  '使用者提供ACT I–III及原圖；保留DRAFT。第三幕純對話選項不影響數值、路線或後續順序。';
ChapterFileSchema.parse(chapter);
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[];
const images = [];
for (const scene of scenes)
  for (const segment of scene.segments.filter((s) => s.cg)) {
    const id = segment.cg!,
      match = id.match(/CG(\d{2})-(\d{2})$/)!;
    const path = `assets/cg/ep01/act03/LE_EP01_ACT03_SC${match[1]}_CG${match[2]}_v0.3.png`;
    const bytes = await readFile(resolve(root, path));
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
      throw Error(`Invalid PNG ${id}`);
    const entry = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source: '使用者提供LE_EP01_ACT03_20CG_v0.3.zip；保留原始PNG，未改圖。',
    });
    const index = assets.findIndex((a) => a.id === id);
    if (index < 0) assets.push(entry);
    else assets[index] = entry;
    images.push({
      id,
      path,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
if (images.length !== 20 || new Set(images.map((i) => i.id)).size !== 20)
  throw Error('Expected twenty unique CGs');
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) if (!characters[id]) characters[id] = name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
manifest.version = '0.5.0-ep01-act03-v0.3';
for (const key of Object.keys(act03CompletionFlags))
  manifest.flags[key] ??= {
    initial: false,
    description: `ACT III幕末事實紀錄：${key}；不代表數值獎勵或攝政授權。`,
  };
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP01')!,
  { title: '王冠之前 · ACT I–III', status: 'DRAFT_AVAILABLE' }
);
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep01/chapter.json', chapter);
await write('content/manifests/assets.json', assets);
await write('content/manifests/story.json', manifest);
await write('content/characters/index.json', characters);
await write('docs/ep01-act03-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  sourceScenes: 5,
  playbackNodes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choicePoints: 3,
  options: 9,
  choiceEffects: 'NONE',
  completionFlags: act03CompletionFlags,
  images,
  notes: [
    'CG依正文行內標記切換，三組回答共用各場第三張CG並匯回第四張CG',
    '前幕優先工作方向保留，但本稿未提供額外提醒或調序正文，不臆造相關文字及優勢',
    '只記錄對話選擇供存讀及重讀；不新增政治、動盪、CLEAR、路線或後續事件效果',
    '正文幕尾六個事實旗標於最後字幕讀完時設定；王女沒有攝政授權',
    '原稿標示提示詞待生成，但本輪已另附二十張PNG，依使用者要求使用原圖',
    '幕末接ACT IV〈有限的責任〉暫名，尚未交付；不結算整章；未提供新音訊',
  ],
});
console.log(
  `Imported 5 source scenes / ${scenes.length} playback nodes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs across all branches / 20 CG / 3 choices, zero numerical effects.`
);
