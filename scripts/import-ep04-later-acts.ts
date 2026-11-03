import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { parseEp04LaterAct, connectEp04LaterActs } from './ep04-later-acts-parser';
import { ChapterFileSchema, ManifestSchema, AssetSchema } from '../packages/narrative-core/schema';
const folder = 'content/sources/ep04';
const old = ChapterFileSchema.parse(await readJson('episodes/ep04/chapter.json'));
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
const originalAssets = (await readJson('manifests/assets.json')) as ReturnType<
  typeof AssetSchema.parse
>[];
const assets = originalAssets.filter((a) => !/^EP04-ACT0[345]-/.test(a.id));
const characters = (await readJson('characters/index.json')) as Record<string, string>;
const scenes = old.scenes.filter((s) => ['ACT01', 'ACT02'].includes(s.act));
const reports = [];
for (const act of [3, 4, 5] as const) {
  const version = act === 4 ? '1.1' : '1.0';
  const source = await readFile(resolve(root, folder, `source-act0${act}-v${version}.md`));
  const audit = JSON.parse(
    await readFile(resolve(root, folder, `act0${act}-asset-audit.json`), 'utf8')
  ) as {
    sourceSha256: string;
    images: {
      id: string;
      title: string;
      path: string;
      bytes: number;
      width: number;
      height: number;
      sha256: string;
    }[];
  };
  if (createHash('sha256').update(source).digest('hex') !== audit.sourceSha256)
    throw Error('Source changed ' + act);
  const parsed = parseEp04LaterAct(source.toString('utf8'), act);
  scenes.push(...parsed.scenes);
  for (const [id, name] of Object.entries(parsed.roles)) characters[id] ??= name;
  for (const image of audit.images) {
    const b = await readFile(resolve(root, image.path));
    if (
      createHash('sha256').update(b).digest('hex') !== image.sha256 ||
      b.length !== image.bytes ||
      b.readUInt32BE(16) !== image.width ||
      b.readUInt32BE(20) !== image.height
    )
      throw Error('Image changed ' + image.id);
    assets.push(
      AssetSchema.parse({
        id: image.id,
        type: 'cg',
        src: image.path,
        label: image.title
          .replace(/^(SC\d+|F1 啟動版)[：：]\s*/, '')
          .replace(/ACT03/g, '本日')
          .replace(/SC\d+\s*/g, ''),
        status: 'APPROVED',
        source: `使用者提供EP04 ACT0${act}正確圖片包v${version}原PNG。APPROVED僅表示素材可用；正文維持DRAFT。SHA、CRC、尺寸見sources/ep04/act0${act}-asset-audit.json。`,
      })
    );
  }
  reports.push({
    act,
    sourceSha256: audit.sourceSha256,
    nodes: parsed.scenes.length,
    segments: parsed.scenes.flatMap((s) => s.segments).length,
    choices: parsed.scenes.filter((s) => s.kind === 'choice').length,
    answers: parsed.scenes.flatMap((s) => s.choices).length,
    images: audit.images.length,
    uses: parsed.uses,
  });
}
connectEp04LaterActs(scenes);
const chapter = ChapterFileSchema.parse({
  ...old,
  version: '1.2.0',
  source:
    '使用者EP04五幕完整DRAFT與各次指定原始CG；ACT03合法調閱承接F1、ACT04條件結果一次+20，ACT05兩組政治資源分歧按新稿，其餘零效果；不定罪、不重建議會、不自動授予CLEAR。',
  scenes,
});
const order = new Map(originalAssets.map((a, i) => [a.id, i]));
assets.sort(
  (a, b) =>
    (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
);
manifest.version = '0.12.2-ep04-act03-act05-complete';
manifest.flags.FINLEY_RESEARCH_F1_STATE.description =
  '芬利研究支線：NOT_STARTED／ACTIVE／DECLINED／MATERIAL_OBTAINED／CLEARED。ACT02啟動-10；ACT03合法調閱承接；ACT04答謝讀完一次+20；不增加CLEAR。';
const write = (p: string, value: unknown) =>
  writeFile(resolve(root, p), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep04/chapter.json', chapter);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('docs/ep04-later-acts-import-report.json', {
  acts: reports,
  f1: 'ACT03 ACTIVE -> MATERIAL_OBTAINED, ACT04 guarded completion +20 -> CLEARED; decline skips entire ACT04 SC05',
  scoring: 'ACT05 C4 +10/+5/0; C5 +15/+5/0/-5; no other political/unrest/CLEAR effects',
  pending: 'EP05 not supplied; fourth chapter ends with CHAPTER settlement only',
});
console.log(
  JSON.stringify(
    reports.map(({ uses, ...report }) => report),
    null,
    2
  )
);
