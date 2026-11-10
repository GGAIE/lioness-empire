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
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { chapterDirectory, openDirectorySection } from '../../packages/narrative-core/directory';
import type { GameState, Story } from '../../packages/narrative-core/schema';
import { explorationKey } from '../../scripts/exploration-key';
let story: Story;
beforeAll(async () => {
  story = await loadReaderContent();
});
const bestS: Record<string, string> = {
  C01: 'B',
  C02: 'B',
  C03: 'C',
  C04: 'A',
  C05: 'B',
  C06: 'C',
  C07: 'C',
  C08: 'A',
  C09: 'C',
  C10: 'B',
  C11: 'A',
  C12: 'C',
  C13: 'C',
};
const bestW: Record<string, string> = {
  W01: 'A',
  W02: 'B',
  W03: 'B',
  W04: 'B',
  W05: 'C',
  W06: 'B',
  W07: 'C',
  W08: 'B',
  W09: 'B',
  W10: 'B',
  W11: 'B',
  W12: 'C',
  W13: 'A',
};
function at(route: 'SACRED' | 'WORLD', seal = false) {
  const id = `EP07_ACT03_SC01_${route[0]}`;
  const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  s.politicalRoute = route;
  s.campaign!.politicalRoute = route;
  s.campaign!.politicalPoints = 100;
  s.flags.FINLEY_SECRETARY_SEAL = seal;
  return s;
}
function play(
  route: 'SACRED' | 'WORLD',
  seal: boolean,
  select: (code: string, options: ReturnType<typeof visibleChoices>) => string
) {
  let s = at(route, seal);
  const images = new Set<string>(),
    choices: string[] = [],
    lines: string[] = [];
  for (let i = 0; i < 150; i++) {
    const scene = story.scenes[s.currentSceneId];
    expect(scene.availableWhen).toEqual({ path: 'politicalRoute', op: 'eq', value: route });
    expect(scene.id).toMatch(new RegExp(`^EP07_ACT03_SC\\d\\d_${route[0]}(?:_|$)`));
    for (let n = 0; n < visibleSegments(story, s).length; n++) {
      const snapshot = { ...s, currentSegmentIndex: n };
      const image = currentCg(story, snapshot);
      if (image) images.add(image);
      lines.push(visibleSegments(story, s)[n].text);
    }
    s = markRead(story, { ...s, currentSegmentIndex: visibleSegments(story, s).length - 1 });
    const again = markRead(story, s);
    expect(again.campaign).toEqual(s.campaign);
    expect(again.clear).toEqual(s.clear);
    if (scene.kind === 'end') return { state: s, images, choices, lines };
    if (scene.kind === 'choice') {
      const code = scene.choices[0].next.match(/_([CW]\d\d)_[ABCD]$/)![1];
      const options = visibleChoices(story, s);
      choices.push(code);
      s = choose(story, s, select(code, options));
    } else s = advance(story, s);
    s.history = [];
    s.readSegments = [];
  }
  throw Error('No authored act ending');
}
it('connects old ACT02 endings to the corresponding world without changing route or charging upkeep', () => {
  for (const route of ['SACRED', 'WORLD'] as const) {
    const id = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP07' && s.act === 'ACT02' && s.completion && s.id.includes(`_${route[0]}_`)
    )!.id;
    let s = at(route);
    s.currentSceneId = id;
    s.currentSegmentIndex = visibleSegments(story, s).length - 1;
    s.contentVersion = '0.16.0-interlude-ep07-act01-act02.reader-v1';
    delete s.flags.EP07_S3_EVIDENCE_COUNT;
    const next = continueChapter(story, restoreSave(s, story).state);
    expect(next.currentSceneId).toBe(`EP07_ACT03_SC01_${route[0]}`);
    expect(next.campaign!.politicalPoints).toBe(100);
    expect(next.campaign!.upkeep).toEqual([]);
    expect(next.politicalRoute).toBe(route);
    const directory = chapterDirectory(story, [], next).find((c) => c.id === 'EP07')!;
    expect(directory.acts[2].sections).toHaveLength(9);
    expect(() =>
      openDirectorySection(story, next, `EP07_ACT03_SC01_${route === 'WORLD' ? 'S' : 'W'}`, true)
    ).toThrow();
  }
});
it('pays Sacred costs once and reaches each of the four authored negotiation outcomes', () => {
  for (const [ending, seal, expected, bonus] of [
    ['A', false, 'FAILURE', 20],
    ['B', false, 'PARTIAL', 40],
    ['C', false, 'FULL', 50],
    ['D', true, 'SEAL', 60],
  ] as const) {
    const run = play('SACRED', seal, (code) => (code === 'C13' ? ending : bestS[code]));
    expect(run.state.flags.EP07_SACRED_NEGOTIATION_RESULT).toBe(expected);
    expect(run.state.campaign!.politicalPoints).toBe(100 - 40 + bonus);
    expect(run.state.campaign!.unrest).toBe(30);
    expect(run.state.clear.alinda).toBe(2);
    expect(run.state.flags.ALINDA_A2_CLEAR).toBe(true);
    expect(run.images.has('EP07-ACT03-SACRED-35')).toBe(seal);
    expect(run.images.has('EP07-ACT03-SACRED-40')).toBe(ending === 'B');
    expect(run.images.has('EP07-ACT03-SACRED-41')).toBe(ending === 'C' || ending === 'D');
    expect(run.images.has('EP07-ACT03-SACRED-42')).toBe(ending === 'D');
    expect([...run.images].every((id) => id.startsWith('EP07-ACT03-SACRED-'))).toBe(true);
    for (const code of ['C03', 'C09', 'C12']) expect(run.choices.includes(code)).toBe(!seal);
    expect(run.state.flags.EP07_WORLD_FINLEY_NOTE_REQUEST_ACCEPTED).toBe(false);
  }
});
it('keeps weak Sacred investigations playable and hides unsupported evidence options', () => {
  const run = play('SACRED', false, (code, options) => {
    if (['C05', 'C06', 'C08', 'C09', 'C12'].includes(code))
      expect(options.some((c) => c.id === bestS[code])).toBe(false);
    if (code === 'C13') expect(options.map((c) => c.id)).not.toContain('D');
    return options.find((c) => c.id !== bestS[code])!.id;
  });
  expect(run.state.flags.EP07_SACRED_NEGOTIATION_RESULT).toBe('FAILURE');
  expect(run.state.flags.ALINDA_A2_CLEAR).toBe(true);
});
it('preserves the World fixed ending, keeps A2 pending, and grades records separately from tone', () => {
  for (const seal of [false, true])
    for (const tone of ['A', 'B', 'C']) {
      const run = play('WORLD', seal, (code) => (code === 'W13' ? tone : bestW[code]));
      expect(run.state.campaign!.politicalPoints).toBe(seal ? 115 : 110);
      expect(run.state.campaign!.unrest).toBe(30);
      expect(run.state.flags.EP07_W3_EVIDENCE_COUNT).toBe(12);
      expect(run.state.clear.alinda).toBe(1);
      expect(run.state.flags.ALINDA_A2_CLEAR).toBe(false);
      for (const key of [
        'VOID_LEAK_STOPPED',
        'ACADEMY_LIABILITY_ACKNOWLEDGED',
        'ALINDA_INVOICE_PENDING',
        'FINLEY_NOTE_REQUEST_ACCEPTED',
        'AYLA_FAVOR_OWED',
      ])
        expect(run.state.flags['EP07_WORLD_' + key]).toBe(true);
      expect(run.state.flags.EP07_SACRED_CHURCH_REALIGNED).toBe(false);
      for (const code of ['W08', 'W10', 'W12']) expect(run.choices.includes(code)).toBe(!seal);
      expect([...run.images].every((id) => id.startsWith('EP07-ACT03-WORLD-'))).toBe(true);
      expect(run.images.size).toBe(38);
      expect(run.lines.join('\n')).toContain('「沒問題。」');
    }
});
it('keeps incomplete World investigations playable without cancelling rescue or the note agreement', () => {
  const run = play('WORLD', false, (code, options) =>
    code === 'W13' ? 'C' : options.find((c) => c.id !== bestW[code])!.id
  );
  expect(run.state.flags.EP07_W3_EVIDENCE_COUNT).toBe(0);
  expect(run.state.campaign!.politicalPoints).toBe(100);
  expect(run.state.flags.EP07_WORLD_SETTLEMENT).toBe('BASIC');
  expect(run.state.flags.EP07_WORLD_ACADEMY_LIABILITY_ACKNOWLEDGED).toBe(true);
});
it('previews fixed Sacred support costs before commitment and preserves a low balance', () => {
  const scene = Object.values(story.scenes).find(
    (s) => s.kind === 'choice' && s.choices[0]?.next.includes('_S_C02_')
  )!;
  const s = at('SACRED');
  s.currentSceneId = scene.id;
  s.campaign!.politicalPoints = 14;
  s.currentSegmentIndex = visibleSegments(story, s).length - 1;
  for (const c of scene.choices) expect(choiceUnavailableReason(s, c)).toContain('15');
  expect(() => choose(story, s, 'A')).toThrow();
  expect(s.campaign!.politicalPoints).toBe(14);
});
it('rejects a save pointing into the other timeline instead of skipping forward through its prose', () => {
  const s = at('WORLD');
  s.currentSceneId = 'EP07_ACT03_SC01_S';
  expect(() => restoreSave(s, story)).toThrow('世界線');
});
it('collapses only balances sufficient for every future debit and keeps affordability boundaries distinct', () => {
  const key = explorationKey(story);
  const high = at('WORLD'),
    higher = structuredClone(high);
  higher.campaign!.politicalPoints = 200;
  expect(key(high)).toBe(key(higher));
  const question = Object.values(story.scenes).find(
    (s) => s.kind === 'choice' && s.choices[0]?.next.includes('_W_W04_')
  )!;
  const low = at('WORLD');
  low.currentSceneId = question.id;
  low.campaign!.politicalPoints = 4;
  const enough = structuredClone(low);
  enough.campaign!.politicalPoints = 5;
  expect(key(low)).not.toBe(key(enough));
  expect(choiceUnavailableReason(low, question.choices[0])).toContain('5');
  expect(choiceUnavailableReason(enough, question.choices[0])).toBeUndefined();
});
it('distinguishes intermediate World records and never treats the seal alone as complete evidence', () => {
  for (const count of [5, 9]) {
    const run = play('WORLD', false, (code, options) =>
      code === 'W13'
        ? 'A'
        : Number(code.slice(1)) <= count
          ? bestW[code]
          : options.find((c) => c.id !== bestW[code])!.id
    );
    expect(run.state.flags.EP07_W3_EVIDENCE_COUNT).toBe(count);
    expect(run.state.campaign!.politicalPoints).toBe(count === 5 ? 105 : 110);
  }
  const partial = play('SACRED', true, (code, options) => {
    if (code === 'C13') {
      expect(options.some((c) => c.id === 'D')).toBe(false);
      return 'C';
    }
    return options.find((c) => c.id !== bestS[code])!.id;
  });
  expect(partial.state.flags.EP07_SACRED_NEGOTIATION_RESULT).toBe('PARTIAL');
  expect(partial.state.flags.EP07_S3_EVIDENCE_COUNT).toBe(3);
  expect(partial.state.campaign!.politicalPoints).toBe(100);
});
