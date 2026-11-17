import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadReaderContent, root } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleSegments,
  choiceUnavailableReason,
  evaluate,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import {
  chapterDirectory,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
let matrix: {
  M01: string;
  M02: string;
  M03: string;
  result: string;
  political_delta: number;
  alinda_clear_delta: number;
  result_cg: string;
}[];
beforeAll(async () => {
  story = await loadReaderContent();
  matrix = JSON.parse(
    await readFile(
      root + '/content/sources/ep08/act03/sacred/04_Production/Choice_Resolver_v1.1.json',
      'utf8'
    )
  ).outcomes;
});

function start(route: 'SACRED' | 'WORLD', points = 100, unrest = 30, alinda = 3) {
  const end = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT02' &&
      s.completion &&
      s.availableWhen &&
      'value' in s.availableWhen &&
      s.availableWhen.value === route
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.campaign!.politicalPoints = points;
  state.campaign!.unrest = unrest;
  state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
  state.clear.alinda = alinda;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.flags.S3_CLEAR = true;
  state.flags.EP08_SACRED_CHURCH_DOUBLE_DEMAND = route === 'SACRED';
  state.contentVersion = '0.21.0-ep08-act02.reader-v1';
  for (const [key, def] of Object.entries(story.manifest.flags))
    if (def.description?.includes('第八章第三幕')) delete state.flags[key];
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  const next = continueChapter(story, restoreSave(state, story).state);
  expect(next.currentSceneId).toBe(`EP08_ACT03_SC01_${route[0]}`);
  expect(chapterDirectory(story, [], next).find((c) => c.id === 'EP08')!.acts[2].title).toBe(
    route === 'SACRED' ? '無人承接的契約' : '山火記得的名字'
  );
  expect(next.campaign!.politicalPoints).toBe(points);
  expect(next.campaign!.upkeep).toEqual(state.campaign!.upkeep);
  return next;
}

function play(
  route: 'SACRED' | 'WORLD',
  picks: string[],
  flavor = 'A',
  points = 100,
  unrest = 30,
  alinda = 3
) {
  let state = start(route, points, unrest, alinda);
  const before = structuredClone(state),
    images = new Set<string>(),
    text: string[] = [];
  let index = 0,
    flavors = 0,
    ended = false;
  for (let turn = 0; turn < 160; turn++) {
    const scene = story.scenes[state.currentSceneId];
    expect(evaluate(state, scene.availableWhen!)).toBe(true);
    const segments = visibleSegments(story, state);
    segments.forEach((p, i) => {
      const image = currentCg(story, { ...state, currentSegmentIndex: i });
      if (image) images.add(image);
      text.push(p.text);
      if (p.text.startsWith('「')) expect(p.speaker).toBeTruthy();
    });
    const prior = state.campaign!.politicalPoints;
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    const repeat = markRead(story, state);
    expect(repeat.campaign!.politicalPoints).toBe(state.campaign!.politicalPoints);
    expect(repeat.clear).toEqual(state.clear);
    if (route === 'SACRED' && !state.flags.EP08_S3_SETTLED)
      expect(state.campaign!.politicalPoints).toBe(points);
    if (route === 'WORLD' && scene.id.includes('_F07'))
      expect(state.flags.EP08_WORLD_EIRINDA_SURVEY_RESULT).toBe(
        picks[0] === 'A' ? 'SUCCESS' : 'FAILURE'
      );
    if (scene.kind === 'end') {
      expect(scene.completion).toMatchObject({
        scope: 'ACT',
        nextChapterId: 'EP08',
        nextSceneId: `EP08_ACT04_SC01_${route[0]}`,
        continueLabel: '進入第四幕',
      });
      ended = true;
      break;
    }
    if (scene.kind === 'choice') {
      const isFlavor = scene.choiceMode === 'DIALOGUE_FLAVOR',
        answer = isFlavor ? flavor : picks[index++];
      if (isFlavor) {
        expect(scene.choices.every((c) => !c.effects.length && !c.previewEffects?.length)).toBe(
          true
        );
        flavors++;
      }
      const next = choose(story, state, answer);
      if (isFlavor) {
        expect(next.flags).toEqual(state.flags);
        expect(next.clear).toEqual(state.clear);
        expect(next.campaign!.politicalPoints).toBe(prior);
      }
      if (route === 'SACRED')
        expect(next.campaign!.politicalPoints).toBe(state.campaign!.politicalPoints);
      state = next;
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  expect(ended).toBe(true);
  expect(index).toBe(3);
  expect(flavors).toBe(route === 'SACRED' ? 11 : 10);
  expect(state.campaign!.upkeep).toEqual(before.campaign!.upkeep);
  expect(state.flags.FINLEY_SECRETARY_SEAL).toBe(true);
  expect(state.flags.S3_CLEAR).toBe(true);
  expect(state.flags.EP08_SACRED_CHURCH_DOUBLE_DEMAND).toBe(route === 'SACRED');
  expect(state.politicalRoute).toBe(route);
  expect(state.tarotRoute).toBe(before.tarotRoute);
  expect(state.readChapters).not.toContain('EP08');
  expect([...images].every((id) => id.startsWith(`EP08-ACT03-${route}-`))).toBe(true);
  expect(text.join('\n')).not.toMatch(
    /ACT\s*\d|SC\s*\d|M0\d|N01|P0\d|CG\d|CLEAR|玩家|旗標|鏡頭|製作索引|結算方向|\*\*/
  );
  expect(state.flags.ALINDA_A3_CLEAR).toBeUndefined();
  return { state, before, images, text: text.join('\n') };
}

it('matches every Sacred resolver row, plays all flavor replies, and settles only once', () => {
  const allImages = new Set<string>();
  for (const row of matrix)
    for (const flavor of ['A', 'B', 'C']) {
      const { state, images } = play('SACRED', [row.M01, row.M02, row.M03], flavor);
      expect(state.flags.EP08_SACRED_RESULT).toBe(row.result);
      expect(state.flags.EP08_S3_SETTLED).toBe(true);
      expect(state.campaign!.politicalPoints).toBe(100 + row.political_delta);
      expect(state.campaign!.unrest).toBe(30);
      expect(state.clear.alinda).toBe(3 + row.alinda_clear_delta);
      expect(state.flags.EP08_SACRED_ALINDA_EVENT_CLEAR_GRANTED).toBe(row.alinda_clear_delta === 1);
      expect(state.flags.EP08_SACRED_LAVACAT_RESOLVED).toBe(true);
      expect(state.flags.EP08_SACRED_AUREA_COVENANT_BEARER).toBe(true);
      expect(images.size).toBe(21);
      expect([...images].filter((id) => /-1[789]$|-20$/.test(id))).toEqual([
        `EP08-ACT03-SACRED-${row.result_cg.slice(2)}`,
      ]);
      expect(markRead(story, restoreSave(state, story).state).clear).toEqual(state.clear);
      images.forEach((x) => allImages.add(x));
    }
  expect(allImages.size).toBe(24);
}, 30000);

it('keeps all World notice, political, image and clamping combinations independent', () => {
  const allImages = new Set<string>();
  for (const notice of ['A', 'B'])
    for (const first of ['A', 'B'])
      for (const last of ['A', 'B'])
        for (const flavor of ['A', 'B', 'C'])
          for (const initialUnrest of [2, 95]) {
            const { state, before, images, text } = play(
              'WORLD',
              [notice, first, last],
              flavor,
              100,
              initialUnrest
            );
            expect(state.campaign!.politicalPoints).toBe(
              100 + (first === 'A' ? 20 : -15) + (last === 'A' ? 20 : -15)
            );
            const expected = [first, last].reduce(
              (v, key) => Math.max(0, Math.min(100, v + (key === 'A' ? 10 : -5))),
              initialUnrest
            );
            expect(state.campaign!.unrest).toBe(expected);
            expect(state.flags.EP08_WORLD_EIRINDA_SURVEY_RESULT).toBe(
              notice === 'A' ? 'SUCCESS' : 'FAILURE'
            );
            expect(state.clear).toEqual(before.clear);
            expect(state.flags.EP08_WORLD_AUREA_INHERITANCE_COMPLETE).toBe(true);
            expect(state.flags.EP08_WORLD_LAVA_GUARDIAN_CALMED).toBe(true);
            expect(state.flags.EP08_WORLD_ACADEMY_PROCEDURE_SUCCESS).toBe(true);
            expect(images.size).toBe(25);
            for (const [prefix, key] of [
              ['09', first],
              ['15', notice],
              ['24', last],
            ]) {
              expect(images.has(`EP08-ACT03-WORLD-${prefix}A`)).toBe(key === 'A');
              expect(images.has(`EP08-ACT03-WORLD-${prefix}B`)).toBe(key === 'B');
            }
            expect(text).toContain(notice === 'A' ? '行程已收到' : '考察隊已身在領地內');
            images.forEach((x) => allImages.add(x));
          }
  expect(allImages.size).toBe(28);
}, 30000);

it('prevents an unaffordable deferred outcome while allowing a late correction without early charging', () => {
  const root = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT03' &&
      s.choices.some((c) => c.effects.some((e) => e.type === 'flag' && e.key === 'EP08_S3_M01'))
  )!;
  const state = start('SACRED', 9);
  state.currentSceneId = root.id;
  state.currentSegmentIndex = root.segments.length - 1;
  expect(choiceUnavailableReason(state, root.choices[0])).toBeUndefined();
  expect(choiceUnavailableReason(state, root.choices[2])).toContain('不足');
  expect(() => choose(story, state, 'C')).toThrow('不足');
  expect(state.campaign!.politicalPoints).toBe(9);
  const fixed = play('SACRED', ['C', 'C', 'B'], 'B', 10);
  expect(fixed.state.flags.EP08_SACRED_RESULT).toBe('SMALL_FAILURE');
  expect(fixed.state.campaign!.politicalPoints).toBe(0);
  expect(fixed.state.clear.alinda).toBe(3);
  const positive = play('SACRED', ['B', 'A', 'B'], 'C', 0, 30, 6);
  expect(positive.state.campaign!.politicalPoints).toBe(10);
  expect(positive.state.clear.alinda).toBe(7);
}, 15000);

it('keeps free reading out of consequences whose required decisions have not been made', () => {
  const state = start('SACRED');
  expect(navigableScenes(story, state, true).has('EP08_ACT03_SC05_S')).toBe(false);
  expect(() => openDirectorySection(story, state, 'EP08_ACT03_SC05_S', true)).toThrow();
  state.flags.EP08_S3_M01 = 'B';
  state.flags.EP08_S3_M02 = 'A';
  expect(navigableScenes(story, state, true).has('EP08_ACT03_SC05_S')).toBe(true);
  expect(
    openDirectorySection(story, state, 'EP08_ACT03_SC05_S', true).campaign!.politicalPoints
  ).toBe(100);
});
