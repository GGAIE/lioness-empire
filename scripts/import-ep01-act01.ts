import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { AssetSchema, ChapterFileSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp01Act01 } from './ep01-act01-parser';
const sourcePath = 'content/sources/ep01/source-act01-v0.3.md';
const source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp01Act01(source.toString('utf8'));
const existingChapter = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
const laterScenes = existingChapter.scenes.filter((s) => s.act !== 'ACT01');
const pack = ChapterFileSchema.parse({
  schemaVersion: 1,
  id: 'EP01',
  version: laterScenes.length ? existingChapter.version : '0.3.0',
  status: 'DRAFT',
  source: '使用者提供 EP01 ACT I v0.3 及 11 張原圖，依要求接入；保留原稿草稿狀態。',
  scenes: [...scenes, ...laterScenes],
});
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[];
const images = [];
for (const scene of scenes) {
  for (const segment of scene.segments.filter((s) => s.cg)) {
    const id = segment.cg!;
    const image = id.match(/CG(\d{2})-(\d{2})$/)!;
    const path = `assets/cg/ep01/act01/LE_CG_EP01_ACT01_SC${image[1]}_IMG${image[2]}_v0.3.png`;
    const bytes = await readFile(resolve(root, path));
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
      throw Error(`Invalid PNG ${id}`);
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    const entry = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source: '使用者提供 LE_EP01_ACT01_11CG_v0.3.zip；保留原圖，未修改。',
    });
    const existing = assets.findIndex((a) => a.id === id);
    if (existing < 0) assets.push(entry);
    else assets[existing] = entry;
    images.push({
      id,
      path,
      width,
      height,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
}
if (images.length !== 11) throw Error('Expected 11 original CGs');
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) if (!characters[id]) characters[id] = name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
if (!laterScenes.length) manifest.version = '0.3.0-ep01-act01-v0.3';
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP01')!,
  {
    title: laterScenes.length
      ? manifest.chapters.find((c) => c.id === 'EP01')!.title
      : '王冠之前 · ACT I 平靜被打破',
    status: 'DRAFT_AVAILABLE',
    file: 'episodes/ep01/chapter.json',
    entry: scenes[0].id,
  }
);
await mkdir(resolve(root, 'content/episodes/ep01'), { recursive: true });
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep01/chapter.json', pack);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('content/manifests/story.json', manifest);
const prologue = ChapterFileSchema.parse(await readJson('episodes/prologue/chapter.json'));
prologue.scenes.at(-1)!.completion!.nextSceneId = scenes[0].id;
await write('content/episodes/prologue/chapter.json', prologue);
await write('docs/ep01-act01-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  scenes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choices: 0,
  scoring: 'NONE',
  images,
  notes: [
    'ACT I 結束可銜接已提供的 ACT II；不標記整章讀完、不結算整章',
    '正文逐段保留；CG 提示詞、場景結果及文書創作說明留在來源或製作註記，不作對白',
    '原規劃 EP01 章名為「從魔法學院召回」；遊戲採用本次劇本標題「王冠之前」，不覆寫原規劃來源',
    '未提供音訊，未加入臆造配樂或音效',
  ],
});
console.log(
  `Imported ${scenes.length} scenes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs / ${images.length} CG / 0 choices.`
);
