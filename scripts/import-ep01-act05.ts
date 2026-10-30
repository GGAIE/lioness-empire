import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { AssetSchema, ChapterFileSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp01Act04 } from './ep01-act04-parser';
import { parseEp01Act05, act05CompletionFlags } from './ep01-act05-parser';
const sourcePath = 'content/sources/ep01/source-act05-v0.4.md',
  source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp01Act05(source.toString('utf8'));
const supplied = (await readJson('sources/ep01/act05-image-manifest-v0.4.json')) as {
  File: string;
  Width: number;
  Height: number;
  Bytes: number;
  SHA256: string;
}[];
if (supplied.length !== 20 || new Set(supplied.map((s) => s.File)).size !== 20)
  throw Error('Expected twenty unique supplied PNG entries');
const chapter = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
const act04 = parseEp01Act04(
  await readFile(resolve(root, 'content/sources/ep01/source-act04-v0.4.md'), 'utf8')
).scenes;
chapter.scenes = [
  ...chapter.scenes.filter((s) => ['ACT01', 'ACT02', 'ACT03'].includes(s.act)),
  ...act04,
  ...scenes,
  ...chapter.scenes.filter((s) => !['ACT01', 'ACT02', 'ACT03', 'ACT04', 'ACT05'].includes(s.act)),
];
chapter.version = '0.7.0';
chapter.source =
  '使用者提供EP01 ACT I–V及原圖；第五幕v0.4，第一章完。五組純對話選項無數值／路線效果；保留DRAFT。';
ChapterFileSchema.parse(chapter);
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[],
  images = [];
for (const scene of scenes)
  for (const segment of scene.segments.filter((s) => s.cg)) {
    const id = segment.cg!,
      m = id.match(/CG(\d{2})-(\d{2})$/)!,
      file = `LE_EP01_ACT05_SC${m[1]}_CG${m[2]}_v0.4.png`,
      path = `assets/cg/ep01/act05/${file}`,
      bytes = await readFile(resolve(root, path)),
      hash = createHash('sha256').update(bytes).digest('hex');
    const expected = supplied.find((s) => s.File === file);
    if (
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      !expected ||
      hash !== expected.SHA256.toLowerCase() ||
      bytes.length !== expected.Bytes ||
      bytes.readUInt32BE(16) !== expected.Width ||
      bytes.readUInt32BE(20) !== expected.Height
    )
      throw Error(`Supplied image manifest mismatch ${file}`);
    const asset = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source: '使用者提供LE_EP01_ACT05_20CG_v0.4.zip；依image_manifest.json校驗，保留原始PNG。',
    });
    const index = assets.findIndex((a) => a.id === id);
    if (index < 0) assets.push(asset);
    else assets[index] = asset;
    images.push({
      id,
      path,
      zipEntry: file,
      width: expected.Width,
      height: expected.Height,
      bytes: bytes.length,
      sha256: hash,
    });
  }
if (images.length !== 20 || new Set(images.map((s) => s.id)).size !== 20)
  throw Error('Expected twenty ACT V CG assets');
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) characters[id] ??= name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
manifest.version = '0.7.0-ep01-act05-v0.4';
for (const key of Object.keys(act05CompletionFlags))
  manifest.flags[key] ??= { initial: false, description: `ACT V章末事實：${key}；不作選項獎懲。` };
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP01')!,
  { title: '王冠之前 · ACT I–V', status: 'DRAFT_AVAILABLE' }
);
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep01/chapter.json', chapter);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('docs/ep01-act05-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  sourceScenes: 5,
  playbackNodes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choicePoints: 5,
  options: 15,
  choiceEffects: 'NONE',
  completionFlags: act05CompletionFlags,
  images,
  notes: [
    'CG數依場景為4/5/4/4/3，換圖依正文CG標記；SC04第三張於問題顯示時切換',
    '保留正文引號與敘述式說話，不推測無署名引語的說話者；分支逐行播放，所選回答重現一次',
    '芬利不進父王寢宮；探視經國王本人同意與醫師許可；不創作陰謀或病因',
    '原稿EP01結束字幕作章末黑場；標記第一章已讀，數值不變，EP02尚未提供',
    '所有事實於章末字幕讀完記錄；只有私人暫留，無行政職位或攝政權；不加音訊',
  ],
});
console.log(
  `Imported ACT V: ${scenes.length} nodes, ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs, 20 original CGs, 5 flavor choices, chapter ending.`
);
