import 'fake-indexeddb/auto';
import { beforeAll, expect, it } from 'vitest';
import { loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import {
  saveGame,
  backupSave,
  getSaves,
  restoreSave,
  parseImport,
  exportSave,
  mergeMeta,
  emptyMeta,
  type SaveRecord,
} from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
it('round-trips manual and autosaves through real IndexedDB API', async () => {
  const r: SaveRecord = {
    slot: '1',
    savedAt: new Date().toISOString(),
    title: 'test',
    thumbnail: null,
    state: initialState(story),
  };
  await saveGame(r);
  await saveGame({ ...r, slot: 'auto' });
  expect((await getSaves()).find((s) => s.slot === '1')).toEqual(r);
  expect(restoreSave(r.state, story).state).toEqual(r.state);
});
it('exports and imports full state without mutating original', () => {
  const r: SaveRecord = {
    slot: '2',
    savedAt: '2026-10-29',
    title: 'test',
    thumbnail: null,
    state: initialState(story),
  };
  const imported = parseImport(exportSave(r), story);
  expect(imported.state).toEqual(r.state);
  expect(imported.notices).toEqual([]);
});
it('migrates own legacy schema v1 explicitly', () => {
  const s = { ...initialState(story), schemaVersion: 1 };
  const r = restoreSave(s, story);
  expect(r.state.schemaVersion).toBe(2);
  expect(r.notices.join()).toContain('v1');
});
it('notifies on content version changes and scene aliases', () => {
  const s = { ...initialState(story), contentVersion: 'old', currentSceneId: 'DEMO_OLD_START' };
  const r = restoreSave(s, story);
  expect(r.notices).toHaveLength(2);
  expect(r.state.currentSceneId).toBe(story.manifest.migrations.DEMO_OLD_START);
  expect(s.currentSceneId).toBe('DEMO_OLD_START');
});
it('recovers a removed scene safely with explicit notice and preserves original', () => {
  const s = initialState(story);
  s.currentSceneId = 'REMOVED';
  s.flags.DEMO_INSPECTED = true;
  s.decisionLog = ['DEMO_ACT01_SC02:inspect'];
  s.readSegments = ['old:1'];
  const r = restoreSave(s, story);
  expect(r.state.currentSceneId).toBe(story.manifest.start);
  expect(r.state.decisionLog).toEqual([]);
  expect(r.state.readSegments).toEqual(['old:1']);
  expect(r.notices.length).toBeGreaterThan(0);
  expect(s.flags.DEMO_INSPECTED).toBe(true);
});
it('clamps a shortened scene with notice', () => {
  const r = restoreSave({ ...initialState(story), currentSegmentIndex: 500 }, story);
  expect(r.state.currentSegmentIndex).toBe(story.scenes[story.manifest.start].segments.length - 1);
  expect(r.notices.join()).toContain('段落');
});
it('rejects corrupt, future, contradictory and mismatched flag saves', () => {
  for (const s of [
    { ...initialState(story), schemaVersion: 999 },
    { ...initialState(story), tarotRoute: 'STAR', politicalRoute: 'WORLD' },
    { ...initialState(story), clear: { alinda: 100 } },
    { ...initialState(story), flags: { DEMO_DONE: 'true' } },
  ])
    expect(() => restoreSave(s, story)).toThrow();
  expect(() => parseImport('{}', story)).toThrow();
  expect(() => parseImport('x'.repeat(5_000_001), story)).toThrow();
});
it('keeps collection progress across alternate saves', () => {
  const s = initialState(story);
  s.readSegments = ['new'];
  const first = mergeMeta(
    { ...emptyMeta, read: ['old'], cg: ['cg-old'] },
    s,
    'cg-new',
    'DEMO_COMPLETE'
  );
  const second = mergeMeta(first, initialState(story));
  expect(second.read).toEqual(['old', 'new']);
  expect(second.cg).toEqual(['cg-old', 'cg-new']);
  expect(second.endings).toEqual(['DEMO_COMPLETE']);
});
it('serializes parallel saves in submission order', async () => {
  const make = (i: number): SaveRecord => ({
    slot: 'auto',
    savedAt: String(i),
    title: String(i),
    thumbnail: null,
    state: initialState(story),
  });
  await Promise.all(Array.from({ length: 10 }, (_, i) => saveGame(make(i))));
  expect((await getSaves()).find((s) => s.slot === 'auto')?.title).toBe('9');
});
it('preserves an original v1 record before autosave migration', async () => {
  const legacy = { ...initialState(story), schemaVersion: 1, contentVersion: 'old' };
  const r = {
    slot: 'auto',
    savedAt: '2026-10-29',
    title: 'legacy',
    thumbnail: null,
    state: legacy,
  };
  await backupSave(r);
  const backup = (await getSaves()).find((s) => s.slot.startsWith('backup-'));
  expect(backup?.state).toEqual(legacy);
  expect(JSON.parse(exportSave(backup!)).record.state.schemaVersion).toBe(1);
});
it('rejects external URLs masquerading as imported thumbnails', () => {
  const r = {
    slot: '1',
    savedAt: 'today',
    title: 'unsafe',
    thumbnail: 'https://external.example/image.png',
    state: initialState(story),
  };
  expect(() => parseImport(exportSave(r), story)).toThrow();
});
