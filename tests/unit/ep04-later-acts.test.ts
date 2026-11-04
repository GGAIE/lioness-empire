import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, loadReaderContent, root } from '../../scripts/load-content';
import { parseEp04LaterAct, connectEp04LaterActs } from '../../scripts/ep04-later-acts-parser';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { SceneSchema, type Story, type GameState } from '../../packages/narrative-core/schema';
import { validateStory } from '../../packages/narrative-core/validate';
import { auditSpeakers } from '../../scripts/speaker-annotations';
import review from '../../content/sources/ep04/later-act-anchors.json' with { type: 'json' };

let raw: Story, reader: Story;
const sources: Record<number, string> = {};
beforeAll(async () => {
  raw = await loadContent();
  reader = await loadReaderContent();
  for (const act of [3, 4, 5])
    sources[act] = await readFile(
      `${root}/content/sources/ep04/source-act0${act}-v${act === 4 ? '1.1' : '1.0'}.md`,
      'utf8'
    );
});
function at(id: string, f1 = 'DECLINED', points = 50) {
  const state = initialState({ ...reader, manifest: { ...reader.manifest, start: id } });
  state.flags.FINLEY_RESEARCH_F1_STATE = f1;
  state.campaign!.politicalPoints = points;
  state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 30, cost: 0 }];
  return state;
}
function readAct(state: GameState, answers: string[] = []) {
  const seen: string[] = [],
    images = new Set<string>();
  let guard = 0,
    index = 0;
  while (++guard < 1000) {
    const scene = reader.scenes[state.currentSceneId];
    seen.push(scene.id);
    const segment = visibleSegments(reader, state)[state.currentSegmentIndex];
    if (segment.cg) images.add(segment.cg);
    if (state.currentSegmentIndex === visibleSegments(reader, state).length - 1) {
      if (scene.kind === 'choice') {
        state = choose(reader, state, answers[index++] ?? '1');
        continue;
      }
      if (scene.kind === 'end')
        return { state: markRead(reader, state), seen, images, choices: index };
    }
    state = advance(reader, state);
  }
  throw Error('Story did not end');
}
it('imports all 46 nodes, 602 paragraphs and 22 answers with complete source and speaker coverage', () => {
  const parsed = ([3, 4, 5] as const).map((act) => parseEp04LaterAct(sources[act], act));
  const scenes = parsed.flatMap((p) => p.scenes);
  connectEp04LaterActs([structuredClone(raw.scenes.EP04_ACT02_SC06_COMMON), ...scenes]);
  const final = scenes.find((s) => s.completion?.nextChapterId === 'EP05')!;
  delete final.completion!.pendingLabel;
  Object.assign(final.completion!, {
    nextSceneId: 'EP05_ACT01_SC01',
    continueLabel: '進入第五章',
    nextLabel: '第五章〈攝政成為習慣〉',
  });
  expect(scenes).toEqual(
    Object.values(raw.scenes).filter(
      (s) => s.chapter === 'EP04' && ['ACT03', 'ACT04', 'ACT05'].includes(s.act)
    )
  );
  expect(scenes).toHaveLength(46);
  expect(scenes.flatMap((s) => s.segments)).toHaveLength(602);
  expect(scenes.flatMap((s) => s.choices)).toHaveLength(22);
  for (const scene of scenes) {
    SceneSchema.parse(scene);
    for (const p of scene.segments)
      if (p.kind === 'dialogue' || p.kind === 'thought') expect(scene.cast).toContain(p.speaker);
    expect(scene.status).toBe('DRAFT');
  }
  for (const annotation of review.speakers) {
    const use = parsed[0].uses.find((u) => u.line === annotation.line)!;
    expect(raw.scenes[use.sceneId].segments.find((p) => p.id === use.segmentId)?.speaker).toBe(
      annotation.speaker
    );
  }
  // Every non-heading source line inside a body is retained as prose or a
  // deliberate production/option direction; metadata before the body is excluded.
  for (const [index, act] of ([3, 4, 5] as const).entries()) {
    const used = new Set(parsed[index].uses.map((u) => u.line));
    const rows = sources[act].split(/\r?\n/);
    let body = false;
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].trim().replace(/\*\*/g, '');
      if (act === 3 && /^# SC0/.test(t)) body = false;
      if (act === 3 && (t === '## 場景正文' || t.startsWith('## A 路線'))) body = true;
      if ((act === 4 && t.startsWith('## SC01')) || (act === 5 && t.startsWith('## 第一場')))
        body = true;
      if ((act === 4 && t.startsWith('## Scene／')) || (act === 5 && t.startsWith('# 製作附錄 A')))
        break;
      if (
        !body ||
        !t ||
        t === '---' ||
        /^(#|【|> |Owner|地點：|登場人物：|POV：|結果：|系統結算：|本幕結果：|ACT03 結束|第五幕終|畫面暗下|奧莉薇雅更傾向|奧莉薇雅打算先|奧莉薇雅想追問|[12]\. |選項[一二三四]：|著重|奧莉薇雅偏向理解)/.test(
          t
        )
      )
        continue;
      expect(used.has(i + 1), `Missing ACT${act} line ${i + 1}: ${t}`).toBe(true);
    }
  }
  expect(auditSpeakers(reader).errors).toEqual([]);
  expect(validateStory(reader).errors).toEqual([]);
});
it('keeps all 61 original PNGs and explicit anchors, with only eligible branch images in each playthrough', async () => {
  let count = 0;
  for (const act of [3, 4, 5]) {
    const audit = JSON.parse(
      await readFile(`${root}/content/sources/ep04/act0${act}-asset-audit.json`, 'utf8')
    );
    expect(createHash('sha256').update(Buffer.from(sources[act])).digest('hex')).toBe(
      audit.sourceSha256
    );
    const cues = new Set(
      Object.values(raw.scenes)
        .filter((s) => s.chapter === 'EP04' && s.act === `ACT0${act}`)
        .flatMap((s) => s.segments)
        .flatMap((p) => (p.cg ? [p.cg] : []))
    );
    expect(cues).toEqual(new Set(audit.images.map((i: { id: string }) => i.id)));
    for (const image of audit.images) {
      count++;
      expect(raw.assets.find((a) => a.id === image.id)?.src).toBe(image.path);
      const b = await readFile(root + '/' + image.path);
      expect(createHash('sha256').update(b).digest('hex')).toBe(image.sha256);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([image.width, image.height]);
    }
  }
  expect(count).toBe(61);
});
it('plays all eight ACT03 choice combinations on both F1 paths without extra costs or invented flags', () => {
  for (const f1 of ['ACTIVE', 'DECLINED'])
    for (let code = 0; code < 8; code++) {
      const state = at('EP04_ACT03_SC01', f1, f1 === 'ACTIVE' ? 40 : 50);
      const before = structuredClone(state);
      const result = readAct(
        state,
        [0, 1, 2].map((i) => String(((code >> i) & 1) + 1))
      );
      expect(state).toEqual(before);
      expect(result.choices).toBe(3);
      expect(result.state.campaign).toEqual(before.campaign);
      expect(result.state.flags).toEqual({
        ...before.flags,
        FINLEY_RESEARCH_F1_STATE: f1 === 'ACTIVE' ? 'MATERIAL_OBTAINED' : 'DECLINED',
      });
      expect(result.images.size).toBe(f1 === 'ACTIVE' ? 23 : 22);
      expect(result.images.has('EP04-ACT03-CG22')).toBe(f1 === 'ACTIVE');
      expect(result.state.readChapters).not.toContain('EP04');
      expect(continueChapter(reader, result.state).currentSceneId).toBe('EP04_ACT04_SC01');
    }
});
it('skips the entire ACT04 F1 scene for unstarted/declined paths, including directory and free access', () => {
  for (const f1 of ['NOT_STARTED', 'DECLINED', 'ACTIVE']) {
    const state = at('EP04_ACT04_SC01', f1);
    const result = readAct(state);
    expect(result.choices).toBe(0);
    expect(result.seen).not.toContain('EP04_ACT04_SC05');
    expect(result.images.size).toBe(10);
    for (const n of ['09', '10', '11']) expect(result.images.has('EP04-ACT04-CG' + n)).toBe(false);
    expect(result.state.campaign!.politicalPoints).toBe(50);
    expect(navigableScenes(reader, state, true).has('EP04_ACT04_SC05')).toBe(false);
    expect(() => openDirectorySection(reader, state, 'EP04_ACT04_SC05', true)).toThrow();
    expect(
      chapterDirectory(reader, [], state)
        .flatMap((c) => c.acts.flatMap((a) => a.sections))
        .some((s) => s.id === 'EP04_ACT04_SC05')
    ).toBe(false);
    const hidden = { ...state, currentSceneId: 'EP04_ACT04_SC05' };
    expect(restoreSave(hidden, reader).state.currentSceneId).toBe('EP04_ACT04_SC06');
  }
});
it('awards +20 only at the F1 scene completion and never repeats or regresses on saves or earlier-scene replay', () => {
  let state = at('EP04_ACT04_SC05', 'MATERIAL_OBTAINED', 40);
  while (state.currentSegmentIndex < visibleSegments(reader, state).length - 1) {
    expect(state.campaign!.politicalPoints).toBe(40);
    state = advance(reader, state);
  }
  expect(state.campaign!.politicalPoints).toBe(40);
  const completed = markRead(reader, state);
  expect(completed.campaign!.politicalPoints).toBe(60);
  expect(completed.flags.FINLEY_RESEARCH_F1_STATE).toBe('CLEARED');
  expect(markRead(reader, completed)).toEqual(completed);
  expect(markRead(reader, restoreSave(completed, reader).state)).toEqual(completed);
  const earlier = openDirectorySection(reader, completed, 'EP04_ACT03_SC05', true);
  const replayed = readAct(earlier).state;
  expect(replayed.flags.FINLEY_RESEARCH_F1_STATE).toBe('CLEARED');
  expect(replayed.campaign!.politicalPoints).toBe(60);
  const replay = readAct(openDirectorySection(reader, replayed, 'EP04_ACT04_SC05', true));
  expect(replay.state.campaign!.politicalPoints).toBe(60);
  expect(replay.state.clear).toEqual(state.clear);
});
it('plays all 324 ACT05 answer combinations and applies exactly the new +10/+5/0 and +15/+5/0/-5 schedules', () => {
  for (let code = 0; code < 324; code++) {
    let n = code;
    const answers = [3, 3, 3, 3, 4].map((size) => {
      const id = String((n % size) + 1);
      n = Math.floor(n / size);
      return id;
    });
    const state = at('EP04_ACT05_SC01', 'CLEARED', 60);
    const before = structuredClone(state),
      result = readAct(state, answers);
    const delta = [10, 5, 0][Number(answers[3]) - 1] + [15, 5, 0, -5][Number(answers[4]) - 1];
    expect(result.choices).toBe(5);
    expect(result.images.size).toBe(25);
    expect(result.state.campaign!.politicalPoints).toBe(60 + delta);
    expect(result.state.campaign!.unrest).toBe(before.campaign!.unrest);
    expect(result.state.campaign!.upkeep).toEqual(before.campaign!.upkeep);
    expect(result.state.flags).toEqual(before.flags);
    expect(result.state.clear).toEqual(before.clear);
    expect(result.state.politicalScore).toBe(before.politicalScore);
    expect(result.state.politicalRoute).toBe(before.politicalRoute);
    expect(result.state.tarotRoute).toBe(before.tarotRoute);
    expect(result.state.readChapters).toContain('EP04');
    expect(reader.scenes[result.state.currentSceneId].completion).toMatchObject({
      scope: 'CHAPTER',
      nextChapterId: 'EP05',
    });
    expect(continueChapter(reader, result.state).currentSceneId).toBe('EP05_ACT01_SC01');
    expect(restoreSave(result.state, reader).state).toEqual(result.state);
  }
}, 60000);
it('continues an old ACT02 ending through all later acts, preserves resources at boundaries, and settles only the chapter ending', () => {
  for (const active of [false, true]) {
    const old = at('EP04_ACT02_SC06_COMMON', active ? 'ACTIVE' : 'DECLINED', active ? 40 : 50);
    old.contentVersion = '0.12.1-ep04-act02-v1.0-art-final-v0.3.reader-v1';
    old.currentSegmentIndex = visibleSegments(reader, old).length - 1;
    let state = continueChapter(reader, restoreSave(old, reader).state);
    expect(state.currentSceneId).toBe('EP04_ACT03_SC01');
    for (const act of [3, 4]) {
      state = readAct(state).state;
      expect(reader.scenes[state.currentSceneId].completion?.scope).toBe('ACT');
      const before = state.campaign!.politicalPoints;
      state = continueChapter(reader, state);
      expect(state.campaign!.politicalPoints).toBe(before);
      expect(state.readChapters).not.toContain('EP04');
    }
    state = readAct(state, ['1', '1', '1', '1', '1']).state;
    expect(state.campaign!.politicalPoints).toBe(active ? 85 : 75);
    expect(state.flags.FINLEY_RESEARCH_F1_STATE).toBe(active ? 'CLEARED' : 'DECLINED');
    expect(state.readChapters).toContain('EP04');
    expect(state.campaign!.upkeep).toHaveLength(1);
  }
});
it('validates conditional targets and completion guards as strictly as ordinary story links', () => {
  const story = structuredClone(reader);
  story.scenes.EP04_ACT04_SC04.conditionalNext!.next = 'missing';
  expect(validateStory(story).errors.join()).toContain('missing conditional next');
  story.scenes.EP04_ACT04_SC05.completionEffects!.effects.push({
    type: 'flag',
    key: 'UNDECLARED',
    value: true,
  });
  expect(validateStory(story).errors.join()).toContain('invalid completion effect flag');
  const { next, ...missingFallback } = reader.scenes.EP04_ACT04_SC04;
  expect(SceneSchema.safeParse(missingFallback).success).toBe(false);
});
