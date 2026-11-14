import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { openingCost } from '../../packages/narrative-core/campaign';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { explorationKey } from '../../scripts/exploration-key';

let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});

function previousEnd(route: 'SACRED' | 'WORLD') {
  const scene = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP07' &&
      s.act === 'ACT05' &&
      s.completion &&
      s.availableWhen &&
      'value' in s.availableWhen &&
      s.availableWhen.value === route
  )!;
  let state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.contentVersion = '0.19.0-ep07-complete.reader-v1';
  state.flags.T2_CLEAR = true;
  state.flags.F4_CLEAR = true;
  state.flags.ALINDA_A2_CLEAR = route === 'SACRED';
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  return markRead(story, restoreSave(state, story).state);
}

it('continues both old worldlines, charges chapter upkeep once, and exposes the matching directory opening', () => {
  for (const route of ['SACRED', 'WORLD'] as const) {
    const old = previousEnd(route);
    old.campaign!.unrest = 70;
    expect(old.campaign!.politicalPoints).toBe(50);
    const id = `EP08_ACT01_SC01_${route[0]}`;
    expect(navigableScenes(story, old).has(id)).toBe(true);
    expect(
      navigableScenes(story, old).has(`EP08_ACT01_SC01_${route === 'SACRED' ? 'W' : 'S'}`)
    ).toBe(false);
    const state = continueChapter(story, old);
    const cost = openingCost(story.plan!, 'EP08', 70)!;
    expect(state.currentSceneId).toBe(id);
    expect(state.campaign!.politicalPoints).toBe(50 - cost);
    expect(state.campaign!.upkeep.filter((r) => r.chapter === 'EP08')).toEqual([
      { chapter: 'EP08', unrest: 70, cost },
    ]);
    expect(openDirectorySection(story, state, id).campaign!.politicalPoints).toBe(50 - cost);
    const act = chapterDirectory(story, [], state).find((c) => c.id === 'EP08')!.acts[0];
    expect(act.title).toBe(route === 'SACRED' ? '歷史從不騙人' : '不變的事情');
    expect(act.sections).toHaveLength(5);
    expect(act.sections[0].id).toBe(id);
    expect(() =>
      restoreSave({ ...state, politicalRoute: route === 'SACRED' ? 'WORLD' : 'SACRED' }, story)
    ).toThrow();
  }
});

it('plays every flavor response with all 43 CGs while preserving flags, points, unrest and character progress', () => {
  for (const route of ['SACRED', 'WORLD'] as const)
    for (const answer of ['A', 'B', 'C']) {
      let state = continueChapter(story, previousEnd(route));
      const before = structuredClone(state);
      const images = new Set<string>(),
        text: string[] = [];
      let choices = 0,
        ended = false;
      for (let turn = 0; turn < 60; turn++) {
        const scene = story.scenes[state.currentSceneId];
        expect(scene.availableWhen).toEqual({ path: 'politicalRoute', op: 'eq', value: route });
        const segments = visibleSegments(story, state);
        segments.forEach((s, index) => {
          text.push(s.text);
          const cg = currentCg(story, { ...state, currentSegmentIndex: index });
          if (cg) images.add(cg);
          if (s.text.startsWith('「')) expect(s.speaker).toBeTruthy();
        });
        state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
        if (scene.kind === 'end') {
          expect(scene.completion).toMatchObject({
            scope: 'ACT',
            nextChapterId: 'EP08',
            nextSceneId: `EP08_ACT02_SC01_${route[0]}`,
          });
          expect(state.readChapters).not.toContain('EP08');
          ended = true;
          break;
        }
        if (scene.kind === 'choice') {
          expect(scene.choiceMode).toBe('DIALOGUE_FLAVOR');
          expect(scene.choices.every((c) => c.effects.length === 0)).toBe(true);
          choices++;
          state = choose(story, state, answer);
        } else state = advance(story, state);
        state.history = [];
      }
      expect(ended).toBe(true);
      expect(choices).toBe(route === 'SACRED' ? 4 : 5);
      expect(images.size).toBe(route === 'SACRED' ? 18 : 25);
      expect([...images].every((id) => id.startsWith(`EP08-ACT01-${route}-`))).toBe(true);
      expect(state.flags).toEqual(before.flags);
      expect(state.clear).toEqual(before.clear);
      expect(state.campaign!.politicalPoints).toBe(before.campaign!.politicalPoints);
      expect(state.campaign!.unrest).toBe(before.campaign!.unrest);
      expect(state.campaign!.upkeep).toEqual(before.campaign!.upkeep);
      expect(text.join('\n')).not.toMatch(/EP\d|ACT\d|SC\d|CG\d|FLAVOR|無影響|合流|製作|\*\*/);
      if (route === 'WORLD') {
        expect(text).toContain('「所以，芬利，看來不變的事情，還是不會變。」');
        expect(text).toContain(
          '「不如現在問艾拉能否幫我們這個忙吧，如果能，看來下次我得再次自罰三杯了。」'
        );
      } else expect(text).toContain('「有什麼新協議嗎？」');
    }
});

it('keeps low-point saves at the chapter-end warning without deducting points', () => {
  const state = previousEnd('WORLD');
  state.campaign!.politicalPoints = 0;
  state.campaign!.unrest = 100;
  expect(() => continueChapter(story, state)).toThrow();
  expect(state.campaign!.upkeep.some((r) => r.chapter === 'EP08')).toBe(false);
  expect(state.campaign!.politicalPoints).toBe(0);
});

it('merges fixed unrest only within an identical upkeep band, preserving affordability and future changes', () => {
  const fixedTail = {
    ...story,
    scenes: Object.fromEntries(
      Object.entries(story.scenes)
        .filter(([, s]) => !(s.chapter === 'EP08' && s.act === 'ACT02'))
        .map(([id, s]) => [
          id,
          s.chapter === 'EP08' && s.completion
            ? { ...s, completion: { ...s.completion, nextSceneId: undefined } }
            : s,
        ])
    ),
  };
  const key = explorationKey(fixedTail);
  const a = previousEnd('WORLD');
  a.campaign!.unrest = 60;
  a.campaign!.politicalPoints = 9;
  const b = structuredClone(a);
  b.campaign!.unrest = 79;
  expect(key(a)).toBe(key(b));
  expect(() => continueChapter(story, a)).toThrow();
  expect(() => continueChapter(story, b)).toThrow();
  b.campaign!.politicalPoints = 10;
  expect(key(a)).not.toBe(key(b));
  expect(continueChapter(story, b).campaign!.politicalPoints).toBe(0);
  b.campaign!.unrest = 80;
  expect(key(a)).not.toBe(key(b));
  expect(() => continueChapter(story, b)).toThrow();
  a.campaign!.unrest = 0;
  b.campaign!.unrest = 59;
  expect(key(a)).toBe(key(b));
  expect(continueChapter(story, a).campaign!.politicalPoints).toBe(9);
  a.currentSceneId = b.currentSceneId = 'EP06_ACT02_SC01';
  expect(key(a)).not.toBe(key(b));
  expect(a.campaign!.unrest).toBe(0);
  expect(b.campaign!.unrest).toBe(59);
});
