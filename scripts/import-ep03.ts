import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import {
  AssetSchema,
  ChapterFileSchema,
  ManifestSchema,
  type Scene,
} from '../packages/narrative-core/schema';
import { parseEp03Act, ep03Titles, type SourceUse } from './ep03-parser';

const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
const audit = JSON.parse(
  await readFile(resolve(root, 'content/sources/ep03/asset-audit.json'), 'utf8')
) as {
  images: {
    id: string;
    act: number;
    path: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
  }[];
  missing: string[];
  expected: number;
};
const scenes: Scene[] = [],
  sources: unknown[] = [],
  uses: SourceUse[] = [];
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const act of [1, 2, 3, 4, 5]) {
  const file = `content/sources/ep03/act0${act}/${act === 4 ? '05' : '00'}.md`;
  const bytes = await readFile(resolve(root, file));
  const parsed = parseEp03Act(
    bytes.toString('utf8'),
    act,
    act === 4
      ? await readFile(resolve(root, 'content/sources/ep03/act04/06.md'), 'utf8')
      : undefined
  );
  scenes.push(...parsed.scenes);
  uses.push(...parsed.uses);
  for (const [id, label] of Object.entries(parsed.roles)) characters[id] ??= label;
  sources.push({
    act,
    title: ep03Titles[act - 1],
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    nodes: parsed.scenes.length,
    paragraphs: parsed.scenes.flatMap((s) => s.segments).length,
    choices: parsed.scenes.filter((s) => s.kind === 'choice').length,
    availableImages: audit.images.filter((a) => a.act === act).length,
  });
}
const completeAct02 =
  audit.images.filter((image) => image.act === 2).length === 27 && audit.missing.length === 0;
const chapter = ChapterFileSchema.parse({
  schemaVersion: 1,
  id: 'EP03',
  version: completeAct02 ? '1.0.1' : '1.0.0',
  status: 'DRAFT',
  source: completeAct02
    ? '使用者提供EP03 ACT01–05完整劇本及原CG；ACT02採三份fixed圖包27張完整PNG，第三章135張CG全部齊全。正文與既有選項不變，保留DRAFT。'
    : '使用者提供 EP03 ACT01–05 完整劇本製作包及指定新版原始CG；ACT02圖片包截斷，20張完整PNG通過CRC，7張待補。未以製作註記冒充正文；Canon與數值不擅自升級。',
  scenes,
});
const originalAssets = (await readJson('manifests/assets.json')) as ReturnType<
  typeof AssetSchema.parse
>[];
const assetOrder = new Map(originalAssets.map((asset, index) => [asset.id, index]));
const assets = originalAssets.filter((a) => !a.id.startsWith('EP03-'));
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
      label: image.id + ' · ' + ep03Titles[image.act - 1],
      status: 'APPROVED',
      source:
        '使用者EP03指定圖片原PNG，未重製；原ZIP/條目/SHA256與尺寸見sources/ep03/asset-audit.json；APPROVED表示圖片可用，正文維持DRAFT。',
    })
  );
}
for (const id of audit.missing)
  assets.push(
    AssetSchema.parse({
      id,
      type: 'cg',
      src: 'assets/cg/hall.svg',
      label: id + ' · 插圖待補',
      status: 'PLACEHOLDER',
      source: '使用者ACT02壓縮檔截斷，沒有完整可驗證PNG；待補畫面不冒用其他圖片、不收藏。',
    })
  );
const used = new Set(scenes.flatMap((s) => [s.cg, ...s.segments.map((p) => p.cg)].filter(Boolean)));
if (audit.images.some((a) => !used.has(a.id)) || used.size !== audit.expected)
  throw Error('Missing or unused storyboard CG');
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
const fourthChapter = manifest.chapters.find((c) => c.id === 'EP04');
if (fourthChapter?.entry) {
  const closing = chapter.scenes.find((s) => s.completion?.scope === 'CHAPTER')!;
  delete closing.completion!.pendingLabel;
  Object.assign(closing.completion!, {
    nextSceneId: fourthChapter.entry,
    nextLabel: `EP04〈${fourthChapter.title}〉`,
    continueLabel: '進入 EP04 第四章',
  });
} else manifest.version = completeAct02 ? '0.11.1-ep03-act02-cg-fixed' : '0.11.0-ep03-act01-act05';
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP03')!,
  {
    title: '責任先於權力',
    status: 'DRAFT_AVAILABLE',
    file: 'episodes/ep03/chapter.json',
    entry: 'EP03_ACT01_SC01',
  }
);
const previous = ChapterFileSchema.parse(await readJson('episodes/ep02/chapter.json'));
const end = previous.scenes.find((s) => s.completion?.scope === 'CHAPTER')!;
delete end.completion!.pendingLabel;
Object.assign(end.completion!, {
  nextSceneId: 'EP03_ACT01_SC01',
  nextLabel: 'EP03〈責任先於權力〉',
  continueLabel: '進入 EP03 第三章',
});
await mkdir(resolve(root, 'content/episodes/ep03'), { recursive: true });
await write('content/episodes/ep03/chapter.json', chapter);
await write('content/episodes/ep02/chapter.json', previous);
await write('content/manifests/story.json', manifest);
await write(
  'content/manifests/assets.json',
  assets.sort(
    (a, b) =>
      (assetOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (assetOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
);
await write('content/characters/index.json', characters);
await write('docs/ep03-import-report.json', {
  sources,
  available: audit.images.length,
  expected: audit.expected,
  missing: audit.missing,
  scoring: 'NONE; twenty flavor choices, no political/unrest/CLEAR/authority effects',
  fourthAct:
    'Five source choices inserted at the five authored insertion points in SC02/03/04; main text retained.',
  fifthAct:
    '26 main CG + 9 branch CG; local scene IDs resolve the manuscript’s inconsistent 25-image summary; authority cue SC05 CG03 inserted at its exact paragraph.',
  sourceUses: uses,
});
console.log(
  JSON.stringify({ sources, available: audit.images.length, missing: audit.missing }, null, 2)
);
