import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { root, readJson } from './load-content';
import { ChapterFileSchema, AssetSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp02LaterAct, laterActTitles } from './ep02-later-acts-parser';
import { parseEp02Act02 } from './ep02-act02-parser';
const folder = 'content/sources/ep02/update-1031';
const audit = JSON.parse(await readFile(resolve(root, folder, 'asset-audit.json'), 'utf8')) as {
  images: {
    id: string;
    act: number;
    scene: number;
    cg: number;
    path: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
  }[];
  missing: string[];
};
const chapter = ChapterFileSchema.parse(await readJson('episodes/ep02/chapter.json'));
const base = chapter.scenes.filter((s) => !['ACT02', 'ACT03', 'ACT04', 'ACT05'].includes(s.act));
const second = parseEp02Act02(
  await readFile(resolve(root, 'content/sources/ep02/source-act02-v1.1.md'), 'utf8')
).scenes;
const incoming = [],
  sourceRows = [];
for (const act of [3, 4, 5] as const) {
  const path = folder + '/act0' + act + '-source.md',
    bytes = await readFile(resolve(root, path));
  const parsed = parseEp02LaterAct(bytes.toString('utf8'), act);
  incoming.push(...parsed.scenes);
  sourceRows.push({
    act,
    title: laterActTitles[act],
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    scenes: 5,
    nodes: parsed.scenes.length,
    segments: parsed.scenes.flatMap((s) => s.segments).length,
    choices: parsed.scenes
      .filter((s) => s.kind === 'choice')
      .map((s) => ({ id: s.id, options: s.choices.length })),
    cgAnchors: parsed.scenes.flatMap((s) => s.segments).filter((p) => p.cg).length,
  });
}
chapter.scenes = [...base, ...second, ...incoming];
const completeAct05 =
  audit.images.filter((image) => image.act === 5).length === 25 && !audit.missing.length;
chapter.version = completeAct05 ? '2.0.1' : '2.0.0';
chapter.source = completeAct05
  ? '使用者1031更新.zip完整EP02 ACT III v1.0、IV v1.0、V v1.1，ACT V採25張CG正確完整版v0.2，CG14修正版與CG20–25皆齊全；沿用現行v1.1正文，P2未解決，保留DRAFT。'
  : '使用者1031更新.zip完整EP02 ACT III v1.0、IV v1.0、V v1.1，承接既有兩幕；ACT V圖包截斷，19圖CRC驗證還原，CG20–25待補。新正文覆蓋舊規劃演出，P2未解決；保留DRAFT。';
ChapterFileSchema.parse(chapter);
const originalAssets = (await readJson('manifests/assets.json')) as ReturnType<
  typeof AssetSchema.parse
>[];
const assetOrder = new Map(originalAssets.map((asset, index) => [asset.id, index]));
const assets = originalAssets.filter((a) => !/^EP02-ACT0[345]-/.test(a.id));
for (const image of audit.images) {
  const bytes = await readFile(resolve(root, image.path));
  if (
    createHash('sha256').update(bytes).digest('hex') !== image.sha256 ||
    bytes.length !== image.bytes ||
    bytes.readUInt32BE(16) !== image.width ||
    bytes.readUInt32BE(20) !== image.height
  )
    throw Error('Image changed ' + image.id);
  assets.push(
    AssetSchema.parse({
      id: image.id,
      type: 'cg',
      src: image.path,
      label: image.id + ' · ' + laterActTitles[image.act],
      status: 'APPROVED',
      source:
        image.act === 5 && completeAct05
          ? '使用者EP02 ACT05 25張CG正確完整版v0.2原PNG；CG14為修正版，SHA與尺寸符合附包CG_Index.csv；現行v1.1正文不變。'
          : '使用者1031更新.zip原PNG；逐檔SHA及CRC／尺寸見sources/ep02/update-1031/asset-audit.json。',
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
      source: 'ACT V附包於CG19結束，原始資料無此圖；DRAFT播放不渲染佔位檔、不收藏、不冒用其他CG。',
    })
  );
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const act of [3, 4, 5] as const) {
  const p = parseEp02LaterAct(
    await readFile(resolve(root, folder + '/act0' + act + '-source.md'), 'utf8'),
    act
  );
  for (const [id, label] of Object.entries(p.roles)) characters[id] ??= label;
}
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
const thirdChapter = manifest.chapters.find((c) => c.id === 'EP03');
if (thirdChapter?.entry) {
  const end = chapter.scenes.find((s) => s.completion?.scope === 'CHAPTER')!;
  delete end.completion!.pendingLabel;
  Object.assign(end.completion!, {
    nextSceneId: thirdChapter.entry,
    nextLabel: `EP03〈${thirdChapter.title}〉`,
    continueLabel: '進入 EP03 第三章',
  });
} else
  manifest.version = completeAct05 ? '0.10.1-ep02-act05-cg-v0.2' : '0.10.0-ep02-act03-act05-1031';
manifest.flags.AIVIS_DEPARTED_EASTERN_FRONT = {
  initial: false,
  description:
    '僅EP02 ACT V SC03實際讀完城門送行後記錄王儲正式出城；不代表政治數值、攝政、失能或路線授權。',
};
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep02/chapter.json', chapter);
await write(
  'content/manifests/assets.json',
  assets.sort(
    (a, b) =>
      (assetOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (assetOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
);
await write('content/manifests/story.json', manifest);
await write('content/characters/index.json', characters);
await write('docs/ep02-act03-act05-import-report.json', {
  sources: sourceRows,
  availablePngs: audit.images.length,
  missingImages: audit.missing,
  scoring: 'NONE',
  newFactFlag: 'AIVIS_DEPARTED_EASTERN_FRONT only after ACT05 SC03',
  candidateFlags:
    'Not added; source memory candidates remain proposals and reading history records their text.',
  chapterCompletion: thirdChapter?.entry
    ? 'ACT05 SC05; continues into supplied EP03; P2 proposal remains unresolved.'
    : 'ACT05 SC05; pending EP03, P2 not resolved.',
});
console.log(
  JSON.stringify(
    { sources: sourceRows, availablePngs: audit.images.length, missingImages: audit.missing },
    null,
    2
  )
);
