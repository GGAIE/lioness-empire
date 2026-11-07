import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  choiceUnavailableReason,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleChoices,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { GameState, Story } from '../../packages/narrative-core/schema';

let story: Story;
beforeAll(async () => {
  story = await loadReaderContent();
});

function at(id: string, points = 100) {
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.campaign!.politicalPoints = points;
  return state;
}

it('continues an older ACT02 end without charging another chapter fee', () => {
  const id = Object.values(story.scenes).find(
    (s) => s.act === 'ACT02' && s.chapter === 'EP06' && s.completion
  )!.id;
  const old = at(id, 34);
  old.currentSegmentIndex = visibleSegments(story, old).length - 1;
  old.contentVersion = '0.14.2-reader-staging.reader-v1';
  delete old.flags.F2_METHOD;
  const state = continueChapter(story, restoreSave(old, story).state);
  expect(state.currentSceneId).toBe('EP06_ACT03_SC01');
  expect(state.campaign!.politicalPoints).toBe(34);
  expect(state.flags.F2_METHOD).toBe('UNSET');
});

it('checks the deferred investigation cost before the player commits to option C', () => {
  const scene = Object.values(story.scenes).find(
    (s) => s.id.startsWith('EP06_ACT03_SC03') && s.choices.length === 3
  )!;
  const state = at(scene.id, 19);
  expect(choiceUnavailableReason(state, scene.choices[2])).toContain('20');
  state.campaign!.politicalPoints = 20;
  expect(choiceUnavailableReason(state, scene.choices[2])).toBeUndefined();
});

function play(method: string, transferred: boolean, s2: string, t2: string, f3: string) {
  let state = at('EP06_ACT03_SC01');
  state.flags.ROUENNE_TRANSFER_APPROVED = transferred;
  state.flags.F2_INVESTIGATION_PENDING = true;
  const images = new Set<string>();
  const seenChoices = new Set<string>();
  const lines: string[] = [];
  const boundary: GameState[] = [];
  for (let i = 0; i < 1600; i++) {
    const scene = story.scenes[state.currentSceneId];
    const cg = currentCg(story, state);
    if (cg) images.add(cg);
    const segments = visibleSegments(story, state);
    lines.push(segments[state.currentSegmentIndex].text);
    if (state.currentSegmentIndex !== segments.length - 1) {
      state = advance(story, state);
    } else if (scene.kind === 'choice') {
      const options = visibleChoices(story, state);
      let pick = 'A';
      if (scene.choiceMode === 'STORY') {
        seenChoices.add(scene.id);
        if (scene.act === 'ACT03') pick = method;
        else if (scene.sceneNumber === 2) pick = s2;
        else if (scene.sceneNumber === 3) {
          expect(options).toHaveLength(2);
          pick = `${transferred ? 'T' : 'F'}${s2 === 'A' ? 'S' : 'F'}_${t2}`;
        } else pick = f3;
      } else {
        expect(options.every((c) => c.effects.length === 0)).toBe(true);
      }
      state = choose(story, state, pick);
      if (scene.act === 'ACT03' && scene.choiceMode === 'STORY')
        expect(state.campaign!.politicalPoints).toBe(100);
    } else if (scene.kind === 'end') {
      state = markRead(story, state);
      boundary.push(state);
      const again = markRead(story, state);
      expect(again.campaign).toEqual(state.campaign);
      expect(again.clear).toEqual(state.clear);
      if (scene.completion?.scope === 'CHAPTER')
        return { state, images, seenChoices, lines, boundary };
      state = continueChapter(story, state);
    } else {
      state = advance(story, state);
    }
    state.history = [];
    state.readSegments = [];
  }
  throw Error('Chapter did not reach its authored ending');
}

it('runs all 40 investigation, resettlement, gate and authorization combinations through the chapter ending', () => {
  let runs = 0;
  for (const method of ['A', 'B', 'C'])
    for (const transferred of [true, false])
      for (const s2 of ['A', 'B'])
        for (const t2 of ['A', 'B'])
          for (const f3 of method === 'A' ? ['A'] : ['A', 'B']) {
            const { state, images, seenChoices, lines, boundary } = play(
              method,
              transferred,
              s2,
              t2,
              f3
            );
            expect(boundary).toHaveLength(3);
            const f2Points = method === 'A' ? 5 : method === 'B' ? 0 : -20;
            const s2Points = transferred ? (s2 === 'A' ? 5 : -2) : s2 === 'A' ? -5 : -10;
            expect(boundary[0].campaign!.politicalPoints).toBe(100 + f2Points);
            expect(state.campaign!.politicalPoints).toBe(100 + f2Points + s2Points);
            expect(state.campaign!.unrest).toBe(30 + (s2 === 'A' ? 0 : transferred ? 5 : 15));
            expect(state.clear.finley).toBe(
              at('EP06_ACT03_SC01').clear.finley + (method === 'C' ? 0 : 1)
            );
            expect(state.flags.OTTODAN_COLD_CASE_SOLVED).toBe(true);
            expect(state.flags.F2_INVESTIGATION_PENDING).toBe(false);
            expect(state.flags.F2_CLEAR).toBe(method !== 'C');
            expect(state.flags.FINLEY_SECRETARY_SEAL).toBe(method === 'A');
            expect(state.flags.S2_CLEAR).toBe(s2 === 'A');
            expect(state.flags.T2_GATE_FIRST_HALF).toBe(t2 === 'A' ? 'SUCCESS' : 'FAILURE');
            expect(state.flags.F3_CLEAR).toBe(method === 'A' || f3 === 'A');
            expect(state.flags.F3_RESOLUTION).toBe(
              method === 'A'
                ? 'PERMANENT_SEAL_AUTO_PASS'
                : f3 === 'A'
                  ? 'LIMITED_OVERSIGHT_AGREEMENT'
                  : 'AD_HOC_ONLY'
            );
            expect([...seenChoices].some((id) => id.startsWith('EP06_ACT04_SC04'))).toBe(
              method !== 'A'
            );
            for (let cg = 14; cg <= 17; cg++)
              expect(images.has(`EP06-ACT04-CG${cg}`)).toBe(
                cg === (transferred ? 14 : 16) + (s2 === 'B' ? 1 : 0)
              );
            expect(images.has('EP06-ACT05-CG21')).toBe(transferred);
            expect(images.has('EP06-ACT05-CG22')).toBe(!transferred);
            expect(lines).toContain('「新任聖女，薩拉菲尼亞。」');
            expect(state.politicalRoute).toBe(boundary[0].politicalRoute);
            expect(state.readChapters).toContain('EP06');
            expect(story.scenes[state.currentSceneId].completion).toMatchObject({
              scope: 'CHAPTER',
              nextChapterId: 'EP06',
            });
            expect(story.scenes[state.currentSceneId].completion?.nextSceneId).toBe('EP06_ACT06_SC01');
            expect(currentCg(story, state)).toBeUndefined();
            runs++;
          }
  expect(runs).toBe(40);
}, 45000);
