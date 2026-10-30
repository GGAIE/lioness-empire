import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { parseEp01Act01 } from '../../scripts/ep01-act01-parser';
import {
  advance,
  continueChapter,
  currentCg,
  initialState,
  markRead,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
const entry = () =>
  initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT01_SC01' } });

it('imports the five complete source scenes, eleven CG changes and no choices or effects', async () => {
  const parsed = parseEp01Act01(
    await readFile(root + '/content/sources/ep01/source-act01-v0.3.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(5);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(143);
  expect(parsed.scenes.flatMap((s) => s.segments.filter((s) => s.cg))).toHaveLength(11);
  for (const s of parsed.scenes) {
    expect(s).toEqual(story.scenes[s.id]);
    expect(s.playback).toBe('CUTSCENE');
    expect(s.scoring).toBe('NONE');
    expect(s.choices).toEqual([]);
    expect(s.status).toBe('DRAFT');
  }
});
it('preserves the full royal letter and self-talk while excluding production notes and prompts', () => {
  const scenes = Object.values(story.scenes).filter(
    (s) => s.chapter === 'EP01' && s.act === 'ACT01'
  );
  const text = scenes.flatMap((s) => s.segments.map((s) => s.text));
  expect(text).toContain('晨鐘響過第三聲，皇家魔法學院的庭院便漸漸熱鬧起來。');
  expect(text).toContain('致奧莉維亞王女殿下：');
  expect(text).toContain(
    '鑑於國王陛下健康狀況，以及王儲艾維斯殿下須赴東線履行軍務，現通知殿下結束於皇家魔法學院之留駐，儘速返回王都。'
  );
  expect(text).toContain('返都後相關職責，由王室依正式程序另行通知。');
  expect(text).toContain('安度因王室內廷');
  expect(text.at(-1)).toBe('日光逐漸從窗沿退去。她留在原地，直到晚鐘響起。');
  expect(text.join()).not.toMatch(/場景結果|本版創作的正式文書示意|Premium|ACT I END|銜接 ACT II/);
  expect(
    scenes[3].segments.find((s) => s.text === '「……至少告訴我，他現在怎麼樣了。」')?.speaker
  ).toBe('OLIVIA');
});
it('continues from prologue with history, resources and read progress intact', () => {
  const s = initialState(story);
  expect(() => continueChapter(story, s)).toThrow();
  s.currentSceneId = 'PRO-SC08';
  s.currentSegmentIndex = story.scenes['PRO-SC08'].segments.length - 1;
  const n = continueChapter(story, s);
  expect(n.currentSceneId).toBe('EP01_ACT01_SC01');
  expect(n.currentSegmentIndex).toBe(0);
  expect(n.readChapters).toContain('PROLOGUE');
  expect(n.history.at(-1)?.sceneId).toBe('PRO-SC08');
  expect(n.campaign?.chapter).toBe('EP01');
  expect(n.campaign?.completedChapters).toContain('PROLOGUE');
  expect(n.campaign?.politicalPoints).toBe(50);
  expect(n.campaign?.unrest).toBe(30);
  expect(s.currentSceneId).toBe('PRO-SC08');
});
it('reads every paragraph and image in order without completing or settling the whole EP01', () => {
  let s = entry();
  const original = structuredClone(s);
  const images: string[] = [];
  for (let i = 0; i < 143; i++) {
    const cg = currentCg(story, s)!;
    if (!images.includes(cg)) images.push(cg);
    s = markRead(story, s);
    s = advance(story, s);
  }
  expect(images).toHaveLength(11);
  expect(s.currentSceneId).toBe('EP01_ACT01_SC05');
  expect(s.history).toHaveLength(143);
  expect(s.readChapters).not.toContain('EP01');
  expect(s.campaign).toEqual(original.campaign);
  expect(s.decisionLog).toEqual([]);
  expect(story.scenes[s.currentSceneId].completion?.scope).toBe('ACT');
  expect(continueChapter(story, s).currentSceneId).toBe('EP01_ACT02_SC01');
  expect(continueChapter(story, s).campaign?.act).toBe(2);
});
it('restores a mid-scene save after switching to the third SC04 CG', () => {
  const s = entry();
  s.currentSceneId = 'EP01_ACT01_SC04';
  s.currentSegmentIndex =
    story.scenes[s.currentSceneId].segments.findIndex((s) => s.cg === 'EP01-ACT01-CG04-03') + 1;
  const restored = restoreSave(JSON.parse(JSON.stringify(s)), story);
  expect(restored.notices).toEqual([]);
  expect(restored.state).toEqual(s);
  expect(currentCg(story, restored.state)).toBe('EP01-ACT01-CG04-03');
});
it('keeps the original source and eleven supplied image bytes', async () => {
  const report = (await readJson('../docs/ep01-act01-import-report.json')) as {
    source: string;
    sourceSha256: string;
    images: { path: string; sha256: string }[];
  };
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/' + report.source))).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(11);
  for (const a of report.images) expect(hash(await readFile(root + '/' + a.path))).toBe(a.sha256);
});
