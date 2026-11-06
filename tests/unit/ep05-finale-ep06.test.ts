import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, loadReaderContent, root } from '../../scripts/load-content';
import {
  initialState,
  advance,
  choose,
  markRead,
  currentCg,
  visibleSegments,
  continueChapter,
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  openDirectorySection,
  continueCommittedChoice,
} from '../../packages/narrative-core/directory';
import { validateStory } from '../../packages/narrative-core/validate';
import { auditSpeakers } from '../../scripts/speaker-annotations';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story, GameState } from '../../packages/narrative-core/schema';
import report from '../../docs/ep05-finale-ep06-import-report.json' with { type: 'json' };
let story: Story;
beforeAll(async () => {
  story = await loadReaderContent();
});
function at(id: string, pp = 100, flags: Record<string, string | boolean> = {}) {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  s.campaign!.politicalPoints = pp;
  Object.assign(s.flags, flags);
  return s;
}
function walk(state: GameState, answers: string[] = []) {
  let ai = 0;
  const images = new Set<string>();
  const text: string[] = [];
  for (let guard = 0; guard < 2200; guard++) {
    const scene = story.scenes[state.currentSceneId],
      segments = visibleSegments(story, state);
    text.push(segments[state.currentSegmentIndex].text);
    const cg = currentCg(story, state);
    if (cg) images.add(cg);
    if (state.currentSegmentIndex === segments.length - 1 && scene.kind === 'choice')
      state = choose(story, state, answers[ai++] ?? 'A');
    else if (state.currentSegmentIndex === segments.length - 1 && scene.kind === 'end')
      return { state: markRead(story, state), images, text: text.join('\n') };
    else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  throw Error('Story did not end');
}
it('has fifteen ordered sections, six effective decisions, explicit speakers and no production notes in player text', () => {
  expect(validateStory(story).errors).toEqual([]);
  expect(auditSpeakers(story).errors).toEqual([]);
  const scenes = Object.values(story.scenes).filter(
    (s) =>
      s.id.startsWith('EP05_ACT05') || (s.chapter === 'EP06' && ['ACT01', 'ACT02'].includes(s.act))
  );
  expect(scenes).toHaveLength(32);
  expect(scenes.filter((s) => s.kind === 'choice')).toHaveLength(6);
  expect(scenes.flatMap((s) => s.choices)).toHaveLength(18);
  expect(scenes.flatMap((s) => s.segments)).toHaveLength(894);
  for (const scene of scenes)
    for (const p of scene.segments)
      expect(p.text).not.toMatch(
        /ACT\s*\d|\bEP\d|\bSC\d|\bCG\b|下一章|上一章|本章|本幕|鏡頭|前台|隱藏|結算|匯合|資產/iu
      );
  const dir = chapterDirectory(story);
  expect(dir.find((c) => c.id === 'EP05')!.acts.map((a) => a.sections.length)).toEqual([
    5, 5, 5, 5, 5,
  ]);
  expect(dir.find((c) => c.id === 'EP06')!.acts.map((a) => a.sections.length)).toEqual([
    5, 5, 5, 5, 5,
  ]);
});
it('uses all 71 complete original PNGs with exact archive hashes and dimensions', async () => {
  let count = 0;
  const used = new Set(
    Object.values(story.scenes).flatMap((s) => [s.cg, ...s.segments.map((p) => p.cg)])
  );
  for (const path of ['ep05/act05', 'ep06/act01', 'ep06/act02']) {
    const a = JSON.parse(
      await readFile(`${root}/content/sources/${path}/asset-audit.json`, 'utf8')
    );
    for (const image of a.images) {
      const b = await readFile(`${root}/${image.path}`);
      expect(createHash('sha256').update(b).digest('hex')).toBe(image.sha256);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([image.width, image.height]);
      expect(used.has(image.id)).toBe(true);
      count++;
    }
  }
  expect(count).toBe(71);
});
it('follows all three transfer paths and preserves their consequences into EP06 without inventing CLEAR or resource awards', () => {
  for (const answers of [['A'], ['B', 'A'], ['B', 'B']]) {
    const success = answers.at(-1) === 'A';
    const start = at('EP05_ACT05_SC01');
    const result = walk(start, answers);
    expect(result.state.flags.T1_STATUS).toBe(success ? 'SUCCESS' : 'FAILED');
    expect(result.state.flags.S1_STATUS).toBe(success ? 'SUCCESS' : 'FAILED');
    expect(result.state.flags.ROUENNE_TRANSFER_APPROVED).toBe(success);
    expect(result.state.flags.F2_INVESTIGATION_PENDING).toBe(true);
    expect(result.state.flags.F2_LEDGER_ANOMALY_FOUND).toBe(true);
    expect(result.state.campaign!.politicalPoints).toBe(100);
    expect(result.state.campaign!.unrest).toBe(30);
    expect(result.state.clear).toEqual(start.clear);
    expect(result.images.has('EP05-ACT05-CG14')).toBe(answers[0] === 'B');
    for (const n of ['15', '16', '18'])
      expect(result.images.has('EP05-ACT05-CG' + n)).toBe(success);
    for (const n of ['17', '19']) expect(result.images.has('EP05-ACT05-CG' + n)).toBe(!success);
    const entered = continueChapter(story, result.state);
    expect(entered.currentSceneId).toBe('EP06_ACT01_SC01');
    const next = walk(entered, ['1']);
    expect(next.images.has('EP06-ACT01-CG04A')).toBe(success);
    expect(next.images.has('EP06-ACT01-CG04B')).toBe(!success);
    expect(next.state.flags.T1_STATUS).toBe(result.state.flags.T1_STATUS);
  }
});
it('applies the five authored first-act scores once and preserves their outcome-specific dialogue in ACT02', () => {
  const lines = [
    '王都先請我們補齊軍情',
    '教會接到王都先前願意配合',
    '王都援軍的調度命令',
    '王都這幾天沒有再追加',
    '我們當時還在等王都回覆',
  ];
  for (let i = 0; i < 5; i++) {
    const a = walk(at('EP06_ACT01_SC01'), [String(i + 1)]);
    expect(a.state.campaign!.politicalPoints).toBe(100 + [5, -1, -2, -3, -5][i]);
    expect(a.state.flags.EP06_ACT01_DECISION).toBe(String(i + 1));
    const b = walk(continueChapter(story, a.state), ['B', 'B', 'B']);
    for (let j = 0; j < 5; j++) expect(b.text.includes(lines[j])).toBe(j === i);
    expect(b.state.flags.ELLA_DEPARTED_FOR_AOTEDAN).toBe(true);
  }
});
it('executes all 405 transfer / ACT01 / ACT02 combinations with exact signed resources, isolated dynamic endings and event status', () => {
  const variants = new Set<string>();
  for (const transfer of ['DIRECT', 'QUESTION_ACCEPT', 'REJECT'])
    for (const dec of ['1', '2', '3', '4', '5'])
      for (const c1 of 'ABC')
        for (const c2 of 'ABC')
          for (const c3 of 'ABC') {
            const combo = c1 + c2 + c3;
            const initial = at('EP06_ACT02_SC01', 100, {
              ROUENNE_TRANSFER_APPROVED: transfer !== 'REJECT',
              EP06_ACT01_DECISION: dec,
            });
            const result = walk(initial, [c1, c2, c3]);
            const expected =
              100 +
              [c1, c2, c3].reduce((sum, c) => sum + (c === 'A' ? -10 : c === 'B' ? 10 : 0), 0);
            expect(result.state.campaign!.politicalPoints).toBe(expected);
            expect(result.state.campaign!.unrest).toBe(
              30 + [c1, c2, c3].reduce((sum, c) => sum + (c === 'A' ? -5 : c === 'C' ? 10 : 0), 0)
            );
            expect(result.state.flags.A1_STATUS).toBe(combo === 'CCC' ? 'FAILED' : 'SUCCESS');
            expect(result.state.flags.EP06_DISASTER_PERSONALLY_INSPECTED).toBe(true);
            expect(result.state.clear).toEqual(initial.clear);
            expect(result.state.politicalRoute).toBe('NONE');
            expect(result.state.tarotRoute).toBe('NONE');
            for (const [i, key] of ['B1_FINLEY', 'B2_SHALIA', 'B3_OFFICIALS'].entries())
              expect(result.state.flags[key]).toBe(combo[i] === 'B');
            const matches = Object.entries(report.dynamicEndings).filter(([, cs]) =>
              cs.includes(combo)
            );
            expect(matches).toHaveLength(1);
            variants.add(matches[0][0]);
            const dynamicLines = report.uses.filter(
              (u) => u.origin === 'DYNAMIC' && u.sceneId === result.state.currentSceneId
            );
            const scene = story.scenes[result.state.currentSceneId];
            const visibleIds = new Set(visibleSegments(story, result.state).map((p) => p.id));
            for (const use of dynamicLines.filter((u) => visibleIds.has(u.segmentId))) {
              const p = scene.segments.find((p) => p.id === use.segmentId)!;
              expect(result.text).toContain(p.text);
            }
            expect(result.state.readChapters).not.toContain('EP06');
            expect(scene.completion?.scope).toBe('ACT');
            expect(scene.completion?.nextSceneId).toBe('EP06_ACT03_SC01');
          }
  expect(variants.size).toBe(11);
}, 30000);
it('guards insufficient costs, clamps unrest, and never pays again on committed replay or save restore', () => {
  const scene = story.scenes.EP06_ACT02_SC04;
  const poor = at(scene.id, 9);
  poor.currentSegmentIndex = visibleSegments(story, poor).length - 1;
  expect(choiceUnavailableReason(poor, scene.choices[0])).toContain('不足');
  expect(() => choose(story, poor, 'A')).toThrow('不足');
  const edge = at(scene.id, 10);
  edge.campaign!.unrest = 2;
  edge.currentSegmentIndex = visibleSegments(story, edge).length - 1;
  const chosen = choose(story, edge, 'A');
  expect(chosen.campaign!.politicalPoints).toBe(0);
  expect(chosen.campaign!.unrest).toBe(0);
  const saved = restoreSave(chosen, story).state;
  expect(saved.campaign).toEqual(chosen.campaign);
  const replay = openDirectorySection(story, saved, scene.id, true);
  replay.currentSegmentIndex = visibleSegments(story, replay).length - 1;
  expect(() => choose(story, replay, 'A')).toThrow('already committed');
  expect(continueCommittedChoice(story, replay).campaign).toEqual(chosen.campaign);
  const high = at(scene.id);
  high.campaign!.unrest = 95;
  high.currentSegmentIndex = visibleSegments(story, high).length - 1;
  expect(choose(story, high, 'C').campaign!.unrest).toBe(100);
});
it('upgrades old EP05 ACT04 saves, completes the fifth chapter and charges EP06 upkeep only once', () => {
  const id = 'EP05_ACT04_SC05',
    old = at(id, 100);
  old.currentSegmentIndex = visibleSegments(story, old).length - 1;
  old.contentVersion = '0.13.1-ep05-act04-cg-complete';
  old.campaign!.unrest = 65;
  for (const k of ['T1_STATUS', 'S1_STATUS', 'ROUENNE_TRANSFER_APPROVED']) delete old.flags[k];
  const restored = restoreSave(old, story);
  expect(restored.notices.length).toBeGreaterThan(0);
  const next = continueChapter(story, restored.state);
  expect(next.currentSceneId).toBe('EP05_ACT05_SC01');
  expect(next.campaign!.politicalPoints).toBe(100);
  const end = walk(next, ['B', 'A']);
  const ep6 = continueChapter(story, end.state);
  expect(ep6.campaign!.politicalPoints).toBe(90);
  expect(ep6.campaign!.upkeep.filter((u) => u.chapter === 'EP06')).toHaveLength(1);
  const end1 = walk(ep6, ['1']);
  const second = continueChapter(story, end1.state);
  expect(second.campaign!.politicalPoints).toBe(95);
  expect(second.campaign!.upkeep.filter((u) => u.chapter === 'EP06')).toHaveLength(1);
});
