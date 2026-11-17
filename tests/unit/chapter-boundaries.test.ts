import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  independentChapters,
  independentEntryStates,
  verifyChapterBoundaries,
} from '../../scripts/chapter-boundaries';
import { explorationKey } from '../../scripts/exploration-key';
import { initialState } from '../../packages/narrative-core/engine';
import type { Scene } from '../../packages/narrative-core/schema';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});

it('seeds up to the maximum acyclic debit path without adding exclusive branches together', () => {
  const opening = story.scenes.EP08_ACT01_SC01_S;
  const root: Scene = {
    ...opening,
    id: 'BUDGET_ROOT',
    next: undefined,
    choices: [
      {
        id: 'A',
        text: 'A',
        next: 'BUDGET_A',
        effects: [{ type: 'points', delta: -5 }],
        previewEffects: [
          {
            when: { path: 'politicalRoute', op: 'eq', value: 'SACRED' },
            effects: [{ type: 'points', delta: -11 }],
          },
        ],
      },
      {
        id: 'B',
        text: 'B',
        next: 'BUDGET_B',
        effects: [{ type: 'points', delta: -7 }],
        previewEffects: [
          {
            when: { path: 'politicalRoute', op: 'eq', value: 'SACRED' },
            effects: [{ type: 'points', delta: -13 }],
          },
        ],
      },
    ],
  };
  const branch = (id: string, cost: number): Scene => ({
    ...opening,
    id,
    kind: 'end',
    choices: [],
    next: undefined,
    completionEffects: {
      when: { path: 'politicalRoute', op: 'eq', value: 'SACRED' },
      effects: [{ type: 'points', delta: -cost }],
    },
  });
  const incoming: Scene = {
    ...opening,
    id: 'BEFORE_BUDGET',
    chapter: 'EP07',
    choices: [],
    next: undefined,
    completion: {
      title: 'Previous act',
      nextChapterId: 'EP08',
      nextSceneId: root.id,
      policy: 'NO_SCORING',
      scope: 'ACT',
    },
  };
  const fixture = {
    ...story,
    scenes: {
      [incoming.id]: incoming,
      [root.id]: root,
      BUDGET_A: branch('BUDGET_A', 20),
      BUDGET_B: branch('BUDGET_B', 30),
    },
  };
  const seeds = independentEntryStates(fixture, 'EP08');
  expect(new Set(seeds.map((s) => s.campaign!.politicalPoints))).toEqual(
    new Set(Array.from({ length: 51 }, (_, i) => i))
  );
  expect(new Set(seeds.map((s) => s.campaign!.unrest)).size).toBe(101);
});

it('checks every unrest value and both affordability sides for each independent worldline entry', () => {
  const chapters = independentChapters(story);
  expect([...chapters]).toEqual(['EP08']);
  const report = verifyChapterBoundaries(story, chapters);
  expect(report.errors).toEqual([]);
  expect(report.checks).toBeGreaterThan(600);
});

it('refuses historical flag dependencies, character changes and external continuations', () => {
  const id = 'EP08_ACT01_SC01_S',
    original = story.scenes[id];
  const variants: Scene[] = [
    {
      ...original,
      choices: original.choices.map((c) => ({
        ...c,
        effects: [{ type: 'clear', key: 'finley', delta: 1 }],
      })),
    },
    { ...original, completionFlags: { S3_CLEAR: true } },
    {
      ...original,
      segments: original.segments.map((p) => ({
        ...p,
        when: { path: 'flags.S3_CLEAR', op: 'eq', value: true },
      })),
    },
    { ...original, next: 'EP07_ACT01_SC01' },
    { ...original, availableWhen: { path: 'flags.S3_CLEAR', op: 'eq', value: true } },
    { ...original, availableWhen: { path: 'politicalRoute', op: 'ne', value: 'SACRED' } },
    { ...original, next: id },
    {
      ...original,
      completionEffects: {
        when: { path: 'flags.EP08_SACRED_M01_SELF_NOMINATION', op: 'eq', value: true },
        effects: [{ type: 'points', delta: -10 }],
      },
    },
  ];
  for (const variant of variants)
    expect(
      independentChapters({ ...story, scenes: { ...story.scenes, [id]: variant } }).has('EP08')
    ).toBe(false);
});

it('covers all affordability thresholds and unrest inputs for the self-contained political chapter', () => {
  const states = independentEntryStates(story, 'EP08');
  expect(new Set(states.map((s) => s.politicalRoute))).toEqual(new Set(['SACRED', 'WORLD']));
  const points = new Set(states.map((s) => s.campaign!.politicalPoints));
  for (let p = 0; p <= 65; p++) expect(points.has(p)).toBe(true);
  expect(new Set(states.map((s) => s.campaign!.unrest)).size).toBe(101);
  const outside = story.scenes.EP07_ACT01_SC01;
  const contaminated = {
    ...story,
    scenes: {
      ...story.scenes,
      [outside.id]: { ...outside, completionFlags: { EP08_SACRED_CHURCH_ASKS_MORE: true } },
    },
  };
  expect(independentChapters(contaminated).has('EP08')).toBe(false);
}, 20000);

it('requires a monotonic once guard for deferred numerical and character awards', () => {
  const scene = story.scenes.EP08_ACT03_SC05_S_RESULT_BIG_SUCCESS;
  expect(independentChapters(story).has('EP08')).toBe(true);
  const unsafe = {
    ...scene,
    completionEffects: {
      ...scene.completionEffects!,
      effects: scene.completionEffects!.effects.filter(
        (e) => !(e.type === 'flag' && e.key === 'EP08_S3_SETTLED')
      ),
    },
  };
  expect(
    independentChapters({ ...story, scenes: { ...story.scenes, [scene.id]: unsafe } }).has('EP08')
  ).toBe(false);
  const root = story.scenes.EP08_ACT01_SC01_S;
  const reset = {
    ...root,
    choices: root.choices.map((c) => ({
      ...c,
      effects: [{ type: 'flag' as const, key: 'EP08_S3_SETTLED', value: false }],
    })),
  };
  expect(
    independentChapters({ ...story, scenes: { ...story.scenes, [root.id]: reset } }).has('EP08')
  ).toBe(false);
});

it('isolates only certified chapter-entry dependencies while the ordinary key preserves fee distinctions', () => {
  const scene = Object.values(story.scenes).find(
    (s) => s.chapter === 'EP07' && s.completion?.nextSceneId === 'EP08_ACT01_SC01_W'
  )!;
  const a = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } }),
    b = structuredClone(a);
  a.campaign!.politicalPoints = 0;
  b.campaign!.politicalPoints = 50;
  a.campaign!.unrest = b.campaign!.unrest = 70;
  const ordinary = explorationKey(story),
    factored = explorationKey(story, { independentChapters: independentChapters(story) });
  expect(ordinary(a)).not.toBe(ordinary(b));
  expect(factored(a)).toBe(factored(b));
  expect(a.campaign!.politicalPoints).toBe(0);
  expect(b.campaign!.politicalPoints).toBe(50);
}, 20000);
