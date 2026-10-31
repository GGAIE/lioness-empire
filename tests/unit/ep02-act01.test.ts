import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { root, loadContent, readJson } from '../../scripts/load-content';
import { parseEp02Act01 } from '../../scripts/ep02-act01-parser';
import {
  advance,
  choose,
  currentCg,
  initialState,
  markRead,
  continueChapter,
} from '../../packages/narrative-core/engine';
import { openingCost } from '../../packages/narrative-core/campaign';
import {
  navigableScenes,
  openDirectorySection,
  chapterDirectory,
} from '../../packages/narrative-core/directory';
import { validateStory } from '../../packages/narrative-core/validate';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
import review from '../../content/sources/ep02/act01-speakers-v0.9.json' with { type: 'json' };
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function ending() {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT05_SC01' } });
  s.currentSceneId = 'EP01_ACT05_SC05_COMMON';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  s.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  s.decisionLog = [
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
    ...['01', '02', '03', '04', '05'].flatMap((n) => [
      `EP01_ACT04_SC${n}:B`,
      `EP01_ACT05_SC${n}:C`,
    ]),
  ];
  return s;
}
it('imports 25 nodes, 312 paragraphs, 20 CGs and five zero-effect decisions with no new permanent flags', async () => {
  const parsed = parseEp02Act01(
    await readFile(root + '/content/sources/ep02/source-act01-v0.9.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(25);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(312);
  expect(parsed.scenes.filter((s) => s.kind === 'choice')).toHaveLength(5);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(15);
  for (const s of parsed.scenes) {
    expect(s).toEqual(story.scenes[s.id]);
    expect(s.completionFlags).toBeUndefined();
    for (const c of s.choices) expect(c.effects).toEqual([]);
  }
  for (const n of [1, 2, 3, 4, 5])
    expect(
      parsed.scenes
        .filter((s) => s.sceneNumber === n)
        .flatMap((s) => s.segments.filter((p) => p.cg))
    ).toHaveLength(4);
  expect(chapterDirectory(story)[2].acts[0].sections).toHaveLength(5);
  expect(chapterDirectory(story)[2].title).toBe('留下來的人');
  expect(story.assets.find((a) => a.id === 'EP02-ACT01-CG04-02')?.src).toMatch(/v0\.9-r2\.png$/);
});
it('plays all 243 combinations with the same chronology, CGs, resources, facts and prior decisions', () => {
  for (let route = 0; route < 243; route++) {
    let s = continueChapter(story, ending()),
      code = route;
    const before = structuredClone(s),
      answers: string[] = [],
      images = new Set<string>(),
      sequence: number[] = [];
    for (let i = 0; i < 5; i++) {
      answers.push(['A', 'B', 'C'][code % 3]);
      code = Math.floor(code / 3);
    }
    let decisions = 0;
    for (let step = 0; step < 400; step++) {
      const scene = story.scenes[s.currentSceneId],
        cg = currentCg(story, s);
      if (cg) images.add(cg);
      if (!sequence.includes(scene.sceneNumber!)) sequence.push(scene.sceneNumber!);
      const last = s.currentSegmentIndex === scene.segments.length - 1;
      s = markRead(story, s);
      if (last && scene.kind === 'end') break;
      s =
        last && scene.kind === 'choice'
          ? choose(story, s, answers[decisions++])
          : advance(story, s);
    }
    expect(decisions).toBe(5);
    expect(sequence).toEqual([1, 2, 3, 4, 5]);
    expect(images.size).toBe(20);
    expect(s.history.length - before.history.length).toBe(270 + (answers[4] === 'C' ? 2 : 0));
    expect(s.flags).toEqual(before.flags);
    expect(s.clear).toEqual(before.clear);
    expect(s.campaign).toEqual(before.campaign);
    expect(s.politicalScore).toBe(before.politicalScore);
    expect(s.politicalRoute).toBe(before.politicalRoute);
    expect(s.tarotRoute).toBe(before.tarotRoute);
    expect(s.decisionLog).toEqual([
      ...before.decisionLog,
      ...answers.map((a, i) => `EP02_ACT01_SC${String(i + 1).padStart(2, '0')}:${a}`),
    ]);
    expect(s.readChapters).toContain('EP01');
    expect(s.readChapters).not.toContain('EP02');
    expect(continueChapter(story, s).currentSceneId).toBe('EP02_ACT02_SC01');
  }
}, 60000);
it('charges once on new chapter entry, not at EP01 completion or when replaying through the directory', () => {
  let s = ending();
  s.campaign!.politicalPoints = 100;
  s.campaign!.unrest = 80;
  const original = structuredClone(s);
  const sourceState = s;
  const read = markRead(story, s);
  expect(read.campaign).toEqual(original.campaign);
  s = continueChapter(story, s);
  expect(sourceState).toEqual(original);
  expect(s.campaign!.politicalPoints).toBe(100 - openingCost(story.plan!, 'EP02', 80)!);
  expect(s.campaign!.upkeep).toEqual([{ chapter: 'EP02', unrest: 80, cost: 40 }]);
  expect(s.campaign!.completedChapters).toContain('EP01');
  expect(s.campaign!.completedChapters).not.toContain('EP02');
  s = openDirectorySection(story, s, 'EP01_ACT01_SC01');
  s = openDirectorySection(story, s, 'EP02_ACT01_SC01');
  expect(s.campaign!.politicalPoints).toBe(60);
  expect(s.campaign!.upkeep).toHaveLength(1);
  expect(s.currentSceneId).toBe('EP02_ACT01_SC01');
});
it('blocks early or insufficient entry without mutating the source save', () => {
  const legacy = ending();
  delete legacy.campaign;
  expect(() => continueChapter(story, legacy)).toThrow('缺少可結算的玩家數值');
  const fresh = initialState(story);
  expect(navigableScenes(story, fresh).has('EP02_ACT01_SC01')).toBe(false);
  expect(() => openDirectorySection(story, fresh, 'EP02_ACT01_SC01')).toThrow();
  const low = ending();
  low.campaign!.politicalPoints = 5;
  low.campaign!.unrest = 80;
  const raw = structuredClone(low);
  expect(() => continueChapter(story, low)).toThrow('點數不足');
  expect(low).toEqual(raw);
});
it('keeps every reviewed speaker, inner monologue and quoted narrative distinct across save/restore', () => {
  expect(review.annotations).toHaveLength(109);
  for (const row of review.annotations) {
    const p = story.scenes[row.sceneId].segments.find((p) => p.id === row.segmentId)!;
    expect(p.text).toBe(row.text);
    expect(p.speaker).toBe(row.speaker);
    expect(p.kind).toBe(row.kind);
  }
  expect(story.scenes.EP02_ACT01_SC02_C.segments[3]).toMatchObject({
    kind: 'thought',
    speaker: 'OLIVIA',
  });
  expect(story.scenes.EP02_ACT01_SC05_COMMON.segments[3]).toMatchObject({
    kind: 'thought',
    speaker: 'OLIVIA',
  });
  expect(story.scenes.EP02_ACT01_SC02.segments[18].speaker).toBeUndefined();
  let s = continueChapter(story, ending());
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  s = choose(story, s, 'C');
  expect(restoreSave(JSON.parse(JSON.stringify(s)), story).state).toEqual(s);
  const cyclic = structuredClone(story);
  cyclic.scenes.EP02_ACT01_SC01.choices[0].effects = [{ type: 'score', delta: 1 }];
  expect(validateStory(cyclic).errors.some((e) => e.includes('forbids effective choices'))).toBe(
    true
  );
});
it('preserves all source prose and validates every original PNG against the supplied manifest', async () => {
  const source = await readFile(root + '/content/sources/ep02/source-act01-v0.9.md', 'utf8'),
    prose = source.slice(source.indexOf('### [CG01]'), source.indexOf('# 第二部分｜20 張 CG')),
    segments = Object.values(story.scenes)
      .filter((s) => s.chapter === 'EP02')
      .flatMap((s) => s.segments);
  for (const raw of prose.split(/\r?\n/)) {
    const line = raw.trim();
    if (
      !line ||
      line === '---' ||
      line.startsWith('#') ||
      /^\*\*(?:[ABC]｜|場景結束|轉入|時間|地點|CG|場景目的)/.test(line)
    )
      continue;
    const text = line.replace(/\*\*/g, '');
    expect(
      segments.some((s) => s.text === text || text.endsWith('：' + s.text)),
      text
    ).toBe(true);
  }
  const report = (await readJson('../docs/ep02-act01-import-report.json')) as {
      sourceSha256: string;
      images: { path: string; zipEntry: string; sha256: string }[];
    },
    manifest = (await readJson('sources/ep02/image-manifest-v0.9.json')) as {
      File: string;
      SHA256: string;
    }[];
  expect(createHash('sha256').update(source).digest('hex')).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(20);
  for (const image of report.images) {
    expect(
      createHash('sha256')
        .update(await readFile(root + '/' + image.path))
        .digest('hex')
    ).toBe(image.sha256);
    expect(manifest.find((r) => r.File === image.zipEntry)?.SHA256.toLowerCase()).toBe(
      image.sha256
    );
  }
});
