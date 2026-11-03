import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  covers,
  coverFor,
  CoverIdSchema,
  coverAvailable,
  availableCover,
  recordRouteCompletion,
} from '../../apps/web-vn/src/engine/covers';
import {
  defaults,
  SettingsSchema,
  mergeMeta,
  emptyMeta,
  MetaSchema,
} from '../../apps/web-vn/src/storage/saves';
import { initialState } from '../../packages/narrative-core/engine';
import { loadContent, root } from '../../scripts/load-content';
import audit from '../../content/sources/covers/release-20261104/asset-audit.json' with { type: 'json' };

it('adds a default cover to old preferences without changing music, unlock state or saved values', () => {
  const { cover: _, ...old } = defaults;
  expect(
    SettingsSchema.parse({ ...old, bgm: 0.65, musicTrack: 'BGM_SIGIL', storyUnlocked: true })
  ).toEqual({ ...defaults, bgm: 0.65, musicTrack: 'BGM_SIGIL', storyUnlocked: true });
  expect(SettingsSchema.safeParse({ ...old, cover: '../invalid' }).success).toBe(false);
  expect(coverFor('invalid').id).toBe('palace');
});
it('keeps one default and six route rewards and all 24 delivered PNG/JPG files unchanged', async () => {
  expect(covers).toHaveLength(7);
  expect(audit.images).toHaveLength(24);
  for (const cover of covers) {
    expect(CoverIdSchema.parse(cover.id)).toBe(cover.id);
    if (cover.id !== 'palace')
      for (const mode of ['desktop', 'mobile'] as const)
        expect(audit.images.some((a) => a.path === cover[mode])).toBe(true);
  }
  for (const asset of audit.images) {
    const bytes = await readFile(root + '/' + asset.path);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    expect([asset.width, asset.height]).toEqual(
      asset.entry.includes('desktop') ? [1920, 1080] : [1080, 1920]
    );
  }
});

it('keeps route covers locked for old preferences, chapter progress and unrelated routes', () => {
  const old = MetaSchema.parse({ ...emptyMeta, chapters: ['EP04'], endings: ['DEMO_STAR'] });
  expect(coverAvailable('palace', old)).toBe(true);
  expect(availableCover('star-character', old)).toBe('palace');
  expect(coverAvailable('invalid', old)).toBe(false);
  for (const route of ['STAR', 'TOWER', 'CHARIOT'] as const) {
    const meta = { ...old, completedRoutes: [route] };
    for (const c of covers.slice(1))
      expect(coverAvailable(c.id, meta)).toBe(c.id.startsWith(route.toLowerCase()));
  }
});
it('awards both covers only at the final caption of an approved route ending and keeps the award', async () => {
  const original = await loadContent();
  const state = initialState(original);
  const scene = {
    ...original.scenes[state.currentSceneId],
    kind: 'end' as const,
    completion: undefined,
  };
  const story = {
    ...original,
    scenes: { ...original.scenes, [scene.id]: scene },
    endings: [
      {
        id: 'TEST_OFFICIAL_END',
        title: '結局',
        orientation: 'UPRIGHT' as const,
        grade: 'GOOD' as const,
        status: 'APPROVED' as const,
        priority: 1,
        when: { path: 'tarotRoute', op: 'eq' as const, value: 'STAR' },
        reason: 'test fixture',
        source: 'test fixture',
      },
    ],
  };
  const completed = {
    ...state,
    tarotRoute: 'STAR' as const,
    currentSegmentIndex: scene.segments.length - 1,
  };
  expect(recordRouteCompletion(emptyMeta, { ...completed, currentSegmentIndex: 0 }, story)).toBe(
    emptyMeta
  );
  expect(recordRouteCompletion(emptyMeta, completed, original)).toBe(emptyMeta);
  for (const status of ['DRAFT', 'DEMO_ONLY', 'UNRESOLVED'] as const)
    expect(
      recordRouteCompletion(emptyMeta, completed, {
        ...story,
        endings: [{ ...story.endings[0], status }],
      })
    ).toBe(emptyMeta);
  const earned = recordRouteCompletion(emptyMeta, completed, story);
  expect(earned.completedRoutes).toEqual(['STAR']);
  expect(coverAvailable('star-character', earned)).toBe(true);
  expect(coverAvailable('star-abstract', earned)).toBe(true);
  expect(coverAvailable('tower-character', earned)).toBe(false);
  expect(recordRouteCompletion(earned, completed, story)).toBe(earned);
  expect(recordRouteCompletion(earned, initialState(original), original)).toBe(earned);
  expect(mergeMeta(earned, initialState(original)).completedRoutes).toEqual(['STAR']);
});
