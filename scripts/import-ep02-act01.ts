import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { ChapterFileSchema, ManifestSchema, AssetSchema } from '../packages/narrative-core/schema';
import { parseEp02Act01 } from './ep02-act01-parser';
import { parseEp01Act05 } from './ep01-act05-parser';
const sourcePath = 'content/sources/ep02/source-act01-v0.9.md',
  source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp02Act01(source.toString('utf8'));
const ep01 = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
ep01.scenes = [
  ...ep01.scenes.filter((s) => s.act !== 'ACT05'),
  ...parseEp01Act05(
    await readFile(resolve(root, 'content/sources/ep01/source-act05-v0.4.md'), 'utf8')
  ).scenes,
];
let later: typeof scenes = [];
let existingVersion = '0.9.0',
  existingSource = '';
try {
  const existing = ChapterFileSchema.parse(await readJson('episodes/ep02/chapter.json'));
  existingVersion = existing.version;
  existingSource = existing.source;
  later = existing.scenes.filter((s) => s.act !== 'ACT01');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const chapter = ChapterFileSchema.parse({
  schemaVersion: 1,
  id: 'EP02',
  version: later.length ? existingVersion : '0.9.0',
  status: 'DRAFT',
  source: later.length
    ? existingSource
    : '使用者提供EP02 ACT I v0.9新稿與20張CG；工作章名、DRAFT及SOURCE_REQUIRED保留，不覆蓋未提供的舊六幕正文。',
  scenes: [...scenes, ...later],
});
const supplied = (await readJson('sources/ep02/image-manifest-v0.9.json')) as {
  File: string;
  Width: number;
  Height: number;
  Bytes: number;
  SHA256: string;
}[];
if (supplied.length !== 20 || new Set(supplied.map((r) => r.File)).size !== 20)
  throw Error('Expected twenty EP02 image entries');
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[],
  images = [];
for (const scene of scenes)
  for (const seg of scene.segments.filter((p) => p.cg)) {
    const id = seg.cg!,
      m = id.match(/CG(\d{2})-(\d{2})$/)!,
      stem = `LE_EP02_ACT01_SC${m[1]}_CG${m[2]}_v0.9`,
      expected = supplied.filter((r) => r.File === stem + '.png' || r.File === stem + '-r2.png');
    if (expected.length !== 1) throw Error(`Missing or ambiguous CG mapping ${id}`);
    const entry = expected[0],
      path = 'assets/cg/ep02/act01/' + entry.File,
      bytes = await readFile(resolve(root, path)),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    if (
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      entry.SHA256.toLowerCase() !== sha256 ||
      entry.Bytes !== bytes.length ||
      entry.Width !== bytes.readUInt32BE(16) ||
      entry.Height !== bytes.readUInt32BE(20)
    )
      throw Error(`PNG manifest mismatch ${id}`);
    const asset = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source:
        '使用者提供LE_EP02_ACT01_20CG_v0.9.zip，依附帶manifest逐張校驗，SC04 CG02使用r2。原始PNG未修改。',
    });
    const at = assets.findIndex((a) => a.id === id);
    if (at < 0) assets.push(asset);
    else assets[at] = asset;
    images.push({
      id,
      path,
      zipEntry: entry.File,
      width: entry.Width,
      height: entry.Height,
      bytes: bytes.length,
      sha256,
    });
  }
if (images.length !== 20 || new Set(images.map((i) => i.id)).size !== 20)
  throw Error('Expected twenty EP02 CG cues');
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
if (!later.length) manifest.version = '0.8.0-ep02-act01-v0.9';
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP02')!,
  {
    title: '留下來的人',
    status: 'DRAFT_AVAILABLE',
    file: 'episodes/ep02/chapter.json',
    entry: 'EP02_ACT01_SC01',
  }
);
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) characters[id] ??= name;
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await mkdir(resolve(root, 'content/episodes/ep02'), { recursive: true });
await write('content/episodes/ep01/chapter.json', ep01);
await write('content/episodes/ep02/chapter.json', chapter);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('docs/ep02-act01-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  sourceScenes: 5,
  playbackNodes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choicePoints: 5,
  options: 15,
  choiceEffects: 'NONE',
  newPermanentFlags: [],
  images,
  notes: [
    '每場四CG，依正文錨點切換；SC04 CG02依manifest使用r2原圖',
    '依act01-speakers-v0.9.json逐句核對未署名對白，心想標為內心，不將引用詞語當發話',
    '五組選項只記錄回應，不建立永久資訊旗標、不改政治／動盪／CLEAR或路線',
    '角色名依本稿顯示莎莉亞、塔瑪拉，保留姓名與親屬衝突的SOURCE_REQUIRED，不改Canon',
    '父王自主主持朝政；艾維斯軍事與法統不改；艾琳達代理格哈德而非繼承，尚無支線解鎖',
    '幕末可接完整劇本版ACT II〈王冠之外的責任〉；不編造正式職位、攝政或後續出城；未附音訊',
  ],
});
console.log(
  `Imported EP02 ACT I: ${scenes.length} nodes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs / 20 CG / 5 flavor choices.`
);
