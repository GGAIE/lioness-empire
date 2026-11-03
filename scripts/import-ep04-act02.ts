import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { parseEp04Act02, connectEp04Act02 } from './ep04-act02-parser';
import { connectEp04LaterActs } from './ep04-later-acts-parser';
import { ChapterFileSchema, ManifestSchema, AssetSchema } from '../packages/narrative-core/schema';

const folder = 'content/sources/ep04';
const source = await readFile(resolve(root, folder, 'source-act02-v1.0.md'));
const audit = JSON.parse(
  await readFile(resolve(root, folder, 'act02-asset-audit.json'), 'utf8')
) as {
  sourceSha256: string;
  images: {
    id: string;
    number: number;
    title: string;
    path: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
  }[];
};
if (createHash('sha256').update(source).digest('hex') !== audit.sourceSha256)
  throw Error('Source changed');
const parsed = parseEp04Act02(source.toString('utf8'));
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
const old = ChapterFileSchema.parse(await readJson('episodes/ep04/chapter.json'));
const later = old.scenes.filter((s) => Number(s.act.slice(3)) > 2);
const chapter = ChapterFileSchema.parse({
  ...old,
  version: later.length ? old.version : '1.1.0',
  source: later.length
    ? old.source
    : '使用者EP04 ACT01 v1.0與ACT02 v1.0 DRAFT正文及所附選定原CG；第二幕前五組對話零效果，F1最後二選一依原稿啟動-10或拒絕0，後續待交付。',
  scenes: [...old.scenes.filter((s) => s.act === 'ACT01'), ...parsed.scenes, ...later],
});
connectEp04Act02(chapter.scenes);
connectEp04LaterActs(chapter.scenes);
const original = (await readJson('manifests/assets.json')) as ReturnType<
  typeof AssetSchema.parse
>[];
const assets = original.filter((a) => !a.id.startsWith('EP04-ACT02-'));
for (const image of audit.images) {
  const b = await readFile(resolve(root, image.path));
  if (
    createHash('sha256').update(b).digest('hex') !== image.sha256 ||
    b.length !== image.bytes ||
    b.readUInt32BE(16) !== image.width ||
    b.readUInt32BE(20) !== image.height
  )
    throw Error('Image mismatch ' + image.id);
  assets.push(
    AssetSchema.parse({
      id: image.id,
      type: 'cg',
      src: image.path,
      label:
        image.number === 4
          ? '筆記中的舊註記'
          : image.number === 14
            ? '祝賀廳中的三名官員'
            : image.number === 15
              ? '門外的茶點稟報'
              : image.title,
      status: 'APPROVED',
      source:
        '使用者LE_EP04_ACT02_25CG_final_v0.3.zip原PNG，依包內manifest：22張v0.3與3張v0.4；APPROVED僅表示素材可用，劇本維持DRAFT。詳sources/ep04/act02-asset-audit.json。',
    })
  );
}
const order = new Map(original.map((a, i) => [a.id, i]));
assets.sort(
  (a, b) =>
    (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
);
manifest.flags.FINLEY_RESEARCH_F1_STATE ??= {
  initial: 'NOT_STARTED',
  description:
    'EP04 ACT02研究支線：NOT_STARTED／ACTIVE／DECLINED；ACT03、ACT04後續尚未交付，不預先轉移或發獎。',
};
if (!later.length) manifest.version = '0.12.1-ep04-act02-v1.0-art-final-v0.3';
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(parsed.roles)) characters[id] ??= name;
const write = (p: string, v: unknown) =>
  writeFile(resolve(root, p), JSON.stringify(v, null, 2) + '\n');
await write('content/episodes/ep04/chapter.json', chapter);
await write('content/manifests/story.json', manifest);
await write('content/manifests/assets.json', assets);
await write('content/characters/index.json', characters);
await write('docs/ep04-act02-import-report.json', {
  sourceSha256: audit.sourceSha256,
  sections: 6,
  nodes: parsed.scenes.length,
  segments: parsed.scenes.flatMap((s) => s.segments).length,
  choices: 6,
  answers: 17,
  images: audit.images.length,
  f1: {
    flag: 'FINLEY_RESEARCH_F1_STATE',
    help: 'ACTIVE; political points -10 once',
    decline: 'DECLINED; 0',
    future: later.length
      ? 'ACT03/ACT04 connected; guarded completion +20 once'
      : 'ACT03/ACT04 not supplied; no scenes or +20 reward invented',
  },
  pending: later.length
    ? 'ACT03〈各自的難題〉connected; ACT scope, not chapter completion'
    : 'ACT03 pending; ACT scope, not chapter completion',
  uses: parsed.uses,
});
console.log(
  JSON.stringify(
    {
      sections: 6,
      nodes: parsed.scenes.length,
      segments: parsed.scenes.flatMap((s) => s.segments).length,
      images: audit.images.length,
    },
    null,
    2
  )
);
