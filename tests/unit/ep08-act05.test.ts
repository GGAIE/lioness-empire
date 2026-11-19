import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadReaderContent, root } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  evaluate,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { chapterDirectory } from '../../packages/narrative-core/directory';
import { recordRouteCompletion } from '../../apps/web-vn/src/engine/covers';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
let matrix: {
  entry: string;
  middle: string;
  closing: string;
  tier: number;
  political_delta: number;
  unrest_delta: number;
}[];
beforeAll(async () => {
  story = await loadReaderContent();
  matrix = JSON.parse(
    await readFile(
      root + '/content/sources/ep08/act05/sacred/02_Codex/tests/all_36_political_combinations.json',
      'utf8'
    )
  );
});
function start(route: 'SACRED' | 'WORLD', points = 100, unrest = 30) {
  const end = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT04' &&
      s.completion &&
      s.id.startsWith(`EP08_ACT04_SC05_${route[0]}`)
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.campaign!.politicalPoints = points;
  state.campaign!.unrest = unrest;
  state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
  state.clear.finley = 3;
  state.flags.EP08_S4_M01 = 'A';
  state.flags.EP08_S4_M02 = 'B';
  state.flags.EP08_S4_M03 = 'A';
  state.flags.EP08_S4_M04 = 'A';
  for (const code of ['N01', 'N02', 'P01', 'P02']) state.flags['EP08_W4_' + code] = 'A';
  state.flags.S3_CLEAR = true;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.contentVersion = '0.23.0-ep08-act04.reader-v1';
  for (const [key, definition] of Object.entries(story.manifest.flags))
    if (definition.description?.includes('第八章第五幕')) delete state.flags[key];
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  const next = continueChapter(story, restoreSave(state, story).state);
  expect(next.currentSceneId).toBe(`EP08_ACT05_SC01_${route[0]}`);
  expect(next.campaign!.politicalPoints).toBe(points);
  expect(next.campaign!.upkeep).toEqual(state.campaign!.upkeep);
  expect(chapterDirectory(story, [], next).find((c) => c.id === 'EP08')!.acts[4].title).toBe(
    route === 'SACRED' ? '你許願不還，不如不許' : '請你考問前代，追念他們的列祖所查究的'
  );
  return next;
}
function play(route: 'SACRED' | 'WORLD', picks: string[], flavor = 'A', points = 100, unrest = 30) {
  let state = start(route, points, unrest),
    index = 0,
    flavors = 0,
    ended = false;
  const images = new Set<string>(),
    text: string[] = [];
  for (let turn = 0; turn < 200; turn++) {
    const scene = story.scenes[state.currentSceneId];
    if (scene.specialEnding === 'ARCANA_06') {
      ended = true;
      break;
    }
    expect(evaluate(state, scene.availableWhen!)).toBe(true);
    const segments = visibleSegments(story, state);
    segments.forEach((p, i) => {
      const cg = currentCg(story, { ...state, currentSegmentIndex: i });
      if (cg) images.add(cg);
      text.push(p.text);
      if (p.text.startsWith('「')) expect(p.speaker).toBeTruthy();
    });
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    expect(markRead(story, state).campaign).toEqual(state.campaign);
    expect(markRead(story, state).clear).toEqual(state.clear);
    if (scene.kind === 'end') {
      expect(scene.completion).toMatchObject({ scope: 'CHAPTER', nextChapterId: 'EP09' });
      expect(scene.completion!.nextSceneId).toBe(`EP09_ACT01_SC01_${route[0]}`);
      ended = true;
      break;
    }
    if (scene.kind === 'choice') {
      const isFlavor = scene.choiceMode === 'DIALOGUE_FLAVOR';
      if (isFlavor) {
        flavors++;
        expect(scene.choices.every((c) => !c.effects.length && !c.previewEffects?.length)).toBe(
          true
        );
      }
      const old = state;
      state = choose(story, state, isFlavor ? flavor : picks[index++]);
      if (isFlavor) {
        expect(state.flags).toEqual(old.flags);
        expect(state.clear).toEqual(old.clear);
      }
      expect(state.campaign!.politicalPoints).toBe(old.campaign!.politicalPoints);
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  expect(ended).toBe(true);
  expect(state.flags.S3_CLEAR).toBe(true);
  expect(state.flags.FINLEY_SECRETARY_SEAL).toBe(true);
  expect(state.politicalRoute).toBe(route);
  expect(state.tarotRoute).toBe('NONE');
  expect(state.campaign!.upkeep).toHaveLength(1);
  if (!state.flags.POLITICAL_POINTS_EXHAUSTED) {
    expect(state.readChapters).toContain('EP08');
    expect(state.readChapters).not.toContain('EP09');
    expect(flavors).toBe(route === 'SACRED' ? 10 : 12);
    expect(index).toBe(route === 'SACRED' ? 4 : 2);
  }
  expect(text.join('\n')).not.toMatch(/ACT\d|EP\d|SC\d|CG\d|OPEN|CLEAR|NEXT|旗標|無影響選項|\*\*/);
  return { state, images, text: text.join('\n') };
}
it('resolves every supplied negotiation, F5 decision and flavor path with the semantic 30-CG map', () => {
  for (const row of matrix)
    for (const f5 of 'ABC')
      for (const flavor of 'ABC') {
        const middle = ['LIMIT', 'BOUND', 'EXPAND'].indexOf(row.middle),
          closing = ['CASE', 'OPEN', 'STANDING'].indexOf(row.closing);
        const { state, images } = play(
          'SACRED',
          [f5, row.entry, 'ABC'[middle], 'ABC'[closing]],
          flavor
        );
        expect(state.flags.EP08_SACRED_ACT05_POLITICAL_TIER).toBe(row.tier);
        expect(state.campaign!.politicalPoints).toBe(100 + row.political_delta);
        expect(state.campaign!.unrest).toBe(30 + row.unrest_delta);
        expect(state.clear.finley).toBe(f5 === 'C' ? 3 : 4);
        expect(state.flags.EP08_SACRED_ACT05_F5_CLEAR_GRANTED).toBe(f5 !== 'C');
        expect(images.size).toBe(21);
        expect([...images].filter((id) => /CG(?:2[2-8])$/.test(id))).toEqual([
          'EP08-ACT05-SACRED-CG' + String(22 + row.tier),
        ]);
        expect([...images].filter((id) => /CG1[0-3]$/.test(id))).toEqual([
          'EP08-ACT05-SACRED-CG' + String(10 + 'ABCD'.indexOf(row.entry)),
        ]);
        expect(state.flags.EP08_SACRED_ACT05_NO_SIGNED_AGREEMENT).toBe(true);
        expect(state.flags.EP08_WORLD_ACT05_F5_CHOICE).toBe('UNSET');
      }
}, 45000);
it('keeps the two World branches exclusive, records four policy outcomes and never invents resource or CLEAR awards', () => {
  for (const f5 of 'AB')
    for (const policy of 'AB')
      for (const flavor of 'ABC') {
        const { state, images, text } = play('WORLD', [f5, policy], flavor);
        expect(state.campaign!.politicalPoints).toBe(100);
        expect(state.campaign!.unrest).toBe(30);
        expect(state.clear.finley).toBe(3);
        expect(state.flags.EP08_WORLD_ACT05_F5_COMPLETE).toBe(f5 === 'A');
        expect(images.size).toBe(12);
        expect(
          [...images].filter((id) => /CG(?:0[6-9]|10)[AB]$/.test(id)).every((id) => id.endsWith(f5))
        ).toBe(true);
        if (f5 === 'A') {
          expect(state.flags.EP08_WORLD_ACT05_INVESTOR_CONTACT).toBe(
            policy === 'A' ? 'ROYAL_INVITATION' : 'PRIVATE_APPROACH'
          );
          expect(state.flags.EP08_WORLD_ACT05_ELIA_SEAL_POLICY).toBe('NOT_VISITED');
          expect(text).toContain('奧特丹');
          expect(text).not.toContain('授權在安全範圍');
        } else {
          expect(state.flags.EP08_WORLD_ACT05_ELIA_SEAL_POLICY).toBe(
            policy === 'A' ? 'LIMITED_RESEARCH' : 'PRESERVE'
          );
          expect(state.flags.EP08_WORLD_ACT05_INVESTOR_CONTACT).toBe('NOT_VISITED');
          expect(text).toContain('教室');
          expect(text).not.toContain('看對方多快願意談');
        }
        expect(state.flags.EP08_WORLD_ACT05_ELIA_RETURNED).toBe(false);
        expect(state.flags.EP08_WORLD_ACT05_ACADEMY_SEATS_AUTO_INCREASED).toBe(false);
      }
});
it('dispatches VI on the exact deferred debit boundary but leaves the same political result playable above it', () => {
  const exact = play('SACRED', ['A', 'D', 'C', 'C'], 'A', 40);
  expect(exact.state.currentSceneId).toBe('ENDING-VI-TREATY');
  expect(exact.state.campaign!.politicalPoints).toBe(0);
  expect(exact.state.flags.EP08_SACRED_ACT05_POLITICAL_TIER).toBe(6);
  expect(exact.state.readChapters).not.toContain('EP08');
  const positive = play('SACRED', ['A', 'D', 'C', 'C'], 'A', 41);
  expect(positive.state.campaign!.politicalPoints).toBe(1);
  const meta = { read: [], cg: [], endings: ['ARCANA_06'], chapters: [] };
  exact.state.tarotRoute = 'TOWER';
  expect(recordRouteCompletion(meta, exact.state, story).completedRoutes).toBeUndefined();
});
