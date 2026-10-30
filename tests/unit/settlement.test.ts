import { beforeAll, expect, it } from 'vitest';
import { loadContent } from '../../scripts/load-content';
import type { CampaignPlan, CampaignState } from '../../packages/narrative-core/campaign-schema';
import { createCampaign, enterChapter } from '../../packages/narrative-core/campaign';
import { chapterEndNotice, chapterStartNotice } from '../../packages/narrative-core/settlement';
let plan: CampaignPlan;
beforeAll(async () => {
  plan = (await loadContent()).plan!;
});
const state = (points: number, unrest: number): CampaignState => ({
  ...createCampaign(plan, { politicalPoints: points, unrest }),
  chapter: 'EP01',
  act: 5,
  completedChapters: ['PROLOGUE', 'EP01'],
});
it.each([
  [59, 0],
  [60, 10],
  [79, 10],
  [80, 40],
  [100, 40],
])(
  'warns at chapter end using unrest %i and projected cost %i without mutating state',
  (unrest, cost) => {
    const s = state(100, unrest),
      copy = structuredClone(s);
    const n = chapterEndNotice(plan, s);
    expect(n.lines.join()).toContain(`扣除 ${cost} 點`);
    expect(n.lines.join()).toContain(`預計剩餘 ${100 - cost}`);
    expect(s).toEqual(copy);
  }
);
it('warns about insufficient points without inventing a failure rule', () => {
  const n = chapterEndNotice(plan, state(5, 80));
  expect(n.severity).toBe('WARNING');
  expect(n.lines.join()).toContain('不足');
  expect(n.lines.join()).toContain('不會直接扣成負值');
});
it('reports actual entry deductions once; reopening the notice cannot deduct again', () => {
  const before = state(100, 80),
    after = enterChapter(before, plan, 'EP02').state;
  const n = chapterStartNotice(before, after);
  expect(n?.lines.join()).toContain('100 − 40 = 60');
  expect(chapterStartNotice(after, enterChapter(after, plan, 'EP02').state)).toBeNull();
  expect(after.politicalPoints).toBe(60);
});
it('keeps unknown initial values and the EP12 exception explicit', () => {
  const unknown = {
    ...createCampaign(plan),
    politicalPoints: null,
    unrest: null,
    chapter: 'PROLOGUE',
  };
  expect(chapterEndNotice(plan, unknown).severity).toBe('UNRESOLVED');
  const sealed = { ...state(100, 80), chapter: 'EP11', sealed: true };
  const n = chapterEndNotice(plan, sealed);
  expect(n.severity).toBe('UNRESOLVED');
  expect(n.lines.join()).toContain('EP12');
  expect(sealed.politicalPoints).toBe(100);
});
