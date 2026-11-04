import { beforeAll, expect, it } from 'vitest';
import { loadContent } from '../../scripts/load-content';
import {
  chapterDirectory,
  continueCommittedChoice,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { choose, initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
it('groups 13 chapters and 61 acts with 130 authored sections, hiding engine demos and branch internals', () => {
  const index = chapterDirectory(story);
  expect(index).toHaveLength(13);
  expect(index.flatMap((c) => c.acts)).toHaveLength(61);
  expect(index.flatMap((c) => c.acts.flatMap((a) => a.sections))).toHaveLength(130);
  expect(index[1].title).toBe('王冠之前');
  expect(index[1].acts.map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
  expect(index[1].acts[1].sections[2].sceneIds).toHaveLength(5);
  expect(
    index.flatMap((c) => c.acts.flatMap((a) => a.sections)).some((s) => s.title.includes('分支'))
  ).toBe(false);
  expect(index.some((c) => c.id === 'DEMO')).toBe(false);
});
it('counts a decision section as read after the selected response and common passage, without requiring every branch', () => {
  const ids = ['EP01_ACT02_SC03', 'EP01_ACT02_SC03_A', 'EP01_ACT02_SC03_COMMON'];
  const read = ids.flatMap((id) => story.scenes[id].segments.map((s) => `${id}:${s.id}`));
  expect(chapterDirectory(story, read)[1].acts[1].sections[2].read).toBe(true);
  expect(chapterDirectory(story, read.slice(0, -1))[1].acts[1].sections[2].read).toBe(false);
});
it('blocks jumps past an unanswered choice and opens only its committed branch', () => {
  const s = initialState(story);
  const before = navigableScenes(story, s);
  expect(before.has('EP01_ACT02_SC03')).toBe(true);
  expect(before.has('EP01_ACT02_SC04')).toBe(false);
  expect(() => openDirectorySection(story, s, 'EP01_ACT02_SC05')).toThrow();
  s.currentSceneId = 'EP01_ACT02_SC03';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  const after = choose(story, s, 'B');
  const opened = navigableScenes(story, after);
  expect(opened.has('EP01_ACT02_SC04')).toBe(true);
  expect(opened.has('EP01_ACT02_SC03_B')).toBe(true);
  expect(opened.has('EP01_ACT02_SC03_A')).toBe(false);
});
it('reopens prose without changing resources, route choices, history or the original state', () => {
  const s = initialState(story);
  s.currentSceneId = 'EP01_ACT02_SC03';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  const chosen = choose(story, s, 'C');
  const original = structuredClone(chosen);
  const reopened = openDirectorySection(story, chosen, 'EP01_ACT01_SC01');
  expect(chosen).toEqual(original);
  expect(reopened.currentSegmentIndex).toBe(0);
  expect(reopened.flags).toEqual(original.flags);
  expect(reopened.decisionLog).toEqual(original.decisionLog);
  expect(reopened.history).toEqual(original.history);
  expect(reopened.campaign?.politicalPoints).toBe(50);
  expect(reopened.campaign?.unrest).toBe(30);
  expect(reopened.campaign?.act).toBe(1);
});
it('replays a committed choice along its existing route without applying effects twice', () => {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT02_SC01' } });
  s.currentSceneId = 'EP01_ACT02_SC03';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  const chosen = choose(story, s, 'A');
  let replay = openDirectorySection(story, chosen, 'EP01_ACT02_SC03');
  expect(() => continueCommittedChoice(story, replay)).toThrow();
  replay.currentSegmentIndex = story.scenes[replay.currentSceneId].segments.length - 1;
  replay = continueCommittedChoice(story, replay);
  expect(replay.currentSceneId).toBe('EP01_ACT02_SC03_A');
  expect(replay.flags).toEqual(chosen.flags);
  expect(replay.decisionLog).toEqual(chosen.decisionLog);
  expect(replay.campaign).toEqual(chosen.campaign);
});
