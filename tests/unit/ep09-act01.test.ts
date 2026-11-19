import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, loadReaderContent, root } from '../../scripts/load-content';
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
import { openingCost } from '../../packages/narrative-core/campaign';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { navigableScenes } from '../../packages/narrative-core/directory';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});
function start(route: 'SACRED' | 'WORLD', points = 100) {
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: `EP09_ACT01_SC01_${route[0]}` },
  });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.campaign!.politicalPoints = points;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.flags.S3_CLEAR = true;
  return state;
}
function play(route: 'SACRED' | 'WORLD', pick: string, flavor = 'A', points = 100) {
  let state = start(route, points);
  const images = new Set<string>();
  let flavors = 0,
    majors = 0,
    ended = false;
  for (let turn = 0; turn < 110; turn++) {
    const scene = story.scenes[state.currentSceneId];
    if (scene.specialEnding === 'ARCANA_06') {
      ended = true;
      break;
    }
    const segments = visibleSegments(story, state);
    segments.forEach((p, i) => {
      const cg = currentCg(story, { ...state, currentSegmentIndex: i });
      if (cg && p.visual !== 'BLACK') images.add(cg);
      if (p.text.startsWith('「')) expect(p.speaker).toBeTruthy();
    });
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    expect(markRead(story, state).campaign).toEqual(state.campaign);
    if (scene.kind === 'end') {
      ended = true;
      break;
    }
    if (scene.kind === 'choice') {
      const isFlavor = scene.choiceMode === 'DIALOGUE_FLAVOR';
      if (isFlavor) {
        flavors++;
        const before = structuredClone(state);
        const next = choose(story, state, flavor);
        expect(next.flags).toEqual(before.flags);
        expect(next.campaign).toEqual(before.campaign);
        expect(next.clear).toEqual(before.clear);
      } else majors++;
      const decisionId = isFlavor ? flavor : pick;
      const before = state;
      state = choose(story, state, decisionId);
      const replay = {
        ...state,
        currentSceneId: before.currentSceneId,
        currentSegmentIndex: before.currentSegmentIndex,
      };
      expect(() => choose(story, replay, decisionId)).toThrow();
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  expect(ended).toBe(true);
  return { state, images, flavors, majors };
}
it('migrates old chapter-eight endings into the matching ninth chapter and charges upkeep once', () => {
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT05' &&
        s.completion &&
        s.completion.nextSceneId === `EP09_ACT01_SC01_${route[0]}`
    )!;
    let state = start(route);
    state.currentSceneId = end.id;
    state.currentSegmentIndex = end.segments.length - 1;
    state.contentVersion = '0.24.0-ep08-act05.reader-v1';
    state.campaign!.chapter = 'EP08';
    state.flags.EP08_S5_F5 = 'A';
    state.flags.EP08_S5_P01 = 'A';
    state.flags.EP08_S5_P02 = 'LIMIT';
    state.flags.EP08_S5_P03 = 'CASE';
    state.flags.EP08_SACRED_ACT05_POLITICS_RESOLVED = true;
    state.flags.EP08_WORLD_ACT05_F5_CHOICE = 'B';
    state.readChapters = ['EP08'];
    for (const key of Object.keys(state.flags))
      if (key.startsWith('EP09_')) delete state.flags[key];
    const restored = restoreSave(state, story).state;
    const next = continueChapter(story, restored);
    expect(next.currentSceneId).toBe(`EP09_ACT01_SC01_${route[0]}`);
    expect(next.campaign!.politicalPoints).toBe(100 - openingCost(story.plan!, 'EP09', 30)!);
    expect(next.campaign!.upkeep.filter((x) => x.chapter === 'EP09')).toHaveLength(1);
    const again = continueChapter(story, {
      ...next,
      currentSceneId: end.id,
      currentSegmentIndex: end.segments.length - 1,
    });
    expect(again.campaign).toEqual(next.campaign);
    expect(next.flags.EP09_W_HEBE_FAVOR_OWED).toBe(false);
    expect(
      [...navigableScenes(story, next, true)]
        .filter((id) => id.startsWith('EP09_'))
        .every((id) => id.includes(`_${route[0]}`))
    ).toBe(true);
  }
});
it('preserves Sacred humanitarian aid in every political answer with eight flavor choices and branch CGs', () => {
  for (const pick of 'ABC')
    for (const flavor of 'ABC') {
      const { state, images, flavors, majors } = play('SACRED', pick, flavor);
      expect(flavors).toBe(8);
      expect(majors).toBe(1);
      expect(state.flags.EP09_S_RIFT_CHURCH_PRECOMMIT).toBe(true);
      expect(state.campaign!.politicalPoints).toBe(pick === 'B' ? 70 : 100);
      expect(state.campaign!.unrest).toBe(30);
      expect(state.tarotRoute).toBe('NONE');
      expect(state.flags.EP09_S_ROLAND_DEAD).toBe(false);
      expect(state.flags.EP09_S_LAND_LEGALLY_TRANSFERRED).toBe(false);
      expect(images.size).toBe(pick === 'B' ? 28 : 27);
      expect(images.has('EP09-ACT01-S-03-05')).toBe(pick === 'B');
      expect(story.scenes[state.currentSceneId].completion).toMatchObject({
        scope: 'ACT',
        nextChapterId: 'EP09',
        pendingLabel: expect.stringContaining('裂谷兩岸'),
      });
    }
});
it('keeps four World funding consequences distinct, all six flavors neutral, and future military/land events unresolved', () => {
  for (const [pick, delta, source] of [
    ['A', 10, 'GRAVITZ'],
    ['B', 5, 'ACADEMY'],
    ['C', 0, 'BASIC_AID'],
    ['D', -15, 'HEBE_BRIDGE'],
  ] as const)
    for (const flavor of 'ABC') {
      const { state, images, flavors, majors } = play('WORLD', pick, flavor);
      expect(flavors).toBe(6);
      expect(majors).toBe(1);
      expect(state.campaign!.politicalPoints).toBe(100 + delta);
      expect(state.campaign!.unrest).toBe(30);
      expect(state.clear).toEqual(start('WORLD').clear);
      expect(state.tarotRoute).toBe('NONE');
      expect(state.flags.EP09_W_VALKEN_FUNDING_SOURCE).toBe(source);
      expect(state.flags.EP09_W_HEBE_FAVOR_OWED).toBe(pick === 'D');
      expect(state.flags.EP09_W_VALKEN_LAND_OFFER_REJECTED).toBe(pick === 'D');
      expect(state.flags.EP09_W_ACADEMY_LAND_LEASE_PENDING).toBe(pick === 'B');
      expect(state.flags.EP09_W_RECONSTRUCTION_FUNDING_PENDING).toBe(pick === 'C');
      expect(state.flags.EP09_W_VALKEN_REFUGEE_COMMITMENT).toBe(true);
      expect(state.flags.EP09_W_HEBE_FAMILY_LAND_INTEREST).toBe(true);
      expect(state.flags.EP09_W_LAND_LEGALLY_TRANSFERRED).toBe(false);
      expect(state.flags.EP09_W_ROLAND_DEFEATED).toBe(false);
      expect(state.flags.EP09_W_ROLAND_DEAD).toBe(false);
      expect(images.size).toBe(pick === 'D' ? 28 : 27);
      expect(images.has('EP09-ACT01-W-18')).toBe(pick === 'D');
    }
});
it('allows authored mistakes below their hidden cost and gives the existing VI ending priority before any response CG', () => {
  for (const [route, pick, cost] of [
    ['SACRED', 'B', 30],
    ['WORLD', 'D', 15],
  ] as const)
    for (const points of [1, cost - 1, cost, cost + 1]) {
      const { state } = play(route, pick, 'A', points);
      expect(state.campaign!.politicalPoints).toBe(Math.max(0, points - cost));
      if (points <= cost) {
        expect(state.currentSceneId).toBe('ENDING-VI-TREATY');
        expect(state.currentSegmentIndex).toBe(0);
        expect(state.campaign!.sealed).toBe(true);
        expect(currentCg(story, state)).toBeUndefined();
      } else expect(story.scenes[state.currentSceneId].completion?.scope).toBe('ACT');
    }
});
it('keeps resource warnings off authored trap buttons while retaining ordinary affordability gates', () => {
  const scene = story.scenes.EP09_ACT01_SC03_S_C03_FLAVOR_01_COMMON;
  const c = scene.choices.find((c) => c.id === 'B')!;
  expect(c.text).not.toMatch(/30|點數|錯誤|陷阱/);
  expect(choiceUnavailableReason(start('SACRED', 1), c)).toBeUndefined();
  expect(choiceUnavailableReason(start('SACRED', 1), { ...c, pointCostPolicy: undefined })).toMatch(
    /不足/
  );
});
it('pins all 56 original PNGs and removes production notes while preserving an actual black transition', async () => {
  const raw = await loadContent();
  let images = 0;
  for (const route of ['sacred', 'world']) {
    const audit = JSON.parse(
      await readFile(root + `/content/sources/ep09/act01/${route}/asset-audit.json`, 'utf8')
    );
    for (const item of audit.images) {
      const bytes = await readFile(root + '/' + item.path);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256);
      expect(bytes.readUInt32BE(16)).toBe(item.width);
      expect(bytes.readUInt32BE(20)).toBe(item.height);
      images++;
    }
  }
  expect(images).toBe(56);
  const scenes = Object.values(raw.scenes).filter((s) => s.chapter === 'EP09');
  expect(scenes.flatMap((s) => s.segments).some((p) => p.visual === 'BLACK')).toBe(true);
  for (const s of scenes)
    for (const p of [...s.segments, ...s.choices])
      expect(p.text).not.toMatch(
        /HIDDEN SYSTEM|CG 建議|ACT0[12]|本幕|鏡頭|flavor_only|政治點數.*[−+]/
      );
});
