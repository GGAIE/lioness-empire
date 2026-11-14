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
