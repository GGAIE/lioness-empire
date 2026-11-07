import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleChoices,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { chapterDirectory, navigableScenes } from '../../packages/narrative-core/directory';
import { MetaSchema, emptyMeta, restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { GameState, Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadReaderContent();
});
function at(id: string) {
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.campaign!.politicalPoints = 150;
  return state;
}
function finish(s: GameState) {
  return markRead(story, { ...s, currentSegmentIndex: visibleSegments(story, s).length - 1 });
}
it('keeps all 25 EP06 titles visible while locking unresolved investigation and gate scenes', () => {
  const s = at('EP06_ACT03_SC01');
  const chapter = chapterDirectory(story, [], s).find((c) => c.id === 'EP06')!;
  expect(chapter.acts.slice(0, 5).map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
  const free = navigableScenes(story, s, true);
  for (const id of ['EP06_ACT03_SC04_A', 'EP06_ACT03_SC05', 'EP06_ACT04_SC03'])
    expect(free.has(id)).toBe(false);
  expect(chapter.acts[5].label).toBe('幕間');
});
it('migrates an old EP06 ending into the interlude without another chapter fee', () => {
  const ending = Object.values(story.scenes).find(
    (s) => s.chapter === 'EP06' && s.completion?.scope === 'CHAPTER'
  )!;
  const old = finish(at(ending.id));
  old.contentVersion = '0.15.0-ep06-complete.reader-v1';
  delete old.flags.ROUTE_06;
  const next = continueChapter(story, restoreSave(old, story).state);
  expect(next.currentSceneId).toBe('EP06_ACT06_SC01');
  expect(next.campaign!.act).toBe(5);
  expect(next.campaign!.politicalPoints).toBe(150);
  expect(next.flags.ROUTE_06).toBe('UNSET');
});
it('defers route locking until the chosen proposal is read and charges EP07 only once', () => {
  for (const [pick, route] of [
    ['A', 'SACRED'],
    ['B', 'WORLD'],
  ] as const) {
    const start = finish(at('EP06_ACT06_SC07'));
    start.readChapters = ['EP06'];
    let chosen = choose(story, start, pick);
    expect(chosen.politicalRoute).toBe('NONE');
    chosen = finish(chosen);
    expect(chosen.flags.ROUTE_06).toBe(route);
    expect(chosen.politicalRoute).toBe(route);
    expect(markRead(story, chosen).campaign).toEqual(chosen.campaign);
    const next = continueChapter(story, chosen);
    expect(next.currentSceneId).toBe('EP07_ACT01_SC01');
    expect(next.campaign!.upkeep.filter((r) => r.chapter === 'EP07')).toHaveLength(1);
  }
});
it('uses a separate special ending and removes the abandon option after cancellation', () => {
  const start = finish(at('EP06_ACT06_SC07'));
  const warning = choose(story, start, 'C');
  expect(currentCg(story, warning)).toBe('EP07-INTERLUDE-32');
  expect(story.scenes[warning.currentSceneId].transient).toBe(true);
  const cancel = choose(story, finish(warning), 'CANCEL');
  expect(currentCg(story, cancel)).toBe('EP07-INTERLUDE-27');
  expect(visibleChoices(story, finish(cancel)).map((c) => c.id)).toEqual(['A', 'B']);
  const confirmed = choose(story, finish(warning), 'CONFIRM');
  expect(story.scenes[confirmed.currentSceneId].specialEnding).toBe('RETURN_TO_TITLE');
  expect(currentCg(story, confirmed)).toBe('EP07-INTERLUDE-34');
  expect(confirmed.clear).toEqual(start.clear);
  expect(confirmed.campaign).toEqual(start.campaign);
  expect(confirmed.politicalRoute).toBe('NONE');
  expect(MetaSchema.parse({ ...emptyMeta, specialEndings: ['RETURN_TO_TITLE'] }).endings).toEqual(
    []
  );
});
it('marks the chosen interlude route read without requiring the abandoned alternative endings', () => {
  const ids = ['EP06_ACT06_SC07', 'EP06_ACT06_SC07_SACRED'];
  const state = at(ids[1]);
  state.politicalRoute = 'SACRED';
  state.decisionLog = ['EP06_ACT06_SC07:A'];
  state.readSegments = ids.flatMap((id) => story.scenes[id].segments.map((p) => `${id}:${p.id}`));
  const chapter = chapterDirectory(story, state.readSegments, state).find((c) => c.id === 'EP06')!;
  expect(chapter.acts[5].sections[6].read).toBe(true);
});
it('runs both routes with every reform/refugee response, settlement history and seal state', () => {
  let count = 0;
  for (const route of ['SACRED', 'WORLD'] as const)
    for (const protectedState of [false, true])
      for (const seal of [false, true])
        for (const reform of ['A', 'B', 'C'])
          for (const refugee of protectedState ? ['A'] : ['A', 'B', 'C']) {
            let state = at('EP07_ACT01_SC01');
            state.politicalRoute = route;
            state.campaign!.politicalRoute = route;
            state.flags.ROUTE_06 = route;
            state.flags.ROUENNE_TRANSFER_APPROVED = protectedState;
            state.flags.S1_STATUS = protectedState ? 'SUCCESS' : 'FAILED';
            state.flags.FINLEY_SECRETARY_SEAL = seal;
            const images = new Set<string>();
            let reformSeen = false,
              refugeeSeen = false,
              ended = false;
            for (let i = 0; i < 1100; i++) {
              const scene = story.scenes[state.currentSceneId];
              const image = currentCg(story, state);
              if (image) images.add(image);
              if (state.currentSegmentIndex < visibleSegments(story, state).length - 1)
                state = advance(story, state);
              else if (scene.kind === 'choice') {
                const options = visibleChoices(story, state);
                const effective = scene.choiceMode === 'STORY';
                let pick = options[0].id;
                if (effective && scene.act === 'ACT01') {
                  pick = `${route[0]}-${reform}`;
                  reformSeen = true;
                }
                if (effective && scene.act === 'ACT02') {
                  pick = refugee;
                  refugeeSeen = true;
                }
                if (!effective) expect(options.every((c) => c.effects.length === 0)).toBe(true);
                state = choose(story, state, pick);
              } else if (scene.kind === 'end') {
                state = finish(state);
                expect(markRead(story, state).campaign).toEqual(state.campaign);
                if (!scene.completion?.nextSceneId) {
                  ended = true;
                  break;
                }
                state = continueChapter(story, state);
              } else state = advance(story, state);
              state.history = [];
              state.readSegments = [];
            }
            expect(ended).toBe(true);
            expect(reformSeen).toBe(true);
            expect(refugeeSeen).toBe(!protectedState);
            const reformPoints = route === 'SACRED' ? -10 : 20;
            const refugeePoints = protectedState ? 0 : refugee === 'B' ? -20 : -10;
            expect(state.campaign!.politicalPoints).toBe(
              150 + reformPoints + refugeePoints + (seal ? 10 : 0)
            );
            expect(state.campaign!.unrest).toBe(
              30 +
                (route === 'SACRED' ? -10 : { A: 10, B: 15, C: 20 }[reform]!) +
                (protectedState ? 0 : 10)
            );
            expect(state.flags.S3_CLEAR).toBe(true);
            expect(state.flags.SOPHIE_CORONATED).toBe(true);
            expect(state.clear).toEqual({ alinda: 1, finley: 1, tamara: 1, shalia: 1 });
            expect(images.has('EP07-ACT01-C08')).toBe(seal);
            expect(images.has(`EP07-ACT02-23${route[0]}`)).toBe(true);
            expect(images.has(`EP07-ACT02-23${route === 'SACRED' ? 'W' : 'S'}`)).toBe(false);
            count++;
          }
  expect(count).toBe(48);
});
