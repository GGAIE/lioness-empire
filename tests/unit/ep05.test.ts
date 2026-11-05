import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, root } from '../../scripts/load-content';
import {
  initialState,
  visibleSegments,
  advance,
  choose,
  continueChapter,
  markRead,
  currentCg,
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import { chapterDirectory } from '../../packages/narrative-core/directory';
import { validateStory } from '../../packages/narrative-core/validate';
import { auditSpeakers } from '../../scripts/speaker-annotations';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story, GameState } from '../../packages/narrative-core/schema';
import { explorationKey } from '../../scripts/exploration-key';
import report from '../../docs/ep05-import-report.json' with { type: 'json' };
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function at(id = 'EP05_ACT01_SC01', points = 100, flags: Record<string, string | boolean> = {}) {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  s.campaign!.politicalPoints = points;
  Object.assign(s.flags, flags);
  return s;
}
function run(state: GameState, answers: string[] = [], cross = false) {
  let i = 0;
  const images = new Set<string>(),
    ends: GameState[] = [];
  for (let guard = 0; guard < 3000; guard++) {
    const scene = story.scenes[state.currentSceneId];
    const cg = currentCg(story, state);
    if (cg) images.add(cg);
    const last = state.currentSegmentIndex === visibleSegments(story, state).length - 1;
    if (last && scene.kind === 'choice') {
      state = choose(
        story,
        state,
        scene.choices[answers[i] === undefined ? 0 : Number(answers[i])].id
      );
      i++;
    } else if (last && scene.kind === 'end') {
      state = markRead(story, state);
      ends.push(structuredClone(state));
      if (!cross || !scene.completion?.nextSceneId) return { state, images, ends };
      state = continueChapter(story, state);
    } else state = advance(story, state);
    // Keep this exhaustive resource/CG simulation small; history preservation is separately tested.
    state.history = [];
    state.readSegments = [];
  }
  throw Error('Unterminated story');
}
it('imports 20 ordered sections and all 19 choices with complete tagged speaker/source coverage', async () => {
  expect(validateStory(story).errors).toEqual([]);
  expect(auditSpeakers(story).errors).toEqual([]);
  const scenes = Object.values(story.scenes).filter(
    (s) => s.chapter === 'EP05' && s.act !== 'ACT05'
  );
  expect(scenes).toHaveLength(95);
  expect(scenes.filter((s) => s.kind === 'choice')).toHaveLength(19);
  expect(scenes.filter((s) => s.choiceMode === 'DIALOGUE_FLAVOR')).toHaveLength(14);
  const directory = chapterDirectory(story).find((c) => c.id === 'EP05')!;
  expect(directory.acts.map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
  for (const act of directory.acts.slice(0, 4))
    for (const section of act.sections)
      expect(section.sceneIds[0]).toBe(
        `EP05_${act.id}_SC${String(section.number).padStart(2, '0')}`
      );
  for (const act of [1, 2, 3, 4]) {
    const scene = scenes.find((s) => s.act === `ACT0${act}`)!;
    const rows = (await readFile(`${root}/content/${scene.source}`, 'utf8')).split(/\r?\n/);
    for (const [i, row] of rows.entries()) {
      if (
        !/【(?:旁白|共通旁白|奧莉維亞[^】]*|芬利[^】]*|艾拉[^】]*|格拉斯|瑪蕾娜|尤里斯|米耶爾|塔[馬瑪]拉[^】]*|侍從|魔法守衛|流亡貴族代表|王宮官員 NPC)】.+/.test(
          row
        )
      )
        continue;
      // ACT01 appendix contains illustrative follow-up, replaced by the full ACT02 source.
      if (act === 1 && i + 1 >= 414) break;
      expect(
        report.uses.some((u) => u.act === act && u.line === i + 1),
        `${act}:${i + 1}`
      ).toBe(true);
    }
  }
});
it('keeps all 91 complete PNGs byte-identical, including the repaired final illustration', async () => {
  const used = new Set(
    Object.values(story.scenes).flatMap((s) => [s.cg, ...s.segments.map((p) => p.cg)])
  );
  let count = 0;
  for (const act of [1, 2, 3, 4]) {
    const audit = JSON.parse(
      await readFile(`${root}/content/sources/ep05/act0${act}/asset-audit.json`, 'utf8')
    );
    for (const a of audit.images) {
      const b = await readFile(`${root}/${a.path}`);
      expect(createHash('sha256').update(b).digest('hex')).toBe(a.sha256);
      expect(used.has(a.id)).toBe(true);
      count++;
    }
    expect(audit.missing).toEqual([]);
    if (act === 4) {
      expect(audit.images).toHaveLength(23);
      expect(audit.supplements).toHaveLength(2);
    }
  }
  expect(count).toBe(91);
  expect(story.assets.find((a) => a.id === 'EP05-ACT04-CG23')?.status).toBe('APPROVED');
});
it('executes all 72 consequential combinations, with deferred separate ledgers, route CG isolation and no premature chapter settlement', () => {
  for (let c1 = 0; c1 < 2; c1++)
    for (let c2 = 0; c2 < 2; c2++)
      for (let c3 = 0; c3 < 2; c3++)
        for (let rep = 0; rep < 3; rep++)
          for (let staff = 0; staff < 3; staff++) {
            const a1 = run(at(), [String(c1), String(c2), String(c3)]);
            expect(a1.state.campaign!.politicalPoints).toBe(100);
            expect(a1.state.flags.EP05_PORT_POLITICAL_SETTLED).toBe(false);
            expect(a1.images.has('EP05-ACT01-CG18-K')).toBe(c3 === 0);
            expect(a1.images.has('EP05-ACT01-CG18-R')).toBe(c3 === 1);
            const a2 = run(continueChapter(story, a1.state), [
              '0',
              '1',
              '2',
              String(rep),
              '0',
              '1',
            ]);
            const port = c3 === 0 ? 0 : c1 === 0 ? 15 : -15;
            expect(a2.state.campaign!.politicalPoints).toBe(100 + port + [-15, 10, 5][rep]);
            expect(a2.state.campaign!.unrest).toBe(30 + [-10, 20, -10][rep]);
            expect(a2.state.flags.EP05_ELLA_CARGO_STATUS).toBe('DELIVERED_TO_AOTEDAN');
            expect(a2.images.has('EP05-ACT02-CG13K')).toBe(c3 === 0);
            expect(a2.images.has('EP05-ACT02-CG13R')).toBe(c3 === 1);
            for (const [i, key] of ['A', 'B', 'C'].entries())
              expect(a2.images.has('EP05-ACT02-CG09' + key)).toBe(i === rep);
            const a3 = run(continueChapter(story, a2.state), [
              '0',
              '1',
              '2',
              '0',
              '1',
              String(staff),
              '2',
            ]);
            expect(a3.state.campaign!.politicalPoints).toBe(
              a2.state.campaign!.politicalPoints! + [10, 7, -12][staff]
            );
            expect(a3.state.campaign!.unrest).toBe(
              a2.state.campaign!.unrest! + (staff === 0 ? 8 : 0)
            );
            expect(a3.images.has('EP05-ACT03-CG23')).toBe(staff === 1);
            expect(a3.images.has('EP05-ACT03-CG24')).toBe(staff === 1);
            expect(a3.images.has('EP05-ACT03-CG21')).toBe(staff !== 1);
            expect(a3.images.has('EP05-ACT03-CG20')).toBe(staff === 2);
            const a4 = run(continueChapter(story, a3.state), ['0', '1', '2']);
            expect(a4.state.campaign).toEqual({ ...a3.state.campaign, act: 4 });
            expect(a4.state.clear).toEqual(at().clear);
            expect(a4.state.tarotRoute).toBe('NONE');
            expect(a4.state.politicalRoute).toBe('NONE');
            expect(a4.state.readChapters).not.toContain('EP05');
            expect(story.scenes[a4.state.currentSceneId].completion!.scope).toBe('ACT');
          }
}, 30000);
it('checks the combined future cost without paying at nomination, and the engine rejects insufficient choices', () => {
  const scene = story.scenes.EP05_ACT02_SC03_C1_COMMON;
  expect(scene.kind).toBe('choice');
  const s = at(scene.id, 14, { EP05_PORT_METHOD: 'RIVER', EP05_UNION_ATTITUDE: 'QUESTION' });
  s.currentSegmentIndex = visibleSegments(story, s).length - 1;
  expect(choiceUnavailableReason(s, scene.choices[0])).toContain('不足');
  expect(() => choose(story, s, 'A')).toThrow('不足');
  s.campaign!.politicalPoints = 30;
  const chosen = choose(story, s, 'A');
  expect(chosen.campaign!.politicalPoints).toBe(30);
  const positive = at(scene.id, 0, { EP05_PORT_METHOD: 'RIVER', EP05_UNION_ATTITUDE: 'SOOTHE' });
  positive.currentSegmentIndex = visibleSegments(story, positive).length - 1;
  expect(choiceUnavailableReason(positive, scene.choices[0])).toBeUndefined();
});
it('clamps authored unrest and applies each port/nomination/reward receipt once, including save restore', () => {
  const s = at('EP05_ACT02_SC05', 100, {
    EP05_PORT_METHOD: 'RIVER',
    EP05_UNION_ATTITUDE: 'SOOTHE',
    EP05_OSINM_REPRESENTATION: 'GRASS_APPOINTED',
  });
  s.campaign!.unrest = 95;
  s.currentSegmentIndex = visibleSegments(story, s).length - 1;
  const first = markRead(story, s);
  expect(first.campaign!.politicalPoints).toBe(125);
  expect(first.campaign!.unrest).toBe(100);
  expect(markRead(story, first)).toEqual(first);
  expect(markRead(story, restoreSave(first, story).state).campaign).toEqual(first.campaign);
  const b = at('EP05_ACT03_SC05', 100, { EP05_ACT03_STAFF_SOURCE: 'TAMARA' });
  b.currentSegmentIndex = visibleSegments(story, b).length - 1;
  const rewarded = markRead(story, b);
  expect(rewarded.campaign!.politicalPoints).toBe(115);
  expect(markRead(story, rewarded)).toEqual(rewarded);
  const low = at('EP05_ACT02_SC05', 0, {
    EP05_PORT_METHOD: 'KEEP',
    EP05_OSINM_REPRESENTATION: 'YURIS_APPOINTED',
  });
  expect(() => restoreSave(low, story)).toThrow('不足');
});
it('continues an old EP04 ending save into EP05, adds new flags and charges chapter upkeep only once', () => {
  const end = Object.values(story.scenes).find(
    (s) => s.chapter === 'EP04' && s.completion?.nextChapterId === 'EP05'
  )!;
  const old = at(end.id, 100);
  old.campaign!.unrest = 65;
  old.currentSegmentIndex = visibleSegments(story, old).length - 1;
  for (const k of Object.keys(old.flags)) if (k.startsWith('EP05_')) delete old.flags[k];
  old.contentVersion = '0.12.2-ep04-act03-act05-complete';
  const restored = restoreSave(old, story);
  expect(restored.notices.length).toBeGreaterThan(0);
  const entered = continueChapter(story, restored.state);
  expect(entered.currentSceneId).toBe('EP05_ACT01_SC01');
  expect(entered.campaign!.politicalPoints).toBe(90);
  expect(entered.campaign!.upkeep.filter((r) => r.chapter === 'EP05')).toHaveLength(1);
});
it('merges only behaviorally equivalent exploration states and retains future flags/costs', () => {
  const key = explorationKey(story);
  const s = at();
  const irrelevant = structuredClone(s);
  irrelevant.flags.FATHER_AUDIENCE_COMPLETED = true;
  expect(key(irrelevant)).toBe(key(s));
  const future = structuredClone(s);
  future.flags.EP05_UNION_ATTITUDE = 'SOOTHE';
  expect(key(future)).not.toBe(key(s));
  const money = structuredClone(s);
  money.campaign!.politicalPoints = 99;
  expect(key(money)).not.toBe(key(s));
});
