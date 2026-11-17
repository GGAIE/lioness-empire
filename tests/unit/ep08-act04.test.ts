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
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { chapterDirectory, navigableScenes } from '../../packages/narrative-core/directory';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
let cases: { choices: string; result: string; shalia_clear_delta: number; ending_cg: string }[];
beforeAll(async () => {
  story = await loadReaderContent();
  cases = JSON.parse(
    await readFile(
      root + '/content/sources/ep08/act04/sacred/04_Production/All_81_Choice_Combinations.json',
      'utf8'
    )
  ).cases;
});
function start(route: 'SACRED' | 'WORLD', points = 100, unrest = 30) {
  const end = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT03' &&
      s.completion &&
      s.id.startsWith(`EP08_ACT03_SC05_${route[0]}`)
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.campaign!.politicalPoints = points;
  state.campaign!.unrest = unrest;
  state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
  state.clear.shalia = 3;
  state.flags.S3_CLEAR = true;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.flags.EP08_S3_M01 = 'A';
  state.flags.EP08_S3_M02 = 'A';
  state.flags.EP08_S3_M03 = 'A';
  state.flags.EP08_WORLD_ACT03_LOCAL_SUPPORT = 'DAILY_RECOVERY';
  state.flags.EP08_WORLD_ACT03_HISTORY_RELEASE = 'LOCAL_FIRST';
  state.contentVersion = '0.22.0-ep08-act03.reader-v1';
  for (const [key, def] of Object.entries(story.manifest.flags))
    if (def.description?.includes('第八章第四幕')) delete state.flags[key];
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  const next = continueChapter(story, restoreSave(state, story).state);
  expect(next.currentSceneId).toBe(`EP08_ACT04_SC01_${route[0]}`);
  expect(next.campaign!.politicalPoints).toBe(points);
  expect(next.campaign!.upkeep).toEqual(state.campaign!.upkeep);
  expect(chapterDirectory(story, [], next).find((c) => c.id === 'EP08')!.acts[3].title).toBe(
    route === 'SACRED' ? '慈悲的價碼' : '未降臨的寒冰'
  );
  return next;
}
function play(route: 'SACRED' | 'WORLD', picks: string, flavor = 'A', points = 100, unrest = 30) {
  let state = start(route, points, unrest),
    index = 0,
    flavors = 0,
    ended = false;
  const images = new Set<string>(),
    text: string[] = [];
  for (let turn = 0; turn < 200; turn++) {
    const scene = story.scenes[state.currentSceneId];
    expect(evaluate(state, scene.availableWhen!)).toBe(true);
    const segments = visibleSegments(story, state);
    for (let i = 0; i < segments.length; i++) {
      const cg = currentCg(story, { ...state, currentSegmentIndex: i });
      if (cg) images.add(cg);
      const p = segments[i];
      text.push(p.text);
      if (p.text.startsWith('「')) expect(p.speaker).toBeTruthy();
      expect(p.text).not.toMatch(
        /NOTIFIED|LETTER_SENT|CLEAR|CG\d|ACT\d|分支|整幕結算|幕後系統|製作：|鏡頭|無影響選項/
      );
    }
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    expect(markRead(story, state).clear).toEqual(state.clear);
    expect(markRead(story, state).campaign).toEqual(state.campaign);
    if (!state.flags[`EP08_${route}_ACT04_SETTLED`]) {
      expect(state.campaign!.politicalPoints).toBe(points);
      expect(state.campaign!.unrest).toBe(unrest);
    }
    if (scene.kind === 'end') {
      expect(scene.completion).toMatchObject({ scope: 'ACT', nextChapterId: 'EP08' });
      expect(scene.completion!.pendingLabel).toContain('第五幕');
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
      const next = choose(story, state, isFlavor ? flavor : picks[index++]);
      if (isFlavor) {
        expect(next.flags).toEqual(state.flags);
        expect(next.clear).toEqual(state.clear);
      }
      expect(next.campaign!.politicalPoints).toBe(state.campaign!.politicalPoints);
      state = next;
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  expect(ended).toBe(true);
  expect(index).toBe(4);
  expect(flavors).toBe(route === 'SACRED' ? 14 : 12);
  expect(state.flags.S3_CLEAR).toBe(true);
  expect(state.flags.FINLEY_SECRETARY_SEAL).toBe(true);
  expect(state.flags.EP08_S3_M01).toBe('A');
  expect(state.politicalRoute).toBe(route);
  expect(state.campaign!.upkeep).toHaveLength(1);
  return { state, images, text: text.join('\n') };
}
it('resolves all 81 Sacred combinations, all flavor replies and only one of four result CGs', () => {
  const values: Record<string, number[]> = {
    BIG_SUCCESS: [20, 10],
    SUCCESS: [10, 5],
    SMALL_FAILURE: [-10, 5],
    BIG_FAILURE: [-20, 10],
  };
  for (const row of cases)
    for (const flavor of 'ABC') {
      const { state, images, text } = play('SACRED', row.choices, flavor);
      expect(state.flags.EP08_SACRED_ACT04_RESULT).toBe(row.result);
      expect(state.clear.shalia).toBe(3 + row.shalia_clear_delta);
      expect(state.campaign!.politicalPoints).toBe(100 + values[row.result][0]);
      expect(state.campaign!.unrest).toBe(30 + values[row.result][1]);
      expect(images.size).toBe(33);
      expect([...images].filter((id) => /CG3[1-4]$/.test(id))).toEqual([
        'EP08-ACT04-SACRED-' + row.ending_cg,
      ]);
      for (const key of [
        'ICE_EYE_MANIFESTED',
        'ALYSSIA_FAIRY_RESEAL',
        'VILLAGES_SEVERELY_DAMAGED',
        'CHURCH_SUMMONING_INTERRUPTION_FAILED',
      ])
        expect(state.flags['EP08_SACRED_ACT04_' + key]).toBe(true);
      if (!row.shalia_clear_delta) expect(text).toContain('善後還得繼續處理');
      expect(state.flags.EP08_WORLD_ACT04_SETTLED).toBe(false);
    }
}, 30000);
it('resolves all 16 World paths with exact six-tier totals, clamping and irreversible notice results', () => {
  for (const n1 of 'AB')
    for (const n2 of 'AB')
      for (const p1 of 'AB')
        for (const p2 of 'AB')
          for (const flavor of 'ABC')
            for (const unrest of [2, 30, 95]) {
              const notified = n1 === 'A' || n2 === 'A',
                good = Number(p1 === 'A') + Number(p2 === 'A');
              const { state, images, text } = play('WORLD', n1 + n2 + p1 + p2, flavor, 100, unrest);
              expect(state.flags.EP08_W4_NOTIFIED).toBe(notified);
              expect(state.flags.EP08_WORLD_SHALIA_ACT04_EVENT).toBe(
                notified ? 'COMPLETE' : 'FAILED'
              );
              expect(state.clear.shalia).toBe(3); // Source deliberately leaves the historical CLEAR mapping unresolved.
              expect(state.campaign!.politicalPoints).toBe(
                100 + (notified ? good * 10 : -50 + 15 * good)
              );
              expect(state.campaign!.unrest).toBe(
                Math.max(0, Math.min(100, unrest + (notified ? -10 - good * 10 : 50 - good * 15)))
              );
              expect(images.size).toBe(25);
              for (const [prefix, selected] of [
                ['06', n2 === 'A' ? 'A' : 'B'],
                ['07', notified ? 'A' : 'B'],
                ['12', notified ? (p1 === 'A' ? 'A' : 'B') : p1 === 'A' ? 'C' : 'D'],
                ['16', notified ? (p2 === 'A' ? 'A' : 'B') : p2 === 'A' ? 'C' : 'D'],
                ['22', notified ? 'A' : 'B'],
              ])
                expect([...images].filter((id) => id.includes('-CG' + prefix))).toEqual([
                  'EP08-ACT04-WORLD-CG' + prefix + selected,
                ]);
              expect(state.flags.EP08_WORLD_ACT04_ICE_EYE_MANIFESTED).toBe(false);
              expect(state.flags.EP08_WORLD_ACT04_SUMMONING_INTERRUPTED).toBe(true);
              expect(text).toContain('寒冰之眼，沒有降臨');
              if (notified) expect(text).not.toContain('這些不是');
              else expect(text).toContain('這些不是');
              expect(state.flags.EP08_SACRED_ACT04_SETTLED).toBe(false);
            }
}, 30000);
it('reserves unavoidable deferred costs without charging twice or stranding a poor player', () => {
  const low = start('WORLD', 19);
  low.flags.EP08_W4_N01 = 'B';
  low.currentSceneId = 'EP08_ACT04_SC02_W';
  const n2 = Object.values(story.scenes).find(
    (s) =>
      s.id.startsWith('EP08_ACT04_SC02_W') &&
      s.choices.some((c) => c.effects.some((e) => e.type === 'flag' && e.key === 'EP08_W4_N02'))
  )!;
  expect(choiceUnavailableReason(low, n2.choices[1])).toBeTruthy();
  expect(choiceUnavailableReason(low, n2.choices[0])).toBeUndefined();
  expect(play('WORLD', 'BBAA', 'A', 20).state.campaign!.politicalPoints).toBe(0);
  expect(play('SACRED', 'ABAA', 'A', 0).state.campaign!.politicalPoints).toBe(20);
  expect(play('SACRED', 'BBBB', 'A', 20).state.campaign!.politicalPoints).toBe(0);
  expect(play('SACRED', 'ABBB', 'A', 10).state.campaign!.politicalPoints).toBe(0);
  const free = start('SACRED');
  expect(
    [...navigableScenes(story, free, true)].some((id) => id.startsWith('EP08_ACT04_SC05'))
  ).toBe(false);
});
