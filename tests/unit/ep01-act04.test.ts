import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { parseEp01Act04, act04CompletionFlags } from '../../scripts/ep01-act04-parser';
import { act03CompletionFlags } from '../../scripts/ep01-act03-parser';
import {
  advance,
  choose,
  currentCg,
  initialState,
  markRead,
  continueChapter,
} from '../../packages/narrative-core/engine';
import { SceneSchema, type Story } from '../../packages/narrative-core/schema';
import { validateStory } from '../../packages/narrative-core/validate';
import { chapterDirectory } from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function start() {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT04_SC01' } });
  Object.assign(s.flags, act03CompletionFlags, { EP01_ACT02_PRIORITY: 'EASTERN_FRONT' });
  s.decisionLog = ['EP01_ACT02_SC03:B', ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`)];
  return s;
}
it('imports five source scenes, twenty corrected CGs and five effect-free three-way dialogues', async () => {
  const parsed = parseEp01Act04(
    await readFile(root + '/content/sources/ep01/source-act04-v0.4.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(25);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(173);
  expect(parsed.scenes.flatMap((s) => s.segments.filter((p) => p.cg))).toHaveLength(20);
  expect(parsed.scenes.filter((s) => s.kind === 'choice')).toHaveLength(5);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(15);
  for (const scene of parsed.scenes) {
    expect(scene).toEqual(story.scenes[scene.id]);
    expect(scene.scoring).toBe('NONE');
    for (const c of scene.choices) expect(c.effects).toEqual([]);
    if (scene.sceneNumber === 4) expect(scene.cast).not.toContain('FINLEY');
  }
  expect(chapterDirectory(story)[1].acts[3].sections).toHaveLength(5);
});
it('plays all 243 answer combinations with identical event order and no numeric or route change', () => {
  for (let route = 0; route < 243; route++) {
    let s = start(),
      encoded = route;
    const initial = structuredClone(s),
      answers: string[] = [],
      images = new Set<string>(),
      events: number[] = [];
    for (let i = 0; i < 5; i++) {
      answers.push(['A', 'B', 'C'][encoded % 3]);
      encoded = Math.floor(encoded / 3);
    }
    let count = 0;
    for (let step = 0; step < 200; step++) {
      const scene = story.scenes[s.currentSceneId],
        cg = currentCg(story, s);
      if (cg) images.add(cg);
      if (!events.includes(scene.sceneNumber!)) events.push(scene.sceneNumber!);
      const last = s.currentSegmentIndex === scene.segments.length - 1;
      s = markRead(story, s);
      if (last && scene.kind === 'end') break;
      if (last && scene.kind === 'choice') s = choose(story, s, answers[count++]);
      else s = advance(story, s);
    }
    expect(count).toBe(5);
    expect(events).toEqual([1, 2, 3, 4, 5]);
    expect(images.size).toBe(20);
    expect(s.history).toHaveLength(140 + (answers[2] === 'C' ? 1 : 0));
    expect(s.campaign).toEqual(initial.campaign);
    expect(s.clear).toEqual(initial.clear);
    expect(s.politicalScore).toBe(initial.politicalScore);
    expect(s.politicalRoute).toBe(initial.politicalRoute);
    expect(s.tarotRoute).toBe(initial.tarotRoute);
    expect(s.flags).toEqual({ ...initial.flags, ...act04CompletionFlags });
    expect(s.decisionLog).toEqual([
      ...initial.decisionLog,
      ...answers.map((a, i) => `EP01_ACT04_SC${String(i + 1).padStart(2, '0')}:${a}`),
    ]);
    expect(s.readChapters).not.toContain('EP01');
  }
}, 30000);
it('starts with five black-screen lines and no CG, then reveals the first-person corrected image', () => {
  let s = start();
  const first = story.scenes[s.currentSceneId];
  expect(first.segments[0].text).toBe('「……大公主。」');
  expect(first.segments[1].text).toBe('「大公主，別睡了。」');
  for (let i = 0; i < 5; i++) {
    expect(first.segments[i].visual).toBe('BLACK');
    expect(currentCg(story, s)).toBeUndefined();
    s = advance(story, s);
  }
  expect(first.segments[5].text).toBe('奧莉維亞睜開眼。');
  expect(first.segments[5].visual).toBe('SCENE');
  expect(currentCg(story, s)).toBe('EP01-ACT04-CG01-01');
  expect(first.directions?.some((d) => d.cue === '第一人稱構圖')).toBe(true);
  const prose = Object.values(story.scenes)
    .filter((s) => s.act === 'ACT04')
    .flatMap((s) => s.segments.map((p) => p.text))
    .join();
  expect(prose).not.toMatch(/演出備註|Prompt|ACT IV 不在此取得|第一人稱視角|\*\*/);
});
it('restores before and after a selected reply using the correct held CG without changing prior choices', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT04_SC04';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  for (const snapshot of [s, choose(story, s, 'C')]) {
    const restored = restoreSave(JSON.parse(JSON.stringify(snapshot)), story);
    expect(restored.state).toEqual(snapshot);
    expect(restored.notices).toEqual([]);
    expect(currentCg(story, restored.state)).toBe('EP01-ACT04-CG04-02');
  }
});
it('only records a father-audience request at the final fade and never grants an audience or regency', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT04_SC05_COMMON';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 2;
  s = markRead(story, s);
  expect(s.flags.FATHER_AUDIENCE_REQUESTED).toBe(false);
  s = advance(story, s);
  expect(s.flags.FATHER_AUDIENCE_REQUESTED).toBe(false);
  expect(story.scenes[s.currentSceneId].segments[s.currentSegmentIndex].visual).toBe('BLACK');
  s = markRead(story, s);
  expect(s.flags.FATHER_AUDIENCE_REQUESTED).toBe(true);
  expect(s.flags.FATHER_AUDIENCE_GRANTED).toBe(false);
  expect(s.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
  expect(markRead(story, s)).toEqual(s);
  expect(story.scenes[s.currentSceneId].completion?.nextSceneId).toBe('EP01_ACT05_SC01');
  expect(continueChapter(story, s).currentSceneId).toBe('EP01_ACT05_SC01');
});
it('rejects gameplay effects and story loops on flavor decisions, keeping state-merge exploration sound', () => {
  const sample = structuredClone(story.scenes.EP01_ACT04_SC01);
  sample.choices[0].effects = [{ type: 'score', delta: 10 }];
  expect(SceneSchema.safeParse(sample).success).toBe(false);
  const cyclic = structuredClone(story);
  cyclic.scenes.EP01_ACT04_SC01_COMMON.next = 'EP01_ACT04_SC01';
  expect(
    validateStory(cyclic).errors.some((e) => e.includes('flavor choices must not be revisited'))
  ).toBe(true);
});
it('verifies all twenty PNGs against the supplied corrected manifest and retains the source bytes', async () => {
  const report = (await readJson('../docs/ep01-act04-import-report.json')) as {
    source: string;
    sourceSha256: string;
    images: { path: string; zipEntry: string; sha256: string }[];
  };
  const supplied = JSON.parse(
    await readFile(root + '/content/sources/ep01/act04-cg-manifest-v0.1.json', 'utf8')
  ) as { file: string; sha256: string }[];
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/' + report.source))).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(20);
  for (const image of report.images) {
    expect(hash(await readFile(root + '/' + image.path))).toBe(image.sha256);
    expect(supplied.find((a) => a.file === image.zipEntry)?.sha256).toBe(image.sha256);
  }
});
