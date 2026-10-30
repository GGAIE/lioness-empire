import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, readJson } from './load-content';
import { AssetSchema, ChapterFileSchema, ManifestSchema } from '../packages/narrative-core/schema';
import { parseEp01Act03 } from './ep01-act03-parser';
import { act04CompletionFlags, parseEp01Act04 } from './ep01-act04-parser';
const sourcePath = 'content/sources/ep01/source-act04-v0.4.md',
  source = await readFile(resolve(root, sourcePath));
const { scenes, roles } = parseEp01Act04(source.toString('utf8'));
const suppliedImages = JSON.parse(
  await readFile(resolve(root, 'content/sources/ep01/act04-cg-manifest-v0.1.json'), 'utf8')
) as { cg: string; file: string; size: number[]; sha256: string }[];
const chapter = ChapterFileSchema.parse(await readJson('episodes/ep01/chapter.json'));
const act03 = parseEp01Act03(
  await readFile(resolve(root, 'content/sources/ep01/source-act03-v0.3.md'), 'utf8')
).scenes;
chapter.scenes = [
  ...chapter.scenes.filter((s) => ['ACT01', 'ACT02'].includes(s.act)),
  ...act03,
  ...scenes,
  ...chapter.scenes.filter((s) => !['ACT01', 'ACT02', 'ACT03', 'ACT04'].includes(s.act)),
];
chapter.version = '0.6.0';
chapter.source =
  '使用者提供ACT I–IV及原圖；第四幕v0.4搭配正確修正版CG v0.1。純對話選項無數值或路線效果，保留DRAFT。';
ChapterFileSchema.parse(chapter);
const assets = (await readJson('manifests/assets.json')) as ReturnType<typeof AssetSchema.parse>[];
const images = [];
for (const scene of scenes)
  for (const segment of scene.segments.filter((s) => s.cg)) {
    const id = segment.cg!,
      m = id.match(/CG(\d{2})-(\d{2})$/)!;
    const path = `assets/cg/ep01/act04/LE_CG_EP01_ACT04_SC${m[1]}_IMG${m[2]}_v0.1.png`,
      bytes = await readFile(resolve(root, path));
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
      throw Error(`Invalid PNG ${id}`);
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    const expected = suppliedImages.find((image) => image.cg === `04-${m[1]}-${m[2]}`);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (
      !expected ||
      expected.sha256 !== digest ||
      expected.size[0] !== width ||
      expected.size[1] !== height ||
      expected.file !== `SC${m[1]}/LE_CG_EP01_ACT04_SC${m[1]}_IMG${m[2]}_v0.1.png`
    )
      throw Error(`Corrected ZIP manifest mismatch ${id}`);
    if (Math.abs(width / height - 16 / 9) > 0.02) throw Error(`Unexpected CG aspect ratio ${id}`);
    const entry = AssetSchema.parse({
      id,
      type: 'cg',
      src: path,
      label: `${id} · ${scene.title}`,
      status: 'APPROVED',
      source:
        '使用者提供《母獅帝國_EP01_ACT04_20張CG_正確修正版_v0.1.zip》，原PNG位元組保留，對照SCxx/IMGxx。',
    });
    const index = assets.findIndex((a) => a.id === id);
    if (index < 0) assets.push(entry);
    else assets[index] = entry;
    images.push({
      id,
      path,
      zipEntry: `SC${m[1]}/LE_CG_EP01_ACT04_SC${m[1]}_IMG${m[2]}_v0.1.png`,
      width,
      height,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
if (images.length !== 20 || new Set(images.map((i) => i.id)).size !== 20)
  throw Error('Expected twenty unique corrected CGs');
const characters = (await readJson('characters/index.json')) as Record<string, string>;
for (const [id, name] of Object.entries(roles)) if (!characters[id]) characters[id] = name;
const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
manifest.version = '0.6.0-ep01-act04-v0.4';
for (const key of Object.keys(act04CompletionFlags))
  manifest.flags[key] ??= {
    initial: false,
    description: `ACT IV固定結果事實：${key}；不作選項獎懲。`,
  };
Object.assign(
  manifest.chapters.find((c) => c.id === 'EP01')!,
  { title: '王冠之前 · ACT I–IV', status: 'DRAFT_AVAILABLE' }
);
const write = (path: string, value: unknown) =>
  writeFile(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
await write('content/episodes/ep01/chapter.json', chapter);
await write('content/manifests/assets.json', assets);
await write('content/manifests/story.json', manifest);
await write('content/characters/index.json', characters);
await write('docs/ep01-act04-import-report.json', {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'DRAFT',
  sourceScenes: 5,
  playbackNodes: scenes.length,
  segments: scenes.reduce((n, s) => n + s.segments.length, 0),
  choicePoints: 5,
  options: 15,
  choiceEffects: 'NONE',
  completionFlags: act04CompletionFlags,
  images,
  notes: [
    '黑場開場保留正文「……大公主。」及下一句「大公主，別睡了。」；第一張圖前不顯示或解鎖CG',
    '使用修正版v0.1原圖；正文v0.4。第一人稱醒來構圖備註保留在directions，不作玩家旁白',
    '選項的王女回答在所選分支重現一次，以便回顧與存讀；問題依原稿場景索引補問號作UI提示',
    '舞台備註、轉場、聲音提示不作台詞；未附音訊，不新增配樂；淡出更衣使用既有CG切換淡化',
    'SC04僅兄妹會面，芬利不在場。末尾漸暗不計CG；接見僅請求，許可false，攝政false',
    '父女會面留ACT V待提供；不結算EP01全章。原稿與舊幕均保留DRAFT',
  ],
});
console.log(
  `Imported 5 source scenes / ${scenes.length} playback nodes / ${scenes.reduce((n, s) => n + s.segments.length, 0)} paragraphs across all branches / 20 corrected CG / 5 flavor choices.`
);
