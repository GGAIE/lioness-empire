import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { ChapterFileSchema, AssetSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp02Act02 } from './ep02-act02-parser';
import { parseEp02Act01 } from './ep02-act01-parser';
const sourcePath = 'content/sources/ep02/source-act02-v1.1.md',
  source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp02Act02(source.toString('utf8')),
  pack = ChapterFileSchema.parse(await readJson('episodes/ep02/chapter.json'));
const hasLaterActs = pack.scenes.some((s) => !['ACT01', 'ACT02'].includes(s.act));
pack.scenes = [
  ...parseEp02Act01(
    await readFile(resolve(root, 'content/sources/ep02/source-act01-v0.9.md'), 'utf8')
  ).scenes,
  ...scenes,
  ...pack.scenes.filter((s) => !['ACT01', 'ACT02'].includes(s.act)),
];
if (!hasLaterActs) {
  pack.version = '1.1.0';
  pack.source =
    '使用者提供ACT I v0.9、ACT II完整劇本v1.1及SCRIPT圖包v1.2；只用新版本，不沿用大綱圖片或撤回擴寫稿。保留DRAFT及SOURCE_REQUIRED。';
}
ChapterFileSchema.parse(pack);
const supplied = (await readJson('sources/ep02/act02-image-manifest-script-v1.2.json')) as {
  File: string;
  Width: number;
  Height: number;
  Bytes: number;
  SHA256: string;
}[];
if (supplied.length !== 20 || new Set(supplied.map((r) => r.File)).size !== 20)
  throw Error('Expected twenty new-script PNG entries');
const assets = (
    (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[]
  ).filter((a) => !a.id.startsWith('EP02-ACT02-')),
  images = [];
for (const entry of supplied) {
  const m = entry.File.match(/^LE_EP02_ACT02_SC(0[1-5])_CG(0[1-4])_script-v1\.[12](?:-r2)?\.png$/);
  if (!m) throw Error(`Not a new-script image: ${entry.File}`);
  const id = `EP02-ACT02-CG${m[1]}-${m[2]}`,
    path = 'assets/cg/ep02/act02/' + entry.File,
    bytes = await readFile(resolve(root, path)),
    hash = createHash('sha256').update(bytes).digest('hex');
  if (
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    hash !== entry.SHA256.toLowerCase() ||
    entry.Bytes !== bytes.length ||
    entry.Width !== bytes.readUInt32BE(16) ||
    entry.Height !== bytes.readUInt32BE(20)
  )
    throw Error(`Supplied new-script image mismatch ${id}`);
  const scene = scenes.find((s) => s.sceneNumber === Number(m[1]))!;
  assets.push(
    AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source:
        '使用者提供LE_EP02_ACT02_20CG_SCRIPT_v1.2.zip；完整劇本版原PNG，非先前大綱圖包。廢塔v1.2取代劇本文內原圖回收註記。',
    })
  );
  images.push({
    id,
    path,
    zipEntry: entry.File,
    width: entry.Width,
    height: entry.Height,
    bytes: entry.Bytes,
    sha256: hash,
  });
}
if (new Set(images.map((r) => r.id)).size !== 20) throw Error('Duplicate new-script CG id');
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
if (!hasLaterActs) manifest.version = '0.9.0-ep02-act02-script-v1.1-art-v1.2';
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) characters[id] ??= name;
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep02/chapter.json', pack);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('docs/ep02-act02-import-report.json', {
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
    '依使用者最新完整正文v1.1製作；不用大綱、不用撤回擴寫稿；ZIP附帶SOURCE_SCRIPT與獨立MD已逐字比對一致',
    '20張均為SCRIPT圖包v1.2；SC04 CG01、CG04使用r2，廢塔CG03使用script-v1.2；舊圖包不註冊不混用',
    'SC01芬利只在側廊CG01，會談無芬利；SC03 CG04才再會合；SC05 CG04芬利離開後獨處',
    '三個明確回到現在的演出指示重用各場CG01，保留20個來源CG錨點而非新增插畫；製作備註不當旁白',
    '同步驚呼採雙人頭標單節點；回憶中的角色標明回憶，精確年齡及新增學院史仍SOURCE_REQUIRED',
    '選項、資源、CLEAR、關係與路線全部零效果，無新永久旗標，不授攝政或學院權限；第三幕未提供',
    '原文ACT II END作黑場字幕；未附音訊，不新增BGM或音效',
  ],
});
console.log(
  `Imported new-script ACT II: ${scenes.length} nodes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs / 20 new-pack CGs.`
);
