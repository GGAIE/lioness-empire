import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, loadReaderContent, root } from '../../scripts/load-content';
import { connectEp04LaterActs } from '../../scripts/ep04-later-acts-parser';
import { parseEp04Act02 } from '../../scripts/ep04-act02-parser';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  markRead,
  choiceUnavailableReason,
} from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  continueCommittedChoice,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { SceneSchema, type Story } from '../../packages/narrative-core/schema';
import audit from '../../content/sources/ep04/act02-asset-audit.json' with { type: 'json' };
let raw: Story, reader: Story, source: string;
beforeAll(async () => {
  raw = await loadContent();
  reader = await loadReaderContent();
  source = await readFile(root + '/content/sources/ep04/source-act02-v1.0.md', 'utf8');
});
it('preserves all six scenes, seventeen answers and every screenplay line with explicit speakers', () => {
  const parsed = parseEp04Act02(source);
  connectEp04LaterActs([...parsed.scenes, raw.scenes.EP04_ACT03_SC01]);
  expect(parsed.scenes).toEqual(
    Object.values(raw.scenes).filter((s) => s.chapter === 'EP04' && s.act === 'ACT02')
  );
  expect(parsed.scenes).toHaveLength(29);
  expect(parsed.scenes.flatMap((s) => s.segments)).toHaveLength(199);
  expect(parsed.scenes.flatMap((s) => s.choices)).toHaveLength(17);
  const rows = source.split(/\r?\n/);
  const begin = rows.findIndex((r) => r.startsWith('### SC01｜'));
  const end = rows.findIndex((r) => r.startsWith('## 四、'));
  for (let i = begin; i < end; i++) {
    const t = rows[i].trim().replace(/\*\*/g, '');
    if (!t || t === '---' || /^(#|【|場景：|參與者：|說明：|→ SC|CH0|選項 |- 工程效果：)/.test(t))
      continue;
    expect(
      parsed.uses.some((u) => u.line === i + 1),
      'Missing line ' + (i + 1)
    ).toBe(true);
  }
  for (const s of parsed.scenes) {
    SceneSchema.parse(s);
    expect(s.status).toBe('DRAFT');
    for (const p of s.segments) {
      if (p.kind === 'dialogue') expect(s.cast).toContain(p.speaker);
      expect(reader.scenes[s.id].segments.find((v) => v.id === p.id)!.text).not.toMatch(
        /ACT\d|EP\d|CG |鏡頭|畫面拉|無論她是否|工程效果|SOURCE_REQUIRED/
      );
    }
    if (s.choiceMode === 'DIALOGUE_FLAVOR')
      for (const c of s.choices) expect(c.effects).toEqual([]);
  }
  expect(raw.scenes.EP04_ACT02_SC04_A.segments.map((p) => p.speaker)).toEqual([
    'OLIVIA',
    'TEA_ATTENDANT',
    'OLIVIA',
  ]);
  expect(raw.scenes.EP04_ACT02_SC04_C.segments.map((p) => p.speaker)).toEqual([
    'OLIVIA',
    'FINLEY',
    'OLIVIA',
  ]);
  expect(
    raw.scenes.EP04_ACT02_SC05.segments.find((p) => p.text.startsWith('「薩克迪也許'))?.kind
  ).toBe('caption');
});
it('registers all final PNGs byte for byte and places all 25 cues once, including three v0.4 refinements', async () => {
  expect(audit.images).toHaveLength(25);
  expect(audit.images.filter((i) => i.entry.includes('_v0.4'))).toHaveLength(3);
  expect(createHash('sha256').update(Buffer.from(source)).digest('hex')).toBe(audit.sourceSha256);
  const cues = Object.values(raw.scenes)
    .filter((s) => s.act === 'ACT02' && s.chapter === 'EP04')
    .flatMap((s) => s.segments)
    .flatMap((p) => (p.cg ? [p.cg] : []));
  expect(cues).toEqual(audit.images.map((i) => i.id));
  for (const image of audit.images) {
    const asset = reader.assets.find((a) => a.id === image.id)!;
    expect(asset.src).toBe(image.path);
    const b = await readFile(root + '/' + asset.src);
    expect(createHash('sha256').update(b).digest('hex')).toBe(image.sha256);
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([image.width, image.height]);
  }
});
it('plays all 486 combinations: only the last answer changes points and the F1 state, without rewards or chapter completion', () => {
  for (let code = 0; code < 486; code++) {
    let state = initialState({
      ...reader,
      manifest: { ...reader.manifest, start: 'EP04_ACT02_SC01' },
    });
    const before = structuredClone(state);
    let n = code % 243,
      choices = 0,
      guard = 0;
    const active = code < 243;
    while (++guard < 260) {
      const scene = reader.scenes[state.currentSceneId];
      if (state.currentSegmentIndex === scene.segments.length - 1) {
        if (scene.kind === 'choice') {
          state = choose(reader, state, choices === 5 ? (active ? '1' : '2') : 'ABC'[n % 3]);
          n = Math.floor(n / 3);
          choices++;
          continue;
        }
        if (scene.kind === 'end') {
          state = markRead(reader, state);
          break;
        }
      }
      state = advance(reader, state);
    }
    expect(choices).toBe(6);
    expect(guard).toBeLessThan(260);
    expect(state.campaign).toEqual({ ...before.campaign, politicalPoints: active ? 40 : 50 });
    expect(state.flags).toEqual({
      ...before.flags,
      FINLEY_RESEARCH_F1_STATE: active ? 'ACTIVE' : 'DECLINED',
    });
    expect(state.clear).toEqual(before.clear);
    expect(state.politicalScore).toBe(before.politicalScore);
    expect(state.politicalRoute).toBe(before.politicalRoute);
    expect(state.tarotRoute).toBe(before.tarotRoute);
    expect(state.readChapters).not.toContain('EP04');
    expect(state.campaign!.completedChapters).not.toContain('EP04');
    expect(restoreSave(state, reader).state).toEqual(state);
    expect(reader.scenes[state.currentSceneId].completion?.scope).toBe('ACT');
    expect(continueChapter(reader, state).currentSceneId).toBe('EP04_ACT03_SC01');
  }
}, 60000);
it('charges F1 once, preserves committed replay and rejects insufficient points atomically while keeping both options', () => {
  const scene = reader.scenes.EP04_ACT02_SC06;
  const state = initialState({ ...reader, manifest: { ...reader.manifest, start: scene.id } });
  state.currentSegmentIndex = scene.segments.length - 1;
  expect(scene.choices.map((c) => c.text)).toEqual(['「我知道塔瑪拉那邊好像有。」', '「裝傻。」']);
  state.campaign!.politicalPoints = 9;
  const original = structuredClone(state);
  expect(choiceUnavailableReason(state, scene.choices[0])).toContain('10');
  expect(() => choose(reader, state, '1')).toThrow('政治點數不足');
  expect(state).toEqual(original);
  expect(choose(reader, state, '2').campaign!.politicalPoints).toBe(9);
  state.campaign!.politicalPoints = 10;
  expect(choiceUnavailableReason(state, scene.choices[0])).toBeUndefined();
  const chosen = choose(reader, state, '1');
  expect(chosen.campaign!.politicalPoints).toBe(0);
  const replay = openDirectorySection(reader, chosen, scene.id, true);
  replay.currentSegmentIndex = scene.segments.length - 1;
  expect(() => choose(reader, replay, '1')).toThrow('already committed');
  expect(continueCommittedChoice(reader, replay).campaign!.politicalPoints).toBe(0);
  expect(restoreSave(chosen, reader).state).toEqual(chosen);
});
it('continues an old first-act save without another fee, migrates the new flag and includes six directory sections', () => {
  const scene = reader.scenes.EP04_ACT01_SC05_COMMON;
  const old = initialState({ ...reader, manifest: { ...reader.manifest, start: scene.id } });
  old.currentSegmentIndex = scene.segments.length - 1;
  old.contentVersion = '0.12.0-ep04-act01-v1.0-art-selected-v0.1.reader-v1';
  delete old.flags.FINLEY_RESEARCH_F1_STATE;
  old.campaign!.politicalPoints = 37;
  old.campaign!.unrest = 80;
  const restored = restoreSave(old, reader).state;
  expect(restored.flags.FINLEY_RESEARCH_F1_STATE).toBe('NOT_STARTED');
  const next = continueChapter(reader, restored);
  expect(next.currentSceneId).toBe('EP04_ACT02_SC01');
  expect(next.campaign).toEqual({ ...restored.campaign, act: 2 });
  expect(next.readChapters).not.toContain('EP04');
  expect(navigableScenes(reader, next).has('EP04_ACT02_SC02')).toBe(false);
  expect(navigableScenes(reader, next, true).has('EP04_ACT02_SC06')).toBe(true);
  expect(
    chapterDirectory(reader)
      .find((c) => c.id === 'EP04')!
      .acts.map((a) => a.sections.length)
  ).toEqual([5, 6, 5, 6, 5]);
});
