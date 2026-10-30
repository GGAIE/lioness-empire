import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { act03CompletionFlags, parseEp01Act03 } from '../../scripts/ep01-act03-parser';
import { act02Options } from '../../scripts/ep01-act02-parser';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
} from '../../packages/narrative-core/engine';
import { chapterDirectory, navigableScenes } from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function start(priority = 'B') {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT03_SC01' } });
  s.flags.EP01_ACT02_PRIORITY = act02Options.find((o) => o.id === priority)!.value;
  s.decisionLog = [`EP01_ACT02_SC03:${priority}`];
  return s;
}
it('imports five source scenes, twenty CG changes and three three-way flavor choices with no effects', async () => {
  const parsed = parseEp01Act03(
    await readFile(root + '/content/sources/ep01/source-act03-v0.3.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(17);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(188);
  expect(parsed.scenes.flatMap((s) => s.segments.filter((p) => p.cg))).toHaveLength(20);
  expect(parsed.scenes.filter((s) => s.kind === 'choice')).toHaveLength(3);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(9);
  for (const scene of parsed.scenes) {
    expect(scene).toEqual(story.scenes[scene.id]);
    expect(scene.scoring).toBe('NONE');
    for (const option of scene.choices) expect(option.effects).toEqual([]);
  }
});
const combinations = ['A', 'B', 'C'].flatMap((a) =>
  ['A', 'B', 'C'].flatMap((b) => ['A', 'B', 'C'].map((c) => [a, b, c]))
);
it.each(combinations.map((values) => [values.join(''), values] as const))(
  'plays dialogue combination %s in fixed event order without numerical or route effects',
  (_label, values) => {
    let s = start();
    const original = structuredClone(s),
      images = new Set<string>(),
      events: number[] = [];
    let decision = 0;
    for (let step = 0; step < 220; step++) {
      const scene = story.scenes[s.currentSceneId];
      if (!events.includes(scene.sceneNumber!)) events.push(scene.sceneNumber!);
      images.add(currentCg(story, s)!);
      const last = s.currentSegmentIndex === scene.segments.length - 1;
      if (!(scene.kind === 'end' && last)) expect(s.flags.OLIVIA_AT_CAPITAL).toBe(false);
      s = markRead(story, s);
      if (scene.kind === 'end' && last) break;
      if (scene.kind === 'choice' && last) {
        const value = values[decision++];
        s = choose(story, s, value);
        expect(s.currentSceneId).toBe(`${scene.id}_${value}`);
      } else s = advance(story, s);
    }
    expect(decision).toBe(3);
    expect(events).toEqual([1, 2, 3, 4, 5]);
    expect(images.size).toBe(20);
    expect(s.history).toHaveLength(
      160 + (values[0] === 'C' ? 1 : 0) + (values[1] === 'C' ? 2 : 0) + (values[2] === 'C' ? 1 : 0)
    );
    expect(s.campaign).toEqual(original.campaign);
    expect(s.clear).toEqual(original.clear);
    expect(s.politicalScore).toBe(original.politicalScore);
    expect(s.politicalRoute).toBe(original.politicalRoute);
    expect(s.tarotRoute).toBe(original.tarotRoute);
    expect(s.flags).toEqual({ ...original.flags, ...act03CompletionFlags });
    expect(s.decisionLog).toEqual([
      ...original.decisionLog,
      ...['02', '03', '04'].map((n, i) => `EP01_ACT03_SC${n}:${values[i]}`),
    ]);
    expect(s.readChapters).not.toContain('EP01');
    expect(continueChapter(story, s).currentSceneId).toBe('EP01_ACT04_SC01');
    expect(markRead(story, s)).toEqual(s);
  }
);
it('keeps prior ACT II priority unchanged and adds five source sections to the directory', () => {
  for (const option of act02Options) {
    const s = start(option.id);
    const flags = structuredClone(s.flags);
    s.currentSceneId = 'EP01_ACT03_SC02';
    s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
    expect(choose(story, s, 'C').flags).toEqual(flags);
  }
  const chapter = chapterDirectory(story).find((c) => c.id === 'EP01')!;
  expect(chapter.acts[2].sections).toHaveLength(5);
  expect(chapter.acts[2].sections[1].sceneIds).toHaveLength(5);
  expect(navigableScenes(story, start()).has('EP01_ACT03_SC03')).toBe(false);
});
it('preserves exact attribution, nine replies, low-voice tags and the final subtitle', () => {
  expect(
    story.scenes.EP01_ACT03_SC01.segments.find((s) => s.speakerLabel === '芬利（低聲）')?.text
  ).toBe('「剛剛那位抱怨加班的研究者呢？」');
  expect(story.scenes.EP01_ACT03_SC04_B.segments.at(-1)?.speakerLabel).toBe('艾維斯（淡笑）');
  expect(story.scenes.EP01_ACT03_SC05.segments.at(-1)?.text).toBe('ACT III〈重返王都〉 完');
  const text = Object.values(story.scenes)
    .filter((s) => s.act === 'ACT03')
    .flatMap((s) => s.segments.map((p) => p.text))
    .join();
  expect(text).not.toMatch(/Prompt|Premium Japanese|場景作用|point_delta|SC02_COMMON/);
});
it('sets only the authored completion flags after reading the final subtitle and keeps regency false', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT03_SC05';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 2;
  s = markRead(story, s);
  expect(s.flags.OLIVIA_AT_CAPITAL).toBe(false);
  s = advance(story, s);
  expect(s.flags.OLIVIA_AT_CAPITAL).toBe(false);
  s = markRead(story, s);
  for (const [key, value] of Object.entries(act03CompletionFlags)) expect(s.flags[key]).toBe(value);
  expect(s.campaign?.politicalPoints).toBe(50);
  expect(s.campaign?.unrest).toBe(30);
  expect(continueChapter(story, s).currentSceneId).toBe('EP01_ACT04_SC01');
});
it('restores a response and its shared CG without rerolling or changing prior choices', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT03_SC03';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  s = choose(story, s, 'B');
  s = advance(story, s);
  const restored = restoreSave(JSON.parse(JSON.stringify(s)), story);
  expect(restored.notices).toEqual([]);
  expect(restored.state).toEqual(s);
  expect(currentCg(story, restored.state)).toBe('EP01-ACT03-CG03-03');
});
it('retains the source and all supplied image bytes', async () => {
  const report = (await readJson('../docs/ep01-act03-import-report.json')) as {
    source: string;
    sourceSha256: string;
    images: { path: string; sha256: string }[];
  };
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/' + report.source))).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(20);
  for (const image of report.images)
    expect(hash(await readFile(root + '/' + image.path))).toBe(image.sha256);
});
