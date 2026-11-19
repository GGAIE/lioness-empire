import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  applyEffects,
  choose,
  choiceUnavailableReason,
  continueChapter,
  enterPlayerChapter,
  initialState,
  markRead,
  resolveEnding,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import {
  openDirectorySection,
  continueCommittedChoice,
} from '../../packages/narrative-core/directory';
import { explorationKey } from '../../scripts/exploration-key';
import type { Effect, Scene } from '../../packages/narrative-core/schema';
let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});
const zero = { path: 'flags.POLITICAL_POINTS_EXHAUSTED', op: 'eq' as const, value: false };
function fixture(
  points = 10,
  effects: Effect[] = [{ type: 'points', delta: -10 }],
  kind: 'choice' | 'narrative' = 'choice'
) {
  const original = story.scenes.EP08_ACT01_SC01_S;
  const scene: Scene = {
    ...original,
    id: 'RESOURCE_TEST',
    kind,
    next: kind === 'narrative' ? 'RESOURCE_AFTER' : undefined,
    choices: kind === 'choice' ? [{ id: 'A', text: 'Pay', next: 'RESOURCE_AFTER', effects }] : [],
    segments: [{ id: 'L001', kind: 'narration', text: 'Review.' }],
    completionEffects: kind === 'narrative' ? { when: zero, effects } : undefined,
  };
  const after: Scene = {
    ...original,
    id: 'RESOURCE_AFTER',
    kind: 'end',
    next: undefined,
    choices: [],
  };
  const content = {
    ...story,
    manifest: { ...story.manifest, start: scene.id },
    scenes: { ...story.scenes, [scene.id]: scene, [after.id]: after },
  };
  const state = initialState(content);
  state.politicalRoute = 'SACRED';
  state.campaign!.politicalRoute = 'SACRED';
  state.campaign!.politicalPoints = points;
  return { content, state, scene };
}
it('redirects exactly once after a real zero settlement, including Tower, and preserves all six verbatim units', () => {
  for (const route of ['NONE', 'STAR', 'CHARIOT', 'TOWER'] as const) {
    const { content, state } = fixture();
    state.tarotRoute = route;
    state.politicalRoute = route === 'CHARIOT' ? 'WORLD' : 'SACRED';
    state.campaign!.politicalRoute = state.politicalRoute;
    state.campaign!.tarotRoute = route;
    let result = choose(content, state, 'A');
    expect(result.currentSceneId).toBe('ENDING-VI-TREATY');
    expect(result.currentSegmentIndex).toBe(0);
    expect(result.campaign!.politicalPoints).toBe(0);
    expect(result.campaign!.sealed).toBe(true);
    expect(resolveEnding(result, content.endings).candidate?.id).toBe('ARCANA_06');
    const ending = content.scenes[result.currentSceneId];
    expect(ending.segments).toHaveLength(6);
    expect(ending.segments.every((p) => p.visual === 'BLACK' && p.speaker === 'FINLEY')).toBe(true);
    expect(ending.segments.at(-1)!.text).toBe('遊戲結束了，你該回主畫面了。');
    for (let i = 0; i < 6; i++) {
      expect(result.currentSegmentIndex).toBe(i);
      expect(markRead(content, result).campaign).toEqual(result.campaign);
      result = advance(content, result);
    }
    expect(result.currentSceneId).toBe(ending.id);
    expect(result.currentSegmentIndex).toBe(5);
    expect(result.readChapters).not.toContain('ENDINGS');
    expect(restoreSave(result, content).state.currentSceneId).toBe(ending.id);
    expect(() => openDirectorySection(content, result, 'EP08_ACT01_SC01_S', true)).toThrow('結束');
  }
});
it('previews and plain imports never dispatch the ending, while unaffordable choices remain blocked', () => {
  const { content, state, scene } = fixture();
  expect(choiceUnavailableReason(state, scene.choices[0])).toBeUndefined();
  expect(state.currentSceneId).toBe(scene.id);
  expect(applyEffects(state, [{ type: 'points', delta: -10 }]).currentSceneId).toBe(scene.id);
  const poor = { ...state, campaign: { ...state.campaign!, politicalPoints: 9 } };
  expect(choiceUnavailableReason(poor, scene.choices[0])).toBeTruthy();
  expect(() => choose(content, poor, 'A')).toThrow('不足');
  const imported = { ...state, campaign: { ...state.campaign!, politicalPoints: 0 } };
  expect(restoreSave(imported, content).state.currentSceneId).toBe(scene.id);
});
it('uses the final sum of a formal batch, including completion plus conditional groups', () => {
  const first = fixture(
    10,
    [
      { type: 'points', delta: -10 },
      { type: 'points', delta: 10 },
    ],
    'narrative'
  );
  expect(markRead(first.content, first.state).campaign!.politicalPoints).toBe(10);
  expect(markRead(first.content, first.state).currentSceneId).toBe('RESOURCE_TEST');
  const second = fixture(10, [{ type: 'points', delta: -20 }], 'narrative');
  second.scene.settlements = [{ when: zero, effects: [{ type: 'points', delta: 10 }] }];
  const result = markRead(second.content, second.state);
  expect(result.currentSceneId).toBe('ENDING-VI-TREATY');
  expect(result.campaign!.politicalPoints).toBe(0);
  const negative = fixture(5, [{ type: 'points', delta: -20 }], 'narrative');
  expect(markRead(negative.content, negative.state).currentSceneId).toBe('ENDING-VI-TREATY');
  const positive = fixture(10, [{ type: 'points', delta: -9 }], 'narrative');
  expect(advance(positive.content, positive.state).currentSceneId).toBe('RESOURCE_AFTER');
});
it('takes priority over all continuation APIs and exact chapter-entry upkeep', () => {
  const { content, state, scene } = fixture(10, [{ type: 'points', delta: -10 }], 'narrative');
  scene.kind = 'end';
  scene.completion = {
    title: 'End',
    scope: 'ACT',
    nextChapterId: 'EP08',
    nextSceneId: 'RESOURCE_AFTER',
    policy: 'NO_SCORING',
  };
  expect(continueChapter(content, state, true).currentSceneId).toBe('ENDING-VI-TREATY');
  scene.kind = 'choice';
  scene.completion = undefined;
  scene.choices = [{ id: 'A', text: 'Chosen', next: 'RESOURCE_AFTER', effects: [] }];
  state.decisionLog = [scene.id + ':A'];
  expect(continueCommittedChoice(content, state).currentSceneId).toBe('ENDING-VI-TREATY');
  const opening = initialState(story);
  opening.campaign!.chapter = 'EP07';
  opening.campaign!.politicalPoints = 10;
  opening.campaign!.unrest = 70;
  opening.readChapters = ['EP07'];
  expect(enterPlayerChapter(story, opening, 'EP08').currentSceneId).toBe('ENDING-VI-TREATY');
});
it('keeps zero versus positive balances distinct in verification, even for a zero-delta transaction', () => {
  const { content, state } = fixture(0, [{ type: 'points', delta: 0 }]);
  const other = { ...state, campaign: { ...state.campaign!, politicalPoints: 1 } };
  const key = explorationKey(content);
  expect(key(state)).not.toBe(key(other));
  expect(choose(content, state, 'A').currentSceneId).toBe('ENDING-VI-TREATY');
  expect(choose(content, other, 'A').currentSceneId).toBe('RESOURCE_AFTER');
}, 20000);
