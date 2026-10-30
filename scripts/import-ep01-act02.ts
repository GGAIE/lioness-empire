import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { AssetSchema, ChapterFileSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp01Act01 } from './ep01-act01-parser';
import { ACT02_PRIORITY, parseEp01Act02 } from './ep01-act02-parser';
const sourcePath = 'content/sources/ep01/source-act02-v0.2.md';
const source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp01Act02(source.toString('utf8'));
const chapter = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
// Rebuild ACT I from its own source to keep its final continuation reproducible.
const act01 = parseEp01Act01(
  await readFile(resolve(root, 'content/sources/ep01/source-act01-v0.3.md'), 'utf8')
).scenes;
chapter.scenes = [
  ...act01,
  ...scenes,
  ...chapter.scenes.filter((s) => !['ACT01', 'ACT02'].includes(s.act)),
];
const hasLaterActs = chapter.scenes.some((s) => !['ACT01', 'ACT02'].includes(s.act));
if (!hasLaterActs) {
  chapter.version = '0.4.0';
  chapter.source =
    '使用者提供 ACT I v0.3 與 ACT II v0.2 正文及原圖，保留草稿；第二幕三選一，未自行新增資源變化。';
}
ChapterFileSchema.parse(chapter);
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[];
const images = [];
for (const scene of scenes) {
  for (const segment of scene.segments.filter((s) => s.cg)) {
    const id = segment.cg!;
    const match = id.match(/CG(\d{2})-(\d{2})$/)!;
    const path = `assets/cg/ep01/act02/LE_CG_EP01_ACT02_SC${match[1]}_${match[2]}_v0.2.png`;
    const bytes = await readFile(resolve(root, path));
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
      throw Error(`Invalid PNG ${id}`);
    const entry = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source: '使用者提供 LE_EP01_ACT02_20CG_v0.2.zip；原圖位元組不變。',
    });
    const existing = assets.findIndex((a) => a.id === id);
    if (existing < 0) assets.push(entry);
    else assets[existing] = entry;
    images.push({
      id,
      path,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
}
if (images.length !== 20 || new Set(images.map((i) => i.id)).size !== 20)
  throw Error('Expected twenty unique CGs');
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) if (!characters[id]) characters[id] = name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
if (!hasLaterActs) manifest.version = '0.4.0-ep01-act02-v0.2';
manifest.flags[ACT02_PRIORITY] = {
  initial: 'NONE',
  description:
    'EP01第二幕返都工作優先順序：ROYAL_AUTHORITY／EASTERN_FRONT／TECHNICAL_INTERFACE；僅記錄方向，未設定資源增減。',
};
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP01')!,
  {
    title: hasLaterActs
      ? manifest.chapters.find((c) => c.id === 'EP01')!.title
      : '王冠之前 · ACT I–II',
    status: 'DRAFT_AVAILABLE',
  }
);
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep01/chapter.json', chapter);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('content/manifests/story.json', manifest);
await write('docs/ep01-act02-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  sourceScenes: 5,
  playbackNodes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choicePoints: 1,
  options: 3,
  images,
  cgCues: scenes.flatMap(
    (s) =>
      s.directions?.map((d) => ({
        sceneId: s.id,
        ...d,
        paragraph: s.segments[d.beforeSegment]?.text,
      })) ?? []
  ),
  notes: [
    '正文原樣保留；原稿分支僅播放所選的一段，再匯流',
    'CG插入清單未含行內標記，依列出的事件配對正文錨點，報告保留對照',
    '原稿未定義政治點數／動盪數值效果：保持既有資源，只記錄優先順序旗標',
    '芬利本幕以研究夥伴登場不解鎖EP04正式支線事件、不加CLEAR、不提早揭露秘密',
    '僅幕末待續，不結算整章；ACT III未提供；無新增音訊',
  ],
});
console.log(
  `Imported 5 source scenes / ${scenes.length} playback nodes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs across all branches / 20 CG / 1 choice with 3 options.`
);
