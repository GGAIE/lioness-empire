import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { root, loadContent, readJson } from '../../scripts/load-content';
import { parseEp01Act05, act05CompletionFlags } from '../../scripts/ep01-act05-parser';
import { act04CompletionFlags } from '../../scripts/ep01-act04-parser';
import { act03CompletionFlags } from '../../scripts/ep01-act03-parser';
import {
  advance,
  choose,
  currentCg,
  initialState,
  markRead,
  continueChapter,
} from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { chapterEndNotice } from '../../packages/narrative-core/settlement';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function start() {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT05_SC01' } });
  Object.assign(s.flags, act03CompletionFlags, act04CompletionFlags, {
    EP01_ACT02_PRIORITY: 'TECHNICAL_INTERFACE',
  });
  s.decisionLog = [
    'EP01_ACT02_SC03:C',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:B`),
    ...['01', '02', '03', '04', '05'].map((n) => `EP01_ACT04_SC${n}:C`),
  ];
  return s;
}
it('imports all five scenes and the uneven 4/5/4/4/3 original CG allocation', async () => {
  const parsed = parseEp01Act05(
    await readFile(root + '/content/sources/ep01/source-act05-v0.4.md', 'utf8')
  );
  expect(parsed.scenes).toHaveLength(25);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(313);
  for (const scene of parsed.scenes) {
    expect(scene).toEqual(story.scenes[scene.id]);
    expect(scene.scoring).toBe('NONE');
    for (const c of scene.choices) expect(c.effects).toEqual([]);
  }
  expect(
    [1, 2, 3, 4, 5].map(
      (n) =>
        parsed.scenes
          .filter((s) => s.sceneNumber === n)
          .flatMap((s) => s.segments.filter((p) => p.cg)).length
    )
  ).toEqual([4, 5, 4, 4, 3]);
  expect(parsed.scenes.filter((s) => s.kind === 'choice')).toHaveLength(5);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(15);
  for (const scene of parsed.scenes.filter((s) => s.sceneNumber === 3 || s.sceneNumber === 4))
    expect(scene.cast).toEqual(['OLIVIA', 'ELVIR']);
  expect(story.scenes.EP01_ACT05_SC04.segments.at(-1)?.cg).toBe('EP01-ACT05-CG04-03');
  expect(story.scenes.EP01_ACT05_SC05_COMMON.segments.findIndex((p) => p.cg)).toBe(3);
});
it('plays all 243 answer combinations with the same twenty CGs, unchanged resources and a completed first chapter', () => {
  for (let route = 0; route < 243; route++) {
    let s = start(),
      encoded = route;
    const before = structuredClone(s),
      answers: string[] = [],
      images = new Set<string>(),
      events: number[] = [];
    for (let i = 0; i < 5; i++) {
      answers.push(['A', 'B', 'C'][encoded % 3]);
      encoded = Math.floor(encoded / 3);
    }
    let count = 0;
    for (let step = 0; step < 400; step++) {
      const scene = story.scenes[s.currentSceneId],
        cg = currentCg(story, s);
      if (cg) images.add(cg);
      if (!events.includes(scene.sceneNumber!)) events.push(scene.sceneNumber!);
      const last = s.currentSegmentIndex === scene.segments.length - 1;
      s = markRead(story, s);
      if (last && scene.kind === 'end') break;
      s = last && scene.kind === 'choice' ? choose(story, s, answers[count++]) : advance(story, s);
    }
    expect(count).toBe(5);
    expect(events).toEqual([1, 2, 3, 4, 5]);
    expect(images.size).toBe(20);
    expect(s.history).toHaveLength(
      279 -
        (answers[0] === 'A' ? 0 : 1) +
        (answers[2] === 'C' ? 1 : 0) +
        (answers[4] === 'C' ? 1 : 0)
    );
    expect(s.campaign).toEqual(before.campaign);
    expect(s.clear).toEqual(before.clear);
    expect(s.politicalRoute).toBe(before.politicalRoute);
    expect(s.tarotRoute).toBe(before.tarotRoute);
    expect(s.politicalScore).toBe(before.politicalScore);
    expect(s.flags).toEqual({ ...before.flags, ...act05CompletionFlags });
    expect(s.readChapters).toEqual(['EP01']);
    expect(s.decisionLog).toEqual([
      ...before.decisionLog,
      ...answers.map((a, i) => `EP01_ACT05_SC${String(i + 1).padStart(2, '0')}:${a}`),
    ]);
    expect(continueChapter(story, s).currentSceneId).toBe('EP02_ACT01_SC01');
  }
}, 60000);
it('records chapter facts only when the original closing caption is read and does not charge for EP02', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT05_SC05_COMMON';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 2;
  s = markRead(story, s);
  expect(s.readChapters).not.toContain('EP01');
  expect(s.flags.FATHER_AUDIENCE_COMPLETED).toBe(false);
  s = advance(story, s);
  const segment = story.scenes[s.currentSceneId].segments[s.currentSegmentIndex];
  expect(segment.text).toBe('EP01〈王冠之前〉結束。');
  expect(segment.visual).toBe('BLACK');
  const before = structuredClone(s);
  s = markRead(story, s);
  expect(s.readChapters).toEqual(['EP01']);
  expect(s.flags.FATHER_AUDIENCE_COMPLETED).toBe(true);
  expect(s.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
  expect(s.flags.OLIVIA_ADMINISTRATIVE_ROLE_GRANTED).toBe(false);
  expect(markRead(story, s)).toEqual(s);
  expect(chapterEndNotice(story.plan!, s.campaign!).lines.join()).toContain('此處僅預告');
  expect(s.campaign).toEqual(before.campaign);
  expect(story.scenes[s.currentSceneId].completion).toMatchObject({
    scope: 'CHAPTER',
    nextSceneId: 'EP02_ACT01_SC01',
  });
});
it('continues a fourth-act ending into ACT V while preserving choices and restoring mid-response', () => {
  let s = start();
  s.currentSceneId = 'EP01_ACT04_SC05_COMMON';
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  s = continueChapter(story, s);
  expect(s.currentSceneId).toBe('EP01_ACT05_SC01');
  const previous = structuredClone(s);
  s.currentSegmentIndex = story.scenes[s.currentSceneId].segments.length - 1;
  s = choose(story, s, 'B');
  const restored = restoreSave(JSON.parse(JSON.stringify(s)), story);
  expect(restored.notices).toEqual([]);
  expect(restored.state).toEqual(s);
  expect(restored.state.decisionLog.slice(0, -1)).toEqual(previous.decisionLog);
  expect(currentCg(story, s)).toBe('EP01-ACT05-CG01-03');
});
it('retains narrative quotation marks and all original dialogue, excluding production instructions and prompts', async () => {
  const source = await readFile(root + '/content/sources/ep01/source-act05-v0.4.md', 'utf8'),
    prose = source.slice(source.indexOf('### [CG01]'), source.indexOf('# 第二部分｜20 張 CG'));
  const segments = Object.values(story.scenes)
    .filter((s) => s.act === 'ACT05')
    .flatMap((s) => s.segments);
  for (const raw of prose.split(/\r?\n/)) {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith('#') ||
      line === '---' ||
      /^\*\*(?:[ABC]｜|場景結束|時間|地點|CG|場景目的)/.test(line)
    )
      continue;
    const text = line.replace(/\*\*/g, '');
    expect(
      segments.some((p) => p.text === text || text.endsWith('：' + p.text)),
      text
    ).toBe(true);
  }
  expect(segments.map((s) => s.text).join()).not.toMatch(
    /\*\*|Prompt \(EN\)|場景結束狀態：|####|COMMON A05/
  );
});
it('migrates an older fourth-act save without inventing unread fifth-act facts', () => {
  const raw = start();
  raw.contentVersion = '0.6.0-ep01-act04-v0.4';
  raw.currentSceneId = 'EP01_ACT04_SC05_COMMON';
  raw.currentSegmentIndex = story.scenes[raw.currentSceneId].segments.length - 1;
  for (const key of Object.keys(act05CompletionFlags))
    if (!['FATHER_AUDIENCE_GRANTED', 'OLIVIA_REGENCY_AUTHORITY'].includes(key))
      delete raw.flags[key];
  const restored = restoreSave(raw, story);
  expect(restored.notices.length).toBeGreaterThan(0);
  expect(restored.state.flags.FATHER_AUDIENCE_COMPLETED).toBe(false);
  expect(restored.state.flags.OLIVIA_TEMPORARY_CAPITAL_STAY).toBe(false);
  expect(restored.state.decisionLog).toEqual(raw.decisionLog);
  expect(restored.state.campaign).toEqual(raw.campaign);
  expect(continueChapter(story, restored.state).currentSceneId).toBe('EP01_ACT05_SC01');
});
it('verifies original source and every image against the supplied ZIP manifest', async () => {
  const report = (await readJson('../docs/ep01-act05-import-report.json')) as {
    source: string;
    sourceSha256: string;
    images: { path: string; zipEntry: string; sha256: string }[];
  };
  const manifest = (await readJson('sources/ep01/act05-image-manifest-v0.4.json')) as {
    File: string;
    SHA256: string;
  }[];
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  expect(hash(await readFile(root + '/' + report.source))).toBe(report.sourceSha256);
  expect(report.images).toHaveLength(20);
  for (const image of report.images) {
    expect(hash(await readFile(root + '/' + image.path))).toBe(image.sha256);
    expect(manifest.find((m) => m.File === image.zipEntry)?.SHA256.toLowerCase()).toBe(
      image.sha256
    );
  }
});
