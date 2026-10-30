import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { ACT02_PRIORITY, act02Options, parseEp01Act02 } from '../../scripts/ep01-act02-parser';
import {
  advance,
  choose,
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
const start = () =>
  initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT02_SC01' } });

it('imports exactly five source scenes, twenty image cues and one source-backed three-way choice', async () => {
  const parsed = parseEp01Act02(
    await readFile(root + '/content/sources/ep01/source-act02-v0.2.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(9); // Five source scenes plus branch/common playback nodes.
  expect(new Set(parsed.scenes.map((s) => s.sceneNumber)).size).toBe(5);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(177);
  expect(parsed.scenes.flatMap((s) => s.segments.filter((p) => p.cg))).toHaveLength(20);
  expect(parsed.scenes.filter((s) => s.kind === 'choice')).toHaveLength(1);
  expect(parsed.scenes.flatMap((s) => s.choices).map((c) => c.text)).toEqual(
    act02Options.map((c) => c.text)
  );
  for (const scene of parsed.scenes) expect(scene).toEqual(story.scenes[scene.id]);
  expect(
    parsed.scenes
      .flatMap((s) => s.segments)
      .map((p) => p.text)
      .join()
  ).not.toMatch(/分支效果建議|Prompt|Dark political|時間／地點|場景功能/);
});
it('keeps speaker attribution, inline narration, choice prompt and departure ending intact', () => {
  expect(
    story.scenes.EP01_ACT02_SC01.segments.find(
      (s) => s.text === '「我離開幾天，研究室就被重新分配了？」'
    )?.speaker
  ).toBe('FINLEY');
  expect(story.scenes.EP01_ACT02_SC03.segments.at(-1)?.text).toBe(
    '返都之後，奧莉維亞應優先確認什麼？'
  );
  expect(
    story.scenes.EP01_ACT02_SC04.segments.find((s) => s.text.startsWith('「所以，」他把視線'))
      ?.speaker
  ).toBe('FAID');
  expect(story.scenes.EP01_ACT02_SC05.segments.at(-1)?.text).toBe(
    '也是兩名研究者，帶著尚未結束的工作與尚未得到答案的問題，一同前往權力中心。'
  );
});
for (const option of act02Options) {
  it(`plays only branch ${option.id}, records its priority once, merges and retains 50/30 without chapter completion`, () => {
    let s = start();
    expect(s.campaign?.act).toBe(2);
    const original = structuredClone(s);
    const images = new Set<string>(),
      visited = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const scene = story.scenes[s.currentSceneId];
      images.add(currentCg(story, s)!);
      visited.add(scene.id);
      s = markRead(story, s);
      const last = s.currentSegmentIndex === scene.segments.length - 1;
      if (last && scene.kind === 'end') break;
      s = last && scene.kind === 'choice' ? choose(story, s, option.id) : advance(story, s);
    }
    expect(images.size).toBe(20);
    expect(s.history).toHaveLength(161);
    expect(s.flags[ACT02_PRIORITY]).toBe(option.value);
    expect(s.decisionLog).toEqual([`EP01_ACT02_SC03:${option.id}`]);
    expect(visited.has(`EP01_ACT02_SC03_${option.id}`)).toBe(true);
    expect(visited.has('EP01_ACT02_SC03_COMMON')).toBe(true);
    for (const other of act02Options.filter((o) => o.id !== option.id))
      expect(visited.has(`EP01_ACT02_SC03_${other.id}`)).toBe(false);
    expect(s.campaign).toEqual(original.campaign);
    expect(s.clear).toEqual(original.clear);
    expect(s.readChapters).not.toContain('EP01');
    expect(continueChapter(story, s).currentSceneId).toBe('EP01_ACT03_SC01');
    expect(continueChapter(story, s).campaign?.act).toBe(3);
    const duplicated = {
      ...s,
      currentSceneId: 'EP01_ACT02_SC03',
      currentSegmentIndex: story.scenes.EP01_ACT02_SC03.segments.length - 1,
    };
    expect(() => choose(story, duplicated, 'B')).toThrow('already committed');
  });
}
it('saves and restores either side of the choice and adds an unset priority for old ACT I saves', () => {
  const s = start();
  s.currentSceneId = 'EP01_ACT02_SC03';
  expect(() => choose(story, s, 'A')).toThrow('Read scene');
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  for (const state of [s, choose(story, s, 'C')]) {
    const restored = restoreSave(JSON.parse(JSON.stringify(state)), story);
    expect(restored.notices).toEqual([]);
    expect(restored.state).toEqual(state);
    expect(currentCg(story, restored.state)).toBe('EP01-ACT02-CG03-03');
  }
  const old = initialState(story);
  old.contentVersion = '0.3.0-ep01-act01-v0.3';
  delete old.flags[ACT02_PRIORITY];
  const restored = restoreSave(old, story);
  expect(restored.state.flags[ACT02_PRIORITY]).toBe('NONE');
  expect(restored.notices.join()).toContain('已加入新版旗標');
  expect(old.flags[ACT02_PRIORITY]).toBeUndefined();
});
it('retains ACT I progress and resources when continuing to ACT II', () => {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT01_SC01' } });
  s.currentSceneId = 'EP01_ACT01_SC05';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  const n = continueChapter(story, s);
  expect(n.currentSceneId).toBe('EP01_ACT02_SC01');
  expect(n.campaign?.act).toBe(2);
  expect(n.campaign?.politicalPoints).toBe(50);
  expect(n.campaign?.unrest).toBe(30);
  expect(n.readChapters).not.toContain('EP01');
});
it('preserves original Markdown and all twenty PNGs', async () => {
  const report = (await readJson('../docs/ep01-act02-import-report.json')) as {
    source: string;
    sourceSha256: string;
    images: { path: string; sha256: string }[];
  };
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/' + report.source))).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(20);
  for (const a of report.images) expect(hash(await readFile(root + '/' + a.path))).toBe(a.sha256);
});
