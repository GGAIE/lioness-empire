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
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});

function start(route: 'SACRED' | 'WORLD', unrest = 30) {
  const end = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT01' &&
      s.completion &&
      s.availableWhen &&
      'value' in s.availableWhen &&
      s.availableWhen.value === route
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.campaign!.politicalPoints = 100;
  state.campaign!.unrest = unrest;
  state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
  state.clear.finley = 3;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.flags.S3_CLEAR = true;
  state.contentVersion = '0.20.0-ep08-act01.reader-v1';
  for (const key of Object.keys(state.flags)) if (key.startsWith('EP08_')) delete state.flags[key];
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  const migrated = restoreSave(state, story).state;
  const next = continueChapter(story, migrated);
  expect(next.currentSceneId).toBe(`EP08_ACT02_SC01_${route[0]}`);
  expect(next.campaign!.politicalPoints).toBe(100);
  expect(next.campaign!.upkeep).toEqual(state.campaign!.upkeep);
  return next;
}

function play(route: 'SACRED' | 'WORLD', picks: string[], flavor = 'A', unrest = 30) {
  let state = start(route, unrest);
  const before = structuredClone(state),
    images = new Set<string>(),
    prose: string[] = [];
  let major = 0,
    flavors = 0,
    ended = false;
  for (let turn = 0; turn < 100; turn++) {
    const scene = story.scenes[state.currentSceneId];
    expect(scene.availableWhen).toEqual({ path: 'politicalRoute', op: 'eq', value: route });
    const segments = visibleSegments(story, state);
    segments.forEach((s, i) => {
      const cg = currentCg(story, { ...state, currentSegmentIndex: i });
      if (cg) images.add(cg);
      prose.push(s.text);
      if (s.text.startsWith('「')) expect(s.speaker).toBeTruthy();
    });
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    expect(markRead(story, state).campaign!.politicalPoints).toBe(state.campaign!.politicalPoints);
    if (scene.kind === 'end') {
      expect(scene.completion).toMatchObject({
        scope: 'ACT',
        nextChapterId: 'EP08',
        pendingLabel: '第三幕〈熔岩之下的契約〉· 敬請期待',
      });
      ended = true;
      break;
    }
    if (scene.kind === 'choice') {
      if (scene.choiceMode === 'DIALOGUE_FLAVOR') {
        expect(scene.choices.every((c) => !c.effects.length && !c.previewEffects?.length)).toBe(
          true
        );
        const snapshot = structuredClone(state);
        state = choose(story, state, flavor);
        flavors++;
        expect(state.flags).toEqual(snapshot.flags);
        expect(state.campaign!.politicalPoints).toBe(snapshot.campaign!.politicalPoints);
        expect(state.campaign!.unrest).toBe(snapshot.campaign!.unrest);
      } else state = choose(story, state, picks[major++]);
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  expect(ended).toBe(true);
  expect(major).toBe(picks.length);
  expect(flavors).toBe(route === 'SACRED' ? 4 : 5);
  expect(state.clear).toEqual(before.clear);
  expect(state.politicalRoute).toBe(route);
  expect(state.tarotRoute).toBe(before.tarotRoute);
  expect(state.campaign!.upkeep).toEqual(before.campaign!.upkeep);
  expect(state.flags.FINLEY_SECRETARY_SEAL).toBe(true);
  expect(state.flags.S3_CLEAR).toBe(true);
  expect(state.readChapters).not.toContain('EP08');
  expect([...images].every((id) => id.startsWith(`EP08-ACT02-${route}-`))).toBe(true);
  expect(prose.join('\n')).not.toMatch(
    /ACT\d|SC\d|CG\d|Result|前台說明|隱性效果|S\.H\.E|玩家|鏡頭|核准的數字|cat >|EOF|\*\*/
  );
  return { state, before, images, prose: prose.join('\n') };
}

it('plays all nine Sacred political combinations and every flavor response without inventing unrest costs', () => {
  const allImages = new Set<string>();
  for (const first of ['A', 'B', 'C'])
    for (const second of ['A', 'B', 'C'])
      for (const flavor of ['A', 'B', 'C']) {
        const run = play('SACRED', [first, second], flavor);
        const { state, images } = run;
        images.forEach((x) => allImages.add(x));
        const expected =
          100 + { A: 10, B: -20, C: -35 }[first]! + { A: 5, B: -15, C: -30 }[second]!;
        expect(state.campaign!.politicalPoints).toBe(expected);
        expect(state.campaign!.unrest).toBe(30);
        expect(images.size).toBe(second === 'C' ? 15 : 14);
        expect(state.flags.EP08_SACRED_PARLIAMENT_EXPANDED_50).toBe(true);
        expect(state.flags.EP08_SACRED_HOLYLIGHT_ONE_SEAT).toBe(true);
        expect(state.flags.EP08_SACRED_NOMINATIONS_INCOMPLETE).toBe(true);
        expect(state.flags.EP08_SACRED_THEOCRACY_CASE_ACCEPTED).toBe(true);
        expect(state.flags.EP08_SACRED_CHURCH_ASKS_MORE).toBe(first === 'C' || second === 'C');
        expect(state.flags.EP08_SACRED_CHURCH_DOUBLE_DEMAND).toBe(first === 'C' && second === 'C');
      }
  expect(allImages.size).toBe(15);
}, 20000);

it('applies both World outcomes once, clamps unrest and shows only the chosen CG16 variant', () => {
  for (const pick of ['A', 'B'])
    for (const flavor of ['A', 'B', 'C'])
      for (const unrest of [2, 95]) {
        const { state, before, images, prose } = play('WORLD', [pick], flavor, unrest);
        expect(state.campaign!.politicalPoints).toBe(pick === 'A' ? 120 : 85);
        expect(state.campaign!.unrest).toBe(
          pick === 'A' ? Math.min(100, unrest + 10) : Math.max(0, unrest - 5)
        );
        expect(state.flags).toEqual(before.flags);
        expect(images.size).toBe(26);
        expect(images.has('EP08-ACT02-WORLD-16A')).toBe(pick === 'A');
        expect(images.has('EP08-ACT02-WORLD-16B')).toBe(pick === 'B');
        expect(prose).toContain('赫碧');
        expect(prose).not.toContain('五十席');
      }
}, 20000);

it('blocks unaffordable political decisions without changing state or hiding affordable alternatives', () => {
  const question = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT02' &&
      s.kind === 'choice' &&
      s.choices.some((c) => c.effects.some((e) => e.type === 'points' && e.delta === -35))
  )!;
  const state = start('SACRED');
  state.currentSceneId = question.id;
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  state.campaign!.politicalPoints = 19;
  const before = structuredClone(state);
  expect(choiceUnavailableReason(state, question.choices[0])).toBeUndefined();
  expect(choiceUnavailableReason(state, question.choices[1])).toContain('不足');
  expect(choiceUnavailableReason(state, question.choices[2])).toContain('不足');
  expect(() => choose(story, state, 'C')).toThrow('不足');
  expect(state).toEqual(before);
});
