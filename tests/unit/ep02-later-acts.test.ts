import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, root } from '../../scripts/load-content';
import { parseEp02LaterAct } from '../../scripts/ep02-later-acts-parser';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  markRead,
} from '../../packages/narrative-core/engine';
import { chapterDirectory } from '../../packages/narrative-core/directory';
import { SceneSchema, type Story } from '../../packages/narrative-core/schema';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import audit from '../../content/sources/ep02/update-1031/asset-audit.json' with { type: 'json' };
let story: Story;
const sources: Record<number, string> = {};
beforeAll(async () => {
  story = await loadContent();
  for (const a of [3, 4, 5])
    sources[a] = await readFile(
      root + '/content/sources/ep02/update-1031/act0' + a + '-source.md',
      'utf8'
    );
});
it('imports all fifteen source scenes and 73 CG anchors, keeping the one two-option scene and zero score effects', () => {
  for (const [a, nodes, count, cgs] of [
    [3, 24, 214, 23],
    [4, 25, 401, 25],
    [5, 25, 332, 25],
  ] as const) {
    const { scenes } = parseEp02LaterAct(sources[a], a);
    expect(scenes).toHaveLength(nodes);
    expect(scenes.flatMap((s) => s.segments)).toHaveLength(count);
    expect(
      new Set(scenes.flatMap((s) => s.segments).flatMap((p) => (p.cg ? [p.cg] : []))).size
    ).toBe(cgs);
    expect(scenes.filter((s) => s.kind === 'choice').map((s) => s.choices.length)).toEqual(
      a === 3 ? [2, 3, 3, 3, 3] : [3, 3, 3, 3, 3]
    );
    for (const s of scenes) {
      if (s.completion?.scope === 'CHAPTER') {
        delete s.completion.pendingLabel;
        Object.assign(s.completion, {
          nextSceneId: 'EP03_ACT01_SC01',
          nextLabel: 'EP03〈責任先於權力〉',
          continueLabel: '進入 EP03 第三章',
        });
      }
      expect(story.scenes[s.id]).toEqual(s);
      for (const c of s.choices) expect(c.effects).toEqual([]);
    }
  }
  expect(chapterDirectory(story)[2].acts.map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
});
for (const a of [3, 4, 5] as const)
  it(
    'plays every ACT0' + a + ' branch combination without resource or authority changes',
    () => {
      const combinations = a === 3 ? 162 : 243,
        lengths: number[] = [];
      for (let code = 0; code < combinations; code++) {
        let state = initialState({
          ...story,
          manifest: { ...story.manifest, start: 'EP02_ACT0' + a + '_SC01' },
        });
        state.readChapters = ['EP01'];
        state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 30, cost: 0 }];
        state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
        const before = structuredClone(state),
          answers: string[] = [];
        let n = code;
        for (let i = 0; i < 5; i++) {
          const radix = a === 3 && i === 0 ? 2 : 3;
          answers.push('ABC'[n % radix]);
          n = Math.floor(n / radix);
        }
        let index = 0,
          guard = 0;
        while (guard++ < 500) {
          const scene = story.scenes[state.currentSceneId];
          if (a === 5 && (scene.sceneNumber ?? 0) < 3)
            expect(state.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(false);
          state = markRead(story, state);
          if (state.currentSegmentIndex === scene.segments.length - 1) {
            if (scene.kind === 'choice') {
              state = choose(story, state, answers[index++]);
              continue;
            }
            if (scene.kind === 'end') break;
          }
          state = advance(story, state);
        }
        expect(guard).toBeLessThan(500);
        expect(index).toBe(5);
        expect(state.campaign).toEqual(before.campaign);
        expect(state.flags).toEqual({ ...before.flags, AIVIS_DEPARTED_EASTERN_FRONT: a === 5 });
        expect(state.clear).toEqual(before.clear);
        expect(state.politicalRoute).toBe(before.politicalRoute);
        expect(state.tarotRoute).toBe(before.tarotRoute);
        expect(state.decisionLog).toEqual(
          answers.map((answer, i) => 'EP02_ACT0' + a + '_SC0' + (i + 1) + ':' + answer)
        );
        expect(state.readChapters).toEqual(a === 5 ? ['EP01', 'EP02'] : ['EP01']);
        if (a < 5) {
          const next = continueChapter(story, state);
          expect(next.currentSceneId).toBe('EP02_ACT0' + (a + 1) + '_SC01');
          expect(next.campaign!.politicalPoints).toBe(50);
          expect(next.campaign!.upkeep).toHaveLength(1);
        } else {
          const next = continueChapter(story, state);
          expect(next.currentSceneId).toBe('EP03_ACT01_SC01');
          expect(next.campaign!.upkeep).toHaveLength(2);
        }
        lengths.push(state.history.length);
      }
      expect([Math.min(...lengths), Math.max(...lengths)]).toEqual(
        a === 3 ? [176, 178] : a === 4 ? [361, 362] : [307, 308]
      );
    },
    90000
  );
