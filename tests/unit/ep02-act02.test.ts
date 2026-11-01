import { beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, root } from '../../scripts/load-content';
import { parseEp02Act02 } from '../../scripts/ep02-act02-parser';
import {
  advance,
  choose,
  currentCg,
  initialState,
  markRead,
  continueChapter,
} from '../../packages/narrative-core/engine';
import { chapterDirectory } from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
import voices from '../../content/sources/ep02/act02-speakers-v1.1.json' with { type: 'json' };
import images from '../../content/sources/ep02/act02-image-manifest-script-v1.2.json' with { type: 'json' };
let story: Story, source: string;
beforeAll(async () => {
  story = await loadContent();
  source = await readFile(root + '/content/sources/ep02/source-act02-v1.1.md', 'utf8');
});
function entry() {
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP02_ACT01_SC01' },
  });
  state.currentSceneId = 'EP02_ACT01_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.readChapters = ['EP01'];
  state.campaign!.chapter = 'EP02';
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 30, cost: 0 }];
  state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  state.flags.FATHER_AUDIENCE_GRANTED = true;
  state.decisionLog = ['EP01_ACT02_SC03:B', 'EP02_ACT01_SC01:C'];
  return state;
}
it('uses the complete new screenplay: 25 nodes, 364 paragraphs, five zero-effect choices and twenty unique CGs', () => {
  const parsed = parseEp02Act02(source);
  expect(parsed.scenes).toHaveLength(25);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(364);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(15);
  for (const s of parsed.scenes) {
    expect(story.scenes[s.id]).toEqual(s);
    expect(s.completionFlags).toBeUndefined();
    for (const c of s.choices) expect(c.effects).toEqual([]);
  }
  const cues = parsed.scenes.flatMap((s) => s.segments).flatMap((p) => (p.cg ? [p.cg] : []));
  expect(cues).toHaveLength(23);
  expect(new Set(cues).size).toBe(20);
  expect(chapterDirectory(story)[2].acts.map((a) => a.sections.length)).toEqual([5, 5, 5, 5, 5]);
});
it('plays all 243 combinations without a second upkeep, changed flags, scoring, routes or chapter completion', () => {
  for (let code = 0; code < 243; code++) {
    const original = entry(),
      before = structuredClone(original);
    let state = continueChapter(story, original),
      n = code,
      count = 0,
      guard = 0;
    const enteredHistoryLength = state.history.length;
    const answers = Array.from({ length: 5 }, () => {
      const a = 'ABC'[n % 3];
      n = Math.floor(n / 3);
      return a;
    });
    while (guard++ < 400) {
      const scene = story.scenes[state.currentSceneId];
      state = markRead(story, state);
      if (state.currentSegmentIndex === scene.segments.length - 1) {
        if (scene.kind === 'choice') {
          state = choose(story, state, answers[count++]);
          continue;
        }
        if (scene.kind === 'end') break;
      }
      state = advance(story, state);
    }
    expect(guard).toBeLessThan(400);
    expect(count).toBe(5);
    expect(state.history.length - enteredHistoryLength).toBe(
      320 - Number(answers[1] !== 'A') - Number(answers[4] !== 'A')
    );
    expect(state.flags).toEqual(before.flags);
    expect(state.campaign).toEqual({ ...before.campaign, act: 2 });
    expect(state.clear).toEqual(before.clear);
    expect(state.politicalRoute).toBe(before.politicalRoute);
    expect(state.tarotRoute).toBe(before.tarotRoute);
    expect(state.readChapters).toEqual(before.readChapters);
    expect(state.decisionLog).toEqual([
      ...before.decisionLog,
      ...answers.map((a, i) => 'EP02_ACT02_SC' + String(i + 1).padStart(2, '0') + ':' + a),
    ]);
    expect(currentCg(story, state)).toBe('EP02-ACT02-CG05-04');
    expect(story.scenes[state.currentSceneId].segments[state.currentSegmentIndex].visual).toBe(
      'BLACK'
    );
    expect(continueChapter(story, state).currentSceneId).toBe('EP02_ACT03_SC01');
    expect(original).toEqual(before);
  }
}, 90000);
it('keeps every reviewed speech heading and the simultaneous exclamation as one line', () => {
  expect(voices.annotations).toHaveLength(145);
  for (const v of voices.annotations) {
    const p = story.scenes[v.sceneId].segments.find((p) => p.id === v.segmentId)!;
    expect(p).toMatchObject({
      text: v.text,
      speaker: v.speaker,
      speakerLabel: v.speakerLabel,
      kind: v.kind,
    });
  }
  const sync = story.scenes.EP02_ACT02_SC04.segments.filter((p) =>
    p.text.includes('這不是那個爛塔嗎')
  );
  expect(sync).toHaveLength(1);
  expect(sync[0].speakerLabel).toContain('奧莉維亞');
  expect(sync[0].speakerLabel).toContain('芬利');
  for (const id of ['EP02_ACT02_SC01', 'EP02_ACT02_SC03', 'EP02_ACT02_SC05_COMMON']) {
    let cg = story.scenes[id].cg;
    for (const p of story.scenes[id].segments) {
      cg = p.cg ?? cg;
      if (p.speaker === 'FINLEY')
        expect(cg).toBe(
          id.endsWith('SC01')
            ? 'EP02-ACT02-CG01-01'
            : id.endsWith('SC03')
              ? 'EP02-ACT02-CG03-04'
              : 'EP02-ACT02-CG05-01'
        );
    }
  }
});
it('returns from three memories to the current room, and holds the correct CG through choices', () => {
  expect(story.scenes.EP02_ACT02_SC04.segments.flatMap((p) => (p.cg ? [p.cg] : []))).toEqual([
    'EP02-ACT02-CG04-01',
    'EP02-ACT02-CG04-02',
    'EP02-ACT02-CG04-03',
    'EP02-ACT02-CG04-01',
    'EP02-ACT02-CG04-04',
  ]);
  expect(story.scenes.EP02_ACT02_SC05.segments.flatMap((p) => (p.cg ? [p.cg] : []))).toEqual([
    'EP02-ACT02-CG05-01',
    'EP02-ACT02-CG05-02',
    'EP02-ACT02-CG05-01',
    'EP02-ACT02-CG05-03',
    'EP02-ACT02-CG05-01',
  ]);
  for (let i = 1; i <= 5; i++) {
    const id = 'EP02_ACT02_SC' + String(i).padStart(2, '0');
    for (const a of 'ABC')
      expect(story.scenes[id + '_' + a].cg).toBe(
        'EP02-ACT02-CG0' + i + '-0' + (i === 4 ? 4 : i === 5 ? 1 : 3)
      );
  }
});
it('continues an older ACT01 ending save into ACT02 with no extra resource transaction', () => {
  const before = entry();
  before.contentVersion = '0.8.0-ep02-act01-v0.9';
  const restored = restoreSave(JSON.parse(JSON.stringify(before)), story).state;
  const state = continueChapter(story, restored);
  expect(state.currentSceneId).toBe('EP02_ACT02_SC01');
  expect(state.campaign).toEqual({ ...before.campaign, act: 2 });
  expect(restoreSave(JSON.parse(JSON.stringify(state)), story).state).toEqual(state);
});
it('preserves source prose while keeping editorial staging and artwork prompts out of the dialogue', () => {
  const prose = source.slice(source.indexOf('### [CG01]'), source.indexOf('# 第二部分｜20 張 CG'));
  const segments = parseEp02Act02(source).scenes.flatMap((s) => s.segments);
  for (const raw of prose.split(/\r?\n/)) {
    const line = raw.trim(),
      text = line.replace(/\*\*/g, '');
    if (
      !line ||
      line === '---' ||
      line.startsWith('#') ||
      line.startsWith('【CHOICE') ||
      line.startsWith('【COMMON') ||
      /^\*\*(?:[ABC]｜|SC\d|時間|地點|本場|場景)/.test(line) ||
      /^（[\s\S]*）$/.test(line) ||
      ['畫面回到桌上的附件。', '畫面回到現在。'].includes(line)
    )
      continue;
    expect(
      segments.some((p) => p.text === text || text.endsWith('：' + p.text)),
      text
    ).toBe(true);
  }
  expect(segments.some((p) => /SOURCE_REQUIRED|CG提示詞|畫面回到現在/.test(p.text))).toBe(false);
});
it('registers only SCRIPT artwork and verifies all twenty files against the new supplied manifest', async () => {
  const assets = story.assets.filter((a) => a.id.startsWith('EP02-ACT02-CG'));
  expect(assets).toHaveLength(20);
  const files = await readdir(root + '/assets/cg/ep02/act02');
  expect(files.filter((f) => f.endsWith('.png')).sort()).toEqual(images.map((r) => r.File).sort());
  for (const row of images) {
    const asset = assets.find((a) => a.src.endsWith('/' + row.File))!;
    expect(asset, row.File).toBeDefined();
    const png = await readFile(root + '/' + asset.src);
    expect(png.length).toBe(row.Bytes);
    expect(png.readUInt32BE(16)).toBe(row.Width);
    expect(png.readUInt32BE(20)).toBe(row.Height);
    expect(createHash('sha256').update(png).digest('hex')).toBe(row.SHA256.toLowerCase());
  }
  expect(assets.find((a) => a.id === 'EP02-ACT02-CG04-03')!.src).toContain('_script-v1.2.png');
});
