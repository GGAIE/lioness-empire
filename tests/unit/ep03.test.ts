import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, root } from '../../scripts/load-content';
import { parseEp03Act } from '../../scripts/ep03-parser';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  markRead,
} from '../../packages/narrative-core/engine';
import { chapterDirectory, navigableScenes } from '../../packages/narrative-core/directory';
import { auditSpeakers } from '../../scripts/speaker-annotations';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story, GameState } from '../../packages/narrative-core/schema';
import audit from '../../content/sources/ep03/asset-audit.json' with { type: 'json' };
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
function start(id = 'EP03_ACT01_SC01') {
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.readChapters = ['EP01', 'EP02'];
  state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
  state.campaign!.upkeep = [
    { chapter: 'EP02', unrest: 30, cost: 0 },
    { chapter: 'EP03', unrest: 30, cost: 0 },
  ];
  return state;
}
it('imports the exact five screenplays, including all dialogue, thought, letter and branch paragraphs', async () => {
  for (const act of [1, 2, 3, 4, 5]) {
    const file = `sources/ep03/act0${act}/${act === 4 ? '05' : '00'}.md`,
      source = await readFile(root + '/content/' + file, 'utf8'),
      choices =
        act === 4 ? await readFile(root + '/content/sources/ep03/act04/06.md', 'utf8') : undefined,
      parsed = parseEp03Act(source, act, choices);
    expect(parsed.scenes.map((s) => story.scenes[s.id])).toEqual(parsed.scenes);
    expect(parsed.scenes.length).toBe(act === 3 ? 5 : 25);
    expect(parsed.scenes.filter((s) => s.kind === 'choice').length).toBe(act === 3 ? 0 : 5);
    expect(parsed.scenes.flatMap((s) => s.segments).length).toBe(
      [269, 324, 210, 315, 319][act - 1]
    );
    for (const use of parsed.uses) {
      const segment = story.scenes[use.sceneId].segments.find((p) => p.id === use.segmentId)!;
      const raw = (use.file === file ? source : choices!).split(/\r?\n/)[use.line - 1];
      expect(use.text).toBe(raw);
      expect(
        raw
          .replace(/\*\*/g, '')
          .replace(/^\*|\*$/g, '')
          .replace(/^> /, '')
      ).toContain(segment.text);
    }
    // Independent dialogue coverage, bounded to the screenplay (not the art prompts).
    let region = false;
    const covered = new Set(parsed.uses.map((u) => u.file + ':' + u.line));
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i],
        text = raw.trim();
      if (act === 1 && text.startsWith('# 選項對照')) break;
      if (act === 5 && text.startsWith('# 第二部分')) break;
      if (/^#{1,2} SC0[1-5]｜/.test(text)) region = act !== 3;
      if (act === 3 && text === '## 完整 VN 劇情') region = true;
      if (act === 3 && text.startsWith('## CG 提示詞')) region = false;
      if (
        !region ||
        !text ||
        text === '---' ||
        /^(?:#|\[|【(?:BG|SFX|SC\d)|\*\*(?:ID|Scene ID|時間|POV|CG 插入|ACT |EP03 |NEXT|SC\d|【道具)|`|- )/.test(
          text
        )
      )
        continue;
      if (/^\*\*[ABC][｜.]/.test(text)) continue;
      if (text.startsWith('*文件文字由 VN') || text.startsWith('【CG-')) continue;
      expect(covered.has(file + ':' + (i + 1)), file + ':' + (i + 1) + ' ' + text).toBe(true);
    }
  }
  expect(auditSpeakers(story).errors).toEqual([]);
  const paragraphs = Object.values(story.scenes)
    .filter((s) => s.chapter === 'EP03')
    .flatMap((s) => s.segments);
  expect(paragraphs.find((p) => p.text === '「有的，大公主，有的。」')?.speaker).toBe('FINLEY');
  expect(paragraphs.find((p) => p.text === '「對，有得幹了。」')?.speaker).toBe('FINLEY');
  expect(paragraphs.some((p) => p.text.startsWith('事由：塔馬拉家族交接'))).toBe(true);
  expect(paragraphs.filter((p) => p.kind === 'thought').every((p) => p.speaker === 'OLIVIA')).toBe(
    true
  );
});
it('verifies all 135 original PNGs, complete ACT02 assets and every supplied branch image', async () => {
  expect(audit.expected).toBe(135);
  expect(audit.images).toHaveLength(135);
  expect(audit.missing).toHaveLength(0);
  expect(audit.images.filter((image) => image.act === 2)).toHaveLength(27);
  expect(
    story.assets.filter((a) => a.id.startsWith('EP03-') && a.status === 'PLACEHOLDER')
  ).toHaveLength(0);
  expect(
    audit.images
      .filter((image) => image.act === 2)
      .every((image) => image.path.includes('/fixed-v1.0/'))
  ).toBe(true);
  const used = new Set(
    Object.values(story.scenes)
      .filter((s) => s.chapter === 'EP03')
      .flatMap((s) => [s.cg, ...s.segments.map((p) => p.cg)])
  );
  await Promise.all(
    audit.images.map(async (image) => {
      const asset = story.assets.find((a) => a.id === image.id)!;
      expect(asset.status).toBe('APPROVED');
      expect(used.has(image.id)).toBe(true);
      const b = await readFile(root + '/' + asset.src);
      expect(createHash('sha256').update(b).digest('hex')).toBe(image.sha256);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([image.width, image.height]);
      expect(b.subarray(-12).toString('hex')).toBe('0000000049454e44ae426082');
    })
  );
  for (const id of audit.missing)
    expect(story.assets.find((a) => a.id === id)?.status).toBe('PLACEHOLDER');
  for (const ch of [2, 3, 4])
    for (const answer of 'ABC') {
      const branch = Object.values(story.scenes).find(
        (s) => s.chapter === 'EP03' && s.cg === `EP03-ACT05-ALT_CH0${ch}_${answer}`
      )!;
      expect(branch).toBeTruthy();
      expect(story.scenes[branch.next!].cg).not.toContain('ALT_');
    }
});
it('checks all sixty branch responses and multi-choice directory gates without political or authority effects', () => {
  for (const scene of Object.values(story.scenes).filter(
    (s) => s.chapter === 'EP03' && s.kind === 'choice'
  )) {
    expect(scene.choices).toHaveLength(3);
    for (const option of scene.choices) {
      const state = start(scene.id);
      state.currentSegmentIndex = scene.segments.length - 1;
      const before = structuredClone(state);
      let next = choose(story, state, option.id);
      const response = story.scenes[next.currentSceneId];
      expect(option.effects).toEqual([]);
      expect(next.campaign).toEqual(before.campaign);
      expect(next.flags).toEqual(before.flags);
      expect(next.clear).toEqual(before.clear);
      expect(next.politicalScore).toBe(before.politicalScore);
      expect(next.politicalRoute).toBe(before.politicalRoute);
      expect(next.decisionLog).toEqual([`${scene.id}:${option.id}`]);
      expect(response.next).toBeTruthy();
      next.currentSegmentIndex = response.segments.length - 1;
      next = advance(story, next);
      expect(next.currentSceneId).toBe(response.next);
    }
  }
  const all = chapterDirectory(story).find((c) => c.id === 'EP03')!;
  expect(all.acts.map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
  const section = all.acts[4].sections[3],
    group = section.sceneIds.map((id) => story.scenes[id]);
  expect(group.filter((s) => s.kind === 'choice')).toHaveLength(3);
  const branchIds = new Set(group.flatMap((s) => s.choices.map((c) => c.next)));
  let read = group
    .filter((s) => !branchIds.has(s.id))
    .flatMap((s) => s.segments.map((p) => s.id + ':' + p.id));
  const decisions = group.filter((s) => s.kind === 'choice');
  for (let i = 0; i < decisions.length; i++) {
    expect(
      chapterDirectory(story, read).find((c) => c.id === 'EP03')!.acts[4].sections[3].read
    ).toBe(false);
    const branch = story.scenes[decisions[i].choices[0].next];
    read.push(...branch.segments.map((p) => branch.id + ':' + p.id));
  }
  expect(chapterDirectory(story, read).find((c) => c.id === 'EP03')!.acts[4].sections[3].read).toBe(
    true
  );
  const state = start('EP03_ACT05_SC01');
  expect(navigableScenes(story, state).has('EP03_ACT05_SC03')).toBe(false);
});
for (const answer of 'ABC')
  it(
    'reads the entire chapter along ' +
      answer +
      ' with exactly twenty decisions and four act continuations',
    () => {
      let state = start(),
        count = 0,
        decisions = 0,
        acts = 0;
      const before = structuredClone(state);
      for (let guard = 0; guard < 1800; guard++) {
        const scene = story.scenes[state.currentSceneId];
        count++;
        state = markRead(story, state);
        if (state.currentSegmentIndex < scene.segments.length - 1 || scene.next)
          state = advance(story, state);
        else if (scene.kind === 'choice') {
          state = choose(story, state, answer);
          decisions++;
        } else if (scene.completion?.scope === 'ACT') {
          state = continueChapter(story, state);
          acts++;
        } else break;
      }
      expect([decisions, acts]).toEqual([20, 4]);
      expect(count).toBeGreaterThan(1100);
      expect(count).toBeLessThan(1400);
      expect(state.readChapters).toContain('EP03');
      expect(state.campaign!.politicalPoints).toBe(50);
      expect(state.campaign!.unrest).toBe(30);
      expect(state.campaign!.upkeep).toEqual(before.campaign!.upkeep);
      expect(state.flags).toEqual(before.flags);
      expect(state.clear).toEqual(before.clear);
      expect(story.scenes[state.currentSceneId].completion).toMatchObject({
        scope: 'CHAPTER',
        nextChapterId: 'EP04',
      });
      expect(story.scenes[state.currentSceneId].completion?.nextSceneId).toBeUndefined();
      expect(restoreSave(state, story).state).toEqual(state);
    },
    60000
  );
it('restores an old EP02 ending, charges EP03 once at entry, and keeps insufficient entries unchanged', () => {
  const state = start('EP02_ACT05_SC05_COMMON');
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.contentVersion = '0.10.1-ep02-act05-cg-v0.2';
  state.readChapters = ['EP01'];
  state.campaign!.chapter = 'EP02';
  state.campaign!.unrest = 80;
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 80, cost: 40 }];
  state.campaign!.politicalPoints = 75;
  const restored = restoreSave(state, story).state,
    before = structuredClone(restored);
  const entered = continueChapter(story, restored);
  expect(restored).toEqual(before);
  expect(entered.currentSceneId).toBe('EP03_ACT01_SC01');
  expect(entered.campaign!.politicalPoints).toBe(35);
  expect(entered.campaign!.upkeep).toHaveLength(2);
  const retry: GameState = {
    ...entered,
    currentSceneId: state.currentSceneId,
    currentSegmentIndex: state.currentSegmentIndex,
  };
  expect(continueChapter(story, retry).campaign!.politicalPoints).toBe(35);
  const poor = structuredClone(state);
  poor.campaign!.politicalPoints = 0;
  const original = structuredClone(poor);
  expect(() => continueChapter(story, poor)).toThrow();
  expect(poor).toEqual(original);
});
