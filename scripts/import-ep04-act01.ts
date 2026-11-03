import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { parseEp04Act01 } from './ep04-act01-parser';
import { connectEp04Act02 } from './ep04-act02-parser';
import { connectEp04LaterActs } from './ep04-later-acts-parser';
import { ChapterFileSchema, ManifestSchema, AssetSchema } from '../packages/narrative-core/schema';

const folder = 'content/sources/ep04';
const source = await readFile(resolve(root, folder, 'source-act01-v1.0.md'));
const parsed = parseEp04Act01(source.toString('utf8'));
const audit = JSON.parse(
  await readFile(resolve(root, folder, 'act01-asset-audit.json'), 'utf8')
) as {
  sourceSha256: string;
  images: {
    id: string;
    number: number;
    title: string;
    path: string;
    sha256: string;
    width: number;
    height: number;
    bytes: number;
  }[];
};
if (createHash('sha256').update(source).digest('hex') !== audit.sourceSha256)
  throw Error('Source changed');
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
const existing = manifest.chapters.find((c) => c.id === 'EP04')!;
const oldPack = existing.file ? ChapterFileSchema.parse(await readJson(existing.file)) : undefined;
const later = oldPack?.scenes.filter((s) => s.act !== 'ACT01') ?? [];
const chapter = ChapterFileSchema.parse({
  schemaVersion: 1,
  id: 'EP04',
  version: later.length ? oldPack!.version : '1.0.0',
  status: 'DRAFT',
  source: later.length
    ? oldPack!.source
    : '使用者提供EP04 ACT01完整開發文件v1.0 DRAFT與25張selected原始CG；五組純對話選項，無數值或歷史旗標效果。未知王命具體條款保留泛述，三名新官員暫名保留DRAFT。',
  scenes: [...parsed.scenes, ...later],
});
connectEp04Act02(chapter.scenes);
connectEp04LaterActs(chapter.scenes);
const originalAssets = (await readJson('manifests/assets.json')) as ReturnType<
  typeof AssetSchema.parse
>[];
const assets = originalAssets.filter((a) => !a.id.startsWith('EP04-ACT01-'));
for (const image of audit.images) {
  const b = await readFile(resolve(root, image.path));
  if (
    createHash('sha256').update(b).digest('hex') !== image.sha256 ||
    b.length !== image.bytes ||
    b.readUInt32BE(16) !== image.width ||
    b.readUInt32BE(20) !== image.height
  )
    throw Error('Image changed ' + image.id);
  const title =
    image.number === 15
      ? '祝賀廳中的三名官員'
      : image.number === 20
        ? '人群中的熟悉身影'
        : image.title;
  assets.push(
    AssetSchema.parse({
      id: image.id,
      type: 'cg',
      src: image.path,
      label: title,
      status: 'APPROVED',
      source:
        '使用者LE_EP04_ACT01_25CG_selected_v0.1.zip原PNG，依selected_manifest所選版本；APPROVED僅為素材可用，角色與劇本維持DRAFT。SHA及尺寸見sources/ep04/act01-asset-audit.json。',
    })
  );
}
const order = new Map(originalAssets.map((a, i) => [a.id, i]));
assets.sort(
  (a, b) =>
    (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
);
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(parsed.roles)) characters[id] ??= name;
Object.assign(existing, {
  title: '不得已攝政',
  status: 'DRAFT_AVAILABLE',
  file: 'episodes/ep04/chapter.json',
  entry: 'EP04_ACT01_SC01',
});
if (!later.length) manifest.version = '0.12.0-ep04-act01-v1.0-art-selected-v0.1';
const previous = ChapterFileSchema.parse(await readJson('episodes/ep03/chapter.json'));
const end = previous.scenes.find((s) => s.completion?.scope === 'CHAPTER')!;
delete end.completion!.pendingLabel;
Object.assign(end.completion!, {
  nextSceneId: 'EP04_ACT01_SC01',
  nextLabel: 'EP04〈不得已攝政〉',
  continueLabel: '進入 EP04 第四章',
});
const write = (p: string, v: unknown) =>
  writeFile(resolve(root, p), JSON.stringify(v, null, 2) + '\n');
await mkdir(resolve(root, 'content/episodes/ep04'), { recursive: true });
await write('content/episodes/ep04/chapter.json', chapter);
await write('content/episodes/ep03/chapter.json', previous);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
const report = {
  sourceSha256: audit.sourceSha256,
  scenes: 5,
  nodes: parsed.scenes.length,
  segments: parsed.scenes.flatMap((s) => s.segments).length,
  choices: 5,
  answers: 15,
  images: audit.images.length,
  scoring: 'NONE; no new political, unrest, CLEAR, route or history flag effects',
  regency:
    'Formal delegated regency is narrated in SC02; existing historical flags are not repurposed.',
  pending: later.length
    ? 'ACT02 connected; ACT01 ending remains ACT scope, not chapter completion.'
    : 'ACT02 screenplay not supplied; ACT01 ending is ACT scope, not chapter completion.',
  uses: parsed.uses,
};
await write('docs/ep04-act01-import-report.json', report);
console.log(JSON.stringify({ ...report, uses: undefined }, null, 2));