it('preserves every source prose line while excluding metadata, prompts and technical flags from playback', () => {
  for (const a of [3, 4, 5] as const) {
    const text = sources[a],
      end = text.indexOf(a === 3 ? '## 三、逐張 CG' : a === 4 ? '# 二、CG 英文' : '# CG 製作包');
    const scenes = parseEp02LaterAct(text, a).scenes,
      segments = scenes.flatMap((s) => s.segments);
    let active = false;
    for (const raw of text.slice(0, end).split(/\r?\n/)) {
      const line = raw.trim();
      if (/^#{2,3} SC0[1-5]/.test(line)) active = false;
      if (/^#{3,4} (?:\[CG_INSERT:|【CG)/.test(line)) active = true;
      if (
        !active ||
        !line ||
        line === '---' ||
        line.startsWith('#') ||
        line.startsWith('**') ||
        line.startsWith('- **')
      )
        continue;
      const source = line.replace(/^【[^】]+】/, '').replace(/^\*([^*]+)\*$/, '$1');
      if (!source) continue;
      expect(
        segments.some((p) => p.text === source || source.endsWith('：' + p.text)),
        source
      ).toBe(true);
    }
    expect(segments.some((p) => /^\[RESULT|^\[MERGE|Scene End|SOURCE_REQUIRED/.test(p.text))).toBe(
      false
    );
  }
});
it('restores the old ACT02 ending and records departure only at the actual end of ACT05 SC03', () => {
  let old = initialState({ ...story, manifest: { ...story.manifest, start: 'EP02_ACT02_SC01' } });
  old.currentSceneId = 'EP02_ACT02_SC05_COMMON';
  old.currentSegmentIndex = story.scenes[old.currentSceneId].segments.length - 1;
  old.contentVersion = '0.9.0-ep02-act02-script-v1.1-art-v1.2';
  delete old.flags.AIVIS_DEPARTED_EASTERN_FRONT;
  const original = structuredClone(old),
    restored = restoreSave(old, story).state;
  expect(old).toEqual(original);
  expect(restored.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(false);
  expect(continueChapter(story, restored).currentSceneId).toBe('EP02_ACT03_SC01');
  const scene = story.scenes.EP02_ACT05_SC03_COMMON;
  let state = initialState({ ...story, manifest: { ...story.manifest, start: 'EP02_ACT05_SC03' } });
  state.currentSceneId = scene.id;
  state.currentSegmentIndex = scene.segments.length - 2;
  state = markRead(story, state);
  expect(state.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(false);
  state = advance(story, state);
  expect(state.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(false);
  state = markRead(story, state);
  expect(state.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(true);
  expect(restoreSave(JSON.parse(JSON.stringify(state)), story).state).toEqual(state);
  expect(
    SceneSchema.safeParse({
      ...story.scenes.EP02_ACT05_SC03,
      completionFlags: { AIVIS_DEPARTED_EASTERN_FRONT: true },
    }).success
  ).toBe(false);
});
it('keeps observation choices silent, memory speech distinct, and the complete fairy tale attributed to Finley', () => {
  const act5 = Object.values(story.scenes).filter((s) => s.act === 'ACT05' && s.chapter === 'EP02');
  const fairy: string[] = [];
  for (const scene of act5) {
    let image = scene.cg;
    for (const p of scene.segments) {
      image = p.cg ?? image;
      if (image?.endsWith('-23') || image?.endsWith('-24'))
        if (p.text.startsWith('「')) {
          expect(p.speaker).toBe('FINLEY');
          expect(p.speakerLabel).toBe('芬利（說書）');
          fairy.push(p.text);
        }
      if (scene.sceneNumber === 4 && p.speaker === 'OLIVIA')
        expect(p.speakerLabel).toBe('奧莉維亞（幼年回憶）');
      if (scene.sceneNumber === 4 && !image?.endsWith('-18') && !image?.endsWith('-19'))
        expect(p.kind).not.toBe('dialogue');
      if (p.kind === 'narration') expect(p.speaker).toBeUndefined();
    }
  }
  expect(fairy.length).toBeGreaterThan(25);
  for (const n of [3, 4])
    for (const answer of 'ABC')
      expect(
        story.scenes['EP02_ACT05_SC0' + n + '_' + answer].segments.every(
          (p) => p.kind === 'narration'
        )
      ).toBe(true);
  expect(act5.flatMap((s) => s.segments).filter((p) => p.kind === 'thought')).toHaveLength(3);
});
it('verifies all 73 real PNGs including the complete 25-image ACT05 replacement', async () => {
  expect(audit.images).toHaveLength(73);
  expect(audit.missing).toHaveLength(0);
  const fifth = audit.images.filter((x) => x.act === 5);
  expect(fifth).toHaveLength(25);
  expect(fifth.map((x) => x.cg)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  for (const x of fifth) expect(x.path).toContain('/complete-v0.2/');
  for (const x of audit.images) {
    const bytes = await readFile(root + '/' + x.path);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(x.sha256);
    expect(bytes.length).toBe(x.bytes);
    expect(story.assets.find((a) => a.id === x.id)).toMatchObject({
      status: 'APPROVED',
      src: x.path,
    });
  }
  expect(
    story.assets.filter((a) => a.id.startsWith('EP02-ACT05-') && a.status === 'PLACEHOLDER')
  ).toHaveLength(0);
});
