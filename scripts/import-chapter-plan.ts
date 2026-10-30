import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  CampaignPlanSchema,
  validatePlan,
  type CampaignPlan,
} from '../packages/narrative-core/campaign-schema';
import { root, readJson } from './load-content';

// A deterministic adapter for this supplied v0.1 Markdown format. No text is invented or executed.
const sourceArgument = process.argv.indexOf('--source');
const sourcePath =
  sourceArgument >= 0
    ? resolve(process.argv[sourceArgument + 1])
    : resolve(root, 'content/planning/source-v0.1.md');
const bytes = await readFile(sourcePath),
  text = bytes.toString('utf8').replace(/^\uFEFF/, '');
const sourceFile = 'planning/source-v0.1.md',
  lines = text.split(/\r?\n/);
const ref = (line: number) => ({ file: sourceFile, line });
const headers = [...text.matchAll(/^### (Prologue|EP\d{2}) (.+)$/gm)];
if (headers.length !== 13)
  throw Error('Expected exactly Prologue + EP01–EP12 headings; import aborted.');
const lineOf = (index: number) => text.slice(0, index).split('\n').length;
const idFor = (raw: string) => (raw === 'Prologue' ? 'PROLOGUE' : raw);
const chapters: CampaignPlan['chapters'] = headers.map((h, i) => {
  const end = headers[i + 1]?.index ?? text.indexOf('\n## 四', h.index);
  const section = text.slice(h.index! + h[0].length, end < 0 ? undefined : end).trim();
  const baseLine = lineOf(h.index!);
  const actMatches = [...section.matchAll(/^- ACT (I|II|III|IV|V) (.+)$/gm)];
  const id = idFor(h[1]);
  if (id !== 'PROLOGUE' && actMatches.length !== 5)
    throw Error(`Expected 5 acts in ${id}; import aborted.`);
  const paragraph = section.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('- ACT '));
  const source = ref(baseLine);
  const acts =
    id === 'PROLOGUE'
      ? [
          {
            id: 'PROLOGUE_ACT01',
            number: 1,
            label: '登基鏡框',
            summary: paragraph.find((l) => l.startsWith('演出提案：')) ?? paragraph[0],
            decision: 'NONE' as const,
            authoringStatus: 'NOT_AUTHORED' as const,
            source,
          },
        ]
      : actMatches.map((a, j) => ({
          id: `${id}_ACT${String(j + 1).padStart(2, '0')}`,
          number: j + 1,
          label: ['開場', '問題', '承擔', '轉折', '支線／收束'][j],
          summary: a[2],
          decision:
            id === 'EP12' || j === 0
              ? ('NONE' as const)
              : j === 4
                ? ('SIDE_SLOT' as const)
                : ('MAIN_SLOT' as const),
          authoringStatus: 'NOT_AUTHORED' as const,
          source: ref(lineOf(text.indexOf(a[0], h.index))),
        }));
  return {
    id,
    title: h[2].trim(),
    order: i,
    summary: paragraph[0] ?? '',
    notes: paragraph.slice(1),
    next: i === 12 ? null : `EP${String(i + 1).padStart(2, '0')}`,
    availability: 'NOT_YET_AVAILABLE',
    acts,
    source,
  };
});
const aliases = { 艾琳達: 'alinda', 莎莉亞: 'shalia', 塔瑪拉: 'tamara', 芬利: 'finley' } as const;
const events: CampaignPlan['events'] = [];
for (const [i, line] of lines.entries()) {
  const m = line.match(
    /^\| (艾琳達|莎莉亞|塔瑪拉|芬利) \| ([ASTF][1-8]) (.+?) \| (EP\d{2})(?:至(EP\d{2}))? \|$/
  );
  if (!m) continue;
  const character = aliases[m[1] as keyof typeof aliases];
  const first = Number(m[4].slice(2)),
    last = m[5] ? Number(m[5].slice(2)) : first;
  const eventChapters = Array.from(
    { length: last - first + 1 },
    (_, j) => `EP${String(first + j).padStart(2, '0')}`
  );
  events.push({
    id: m[2],
    character,
    sourceName: m[1],
    title: m[3],
    chapters: eventChapters,
    parts: eventChapters.map((chapter, j) => ({
      id: `${m[2]}_PART${j + 1}`,
      chapter,
      actId: `${chapter}_ACT05`,
      clearAward: null,
    })),
    entryStatus: m[2] === 'A4' ? 'UNRESOLVED' : 'PLANNED',
    entryNote:
      m[2] === 'A4'
        ? 'A≥4 與前期里程碑僅為觸發方向；入口尚未核定。'
        : '章節／支線組合為初步規劃，不自動視為事件已完成或獲得 CLEAR。',
    source: ref(i + 1),
  });
}
const unresolvedStart = lines.findIndex((l) => l.startsWith('## 八'));
const unresolved = lines.slice(unresolvedStart + 1).flatMap((line, j) => {
  const m = line.match(/^(\d+)\. (.+)$/);
  return m
    ? [
        {
          id: `QUESTION_${m[1].padStart(2, '0')}`,
          summary: m[2],
          source: ref(unresolvedStart + j + 2),
        },
      ]
    : [];
});
const overrides = existsSync(resolve(root, 'content/planning/mechanics-overrides.json'))
  ? z
      .object({
        initialPoliticalPoints: z.number().int().min(0),
        initialUnrest: z.number().int().min(0).max(100),
        source: z.string().min(1),
      })
      .strict()
      .parse(await readJson('planning/mechanics-overrides.json'))
  : null;
const plan = CampaignPlanSchema.parse({
  choiceResolution: 'AUTHORED_FIXED',
  decisions: existsSync(resolve(root, 'content/planning/part-one.json'))
    ? (((await readJson('planning/part-one.json')) as CampaignPlan).decisions ?? [])
    : [],
  schemaVersion: 1,
  id: 'PART_I',
  version: '0.1.0-planning',
  status: 'PLANNING_DRAFT',
  source: {
    file: sourceFile,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    version: 'v0.1',
    scope: '使用者提供的逐章初步規劃；章節摘要與場景先後仍是提案，未含正式對白。',
  },
  chapters,
  events,
  rules: {
    resource: {
      definition: '執行選項付出的政治資源；與舊版政治存續 PS 分開。',
      initial: overrides?.initialPoliticalPoints ?? null,
      maximum: null,
      insufficient: 'UNRESOLVED',
      zeroOutcome: 'UNRESOLVED',
      bands: [
        { min: 0, max: 59, cost: 0 },
        { min: 60, max: 79, cost: 10 },
        { min: 80, max: 100, cost: 40 },
      ],
      prologue: 'NO_SCORING',
      ep12: 'UNRESOLVED',
    },
    unrest: { min: 0, max: 100, initial: overrides?.initialUnrest ?? null, changes: 'UNRESOLVED' },
    clearCaps: { alinda: 7, finley: 10, tamara: 6, shalia: 6 },
    alliance: { chapter: 'EP06', act: 3 },
    reinforcement: { chapter: 'EP09', act: 4 },
    xi: {
      route: 'STAR',
      requiredEvent: 'A4',
      requiredFlags: [
        { id: 'EP11_PUBLISH', label: 'EP11 選擇公開紀錄 PUBLISH' },
        { id: 'GOVERNANCE_RECORD_COMPLETE', label: '第一部治理紀錄完整' },
        { id: 'SOURCE_CHAIN_COMPLETE', label: '治理紀錄來源鏈完整' },
        { id: 'UNRESOLVED_TRUTHS_RECORDED', label: '如實記錄未決事項' },
        { id: 'ALINDA_BOUNDED_COOPERATION', label: '艾琳達有界線的合作' },
        { id: 'FINAL_AGREEMENT', label: '最終協議成立' },
      ],
      commonGate: 'UNRESOLVED',
      nielsEntry: 'UNRESOLVED',
      fatherCaseRequired: false,
      bloodlineProofRequired: false,
    },
  },
  aliases: [
    { id: 'OLIVIA', existingName: '奧莉薇雅', sourceName: '奧莉維亞', status: 'REVIEW_REQUIRED' },
    { id: 'SHALIA', existingName: '莎莉雅', sourceName: '莎莉亞', status: 'REVIEW_REQUIRED' },
    { id: 'TAMARA', existingName: '塔娜拉', sourceName: '塔瑪拉', status: 'REVIEW_REQUIRED' },
  ],
  unresolved: unresolved.map((item) =>
    item.id === 'QUESTION_04' && overrides
      ? {
          ...item,
          summary: `初始值已確認：政治點數 ${overrides.initialPoliticalPoints}、動盪 ${overrides.initialUnrest}。仍待確認政治點數上限、消耗不足與歸零規則，以及舊 PS45 門檻是否廢除或重訂。`,
        }
      : item
  ),
});
const errors = validatePlan(plan);
if (errors.length) throw Error(errors.join('\n'));
// Verify the original input before touching any destination. Existing narrative IDs remain untouched.
await mkdir(resolve(root, 'content/planning'), { recursive: true });
if (sourcePath !== resolve(root, 'content', sourceFile))
  await copyFile(sourcePath, resolve(root, 'content', sourceFile));
await writeFile(
  resolve(root, 'content/planning/part-one.json'),
  JSON.stringify(plan, null, 2) + '\n'
);
const manifest = (await readJson('manifests/story.json')) as {
  chapters: { id: string; title: string; status?: string }[];
  planningFile?: string;
};
manifest.planningFile = 'planning/part-one.json';
for (const chapter of manifest.chapters) {
  const p = plan.chapters.find((c) => c.id === chapter.id);
  if (p && chapter.status === 'NOT_YET_AVAILABLE') chapter.title = p.title;
}
await writeFile(
  resolve(root, 'content/manifests/story.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);
// Preserve the old test model and retire only gates invalidated by the new resource/XI definitions.
const archive = resolve(root, 'content/endings/legacy-v2-rules.json');
try {
  await access(archive);
} catch {
  await copyFile(resolve(root, 'content/endings/rules.json'), archive);
}
const rules = (await readJson('endings/rules.json')) as {
  id: string;
  status: string;
  when?: unknown;
  reason: string;
  source: string;
}[];
for (const r of rules) {
  if (['ARCANA_06', 'ARCANA_07', 'ARCANA_11', 'ARCANA_12', 'ARCANA_21'].includes(r.id)) {
    r.status = 'UNRESOLVED';
    delete r.when;
    r.reason =
      r.id === 'ARCANA_11'
        ? '新版 XI：Star、尼爾斯跨章成功、EP11 PUBLISH、治理來源鏈、未決事項與有界線的合作；共通門檻待校準。父親案不要求第一部結案。'
        : '新政治資源與舊 PS 定義不同，此結局門檻待重新校準；不沿用歸零或45分判定。';
    r.source = 'planning/source-v0.1.md §二、§六';
  }
}
await writeFile(resolve(root, 'content/endings/rules.json'), JSON.stringify(rules, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      chapters: plan.chapters.length,
      actNodes: plan.chapters.flatMap((c) => c.acts).length,
      events: plan.events.length,
      parts: plan.events.flatMap((e) => e.parts).length,
      unresolved: plan.unresolved.length,
      sha256: plan.source.sha256,
    },
    null,
    2
  )
);
