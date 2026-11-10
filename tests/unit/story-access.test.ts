import { beforeAll, expect, it } from 'vitest';
import { loadContent } from '../../scripts/load-content';
import { initialState, continueChapter } from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  matchesStoryPassword,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { SettingsSchema, defaults } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
it('accepts the requested password and migrates older preferences with access off', () => {
  expect(matchesStoryPassword('best')).toBe(true);
  expect(matchesStoryPassword(' best ')).toBe(true);
  for (const password of ['', 'BEST', 'wrong', 'best1'])
    expect(matchesStoryPassword(password)).toBe(false);
  const { storyUnlocked: _, ...old } = defaults;
  expect(SettingsSchema.parse({ ...old, bgm: 0.65 })).toEqual({
    ...defaults,
    bgm: 0.65,
    storyUnlocked: false,
  });
});
it('keeps conditional titles visible while opening only eligible sections without exposing demos, internal branches or future chapters', () => {
  const state = initialState(story),
    ids = chapterDirectory(story, [], state).flatMap((c) =>
      c.acts.flatMap((a) => a.sections.map((s) => s.id))
    );
  expect(ids).toHaveLength(194);
  const eligible = navigableScenes(story, state, true);
  expect(eligible.size).toBe(163);
  expect([...eligible].every((id) => ids.includes(id))).toBe(true);
  expect(navigableScenes(story, state).has('EP04_ACT01_SC05')).toBe(false);
  for (const id of [
    'DEMO_ACT01_SC01',
    'EP03_ACT01_SC01_A',
    'EP04_ACT04_SC05',
    'EP07_ACT01_SC01',
    'missing',
  ])
    expect(() => openDirectorySection(story, state, id, true)).toThrow();
});
it('direct access preserves decisions, history, flags, points and receipts and never marks unvisited chapters read', () => {
  const state = initialState(story);
  state.campaign!.politicalPoints = 0;
  state.campaign!.unrest = 100;
  state.decisionLog = ['EP01_ACT02_SC03:C'];
  state.readSegments = ['EP01_ACT01_SC01:L001'];
  const before = structuredClone(state),
    next = openDirectorySection(story, state, 'EP04_ACT01_SC05', true);
  expect(state).toEqual(before);
  expect(next.currentSceneId).toBe('EP04_ACT01_SC05');
  expect(next.currentSegmentIndex).toBe(0);
  expect(next.campaign!.chapter).toBe('EP04');
  expect(next.campaign!.act).toBe(1);
  expect({ ...next, currentSceneId: before.currentSceneId, campaign: before.campaign }).toEqual(
    before
  );
  expect({
    ...next.campaign,
    chapter: before.campaign!.chapter,
    act: before.campaign!.act,
  }).toEqual(before.campaign);
  expect(() => openDirectorySection(story, state, 'EP04_ACT01_SC05')).toThrow();
});
it('allows free chapter continuation at zero points while the normal entry rules remain in force', () => {
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP02_ACT05_SC05_COMMON' },
  });
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.campaign!.politicalPoints = 0;
  state.campaign!.unrest = 100;
  state.readChapters = ['EP01'];
  const before = structuredClone(state);
  expect(() => continueChapter(story, state)).toThrow();
  const next = continueChapter(story, state, true);
  expect(state).toEqual(before);
  expect(next.currentSceneId).toBe('EP03_ACT01_SC01');
  expect(next.campaign!.politicalPoints).toBe(0);
  expect(next.campaign!.unrest).toBe(100);
  expect(next.campaign!.upkeep).toEqual(before.campaign!.upkeep);
  expect(next.flags).toEqual(before.flags);
});
