import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { parsePrologue } from '../../scripts/prologue-parser';
import { advance, initialState, markRead, currentCg } from '../../packages/narrative-core/engine';
import { SceneSchema, type Story } from '../../packages/narrative-core/schema';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
it('imports exactly 8 source scenes, 346 paragraphs, 8 CGs, and no choices', async () => {
  const source = await readFile(root + '/content/sources/prologue/source-v0.6.md', 'utf8'),
    parsed = parsePrologue(source);
  expect(parsed.scenes).toHaveLength(8);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(346);
  for (const s of parsed.scenes) {
    expect(story.scenes[s.id]).toEqual(s);
    expect(s.choices).toEqual([]);
    expect(s.scoring).toBe('NONE');
    expect(s.playback).toBe('CUTSCENE');
    expect(s.pov).toBe('ALINDA');
    expect(s.status).toBe('DRAFT');
  }
  expect(new Set(parsed.scenes.map((s) => s.cg)).size).toBe(8);
});
it('preserves source text, exact speaker spelling, thoughts and flashback captions', () => {
  expect(story.scenes['PRO-SC01'].segments[0].text).toBe('安度因的鐘聲，總是準時響起。');
  const oath = story.scenes['PRO-SC06'].segments.find((s) => s.text === '「我願意。」');
  expect(oath?.speaker).toBe('OLIVIA');
  expect(oath?.speakerLabel).toBe('奧莉維亞');
  const end = story.scenes['PRO-SC08'];
  expect(end.segments.filter((s) => s.kind === 'caption').map((s) => s.text)).toEqual([
    ' ',
    '數年前。',
    '皇家魔法學院。',
  ]);
  expect(end.segments.at(-1)?.text).toBe('一封來自王宮的召回命令，即將打斷奧莉維亞原本的生活。');
  expect(end.segments.at(-1)?.visual).toBe('BLACK');
  expect(end.segments.some((s) => s.text.includes('Premium Japanese'))).toBe(false);
  expect(end.directions?.some((d) => d.cue === '音效')).toBe(true);
});
it('walks every paragraph linearly without choices, effects, premature chapter completion or false ending', () => {
  let s = initialState(story);
  const original = structuredClone(s),
    visited: string[] = [];
  for (let step = 0; step < 1000; step++) {
    const scene = story.scenes[s.currentSceneId];
    if (!visited.includes(scene.id)) visited.push(scene.id);
    expect(scene.choices).toEqual([]);
    if (s.currentSceneId !== 'PRO-SC08') expect(s.readChapters).not.toContain('PROLOGUE');
    s = markRead(story, s);
    if (scene.kind === 'end' && s.currentSegmentIndex === scene.segments.length - 1) break;
    s = advance(story, s);
  }
  expect(visited).toEqual(
    Array.from({ length: 8 }, (_, i) => `PRO-SC${String(i + 1).padStart(2, '0')}`)
  );
  expect(s.history).toHaveLength(345);
  expect(s.readChapters).toEqual(['PROLOGUE']);
  expect(s.decisionLog).toEqual([]);
  expect(s.flags).toEqual(original.flags);
  expect(s.clear).toEqual(original.clear);
  expect(s.politicalScore).toBe(original.politicalScore);
  expect(story.scenes[s.currentSceneId].completion?.nextChapterId).toBe('EP01');
});
it('does not permit choices in a cutscene even if POV is Olivia', () => {
  const s = {
    ...story.scenes['PRO-SC01'],
    pov: 'OLIVIA',
    kind: 'choice',
    next: undefined,
    choices: [{ id: 'BAD', text: '不允許的選項', next: 'PRO-SC02', effects: [] }],
  };
  expect(SceneSchema.safeParse(s).success).toBe(false);
});
it('restores a mid-prologue save to the same paragraph and CG', () => {
  const s = { ...initialState(story), currentSceneId: 'PRO-SC04', currentSegmentIndex: 11 };
  const restored = restoreSave(JSON.parse(JSON.stringify(s)), story);
  expect(restored.notices).toEqual([]);
  expect(restored.state).toEqual(s);
  expect(currentCg(story, restored.state)).toBe('PRO-CG04');
});
it('adds missing no-scoring prologue resources with an explicit compatibility notice', () => {
  const s = initialState(story);
  delete s.campaign;
  const restored = restoreSave(s, story);
  expect(restored.state.campaign?.politicalPoints).toBe(50);
  expect(restored.state.campaign?.unrest).toBe(30);
  expect(restored.notices.join()).toContain('此過場無計分');
  expect(s.campaign).toBeUndefined();
});
it('preserves supplied source and original PNG bytes with recorded provenance', async () => {
  const report = (await readJson('../docs/prologue-import-report.json')) as {
    sourceSha256: string;
    images: { path: string; sha256: string }[];
  };
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/content/sources/prologue/source-v0.6.md'))).toBe(
    report.sourceSha256
  );
  for (const image of report.images)
    expect(hash(await readFile(root + '/' + image.path))).toBe(image.sha256);
});
