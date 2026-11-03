import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, loadReaderContent, root } from '../../scripts/load-content';
import { connectEp04Act02 } from '../../scripts/ep04-act02-parser';
import { parseEp04Act01 } from '../../scripts/ep04-act01-parser';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  markRead,
} from '../../packages/narrative-core/engine';
import {
  chapterDirectory,
  navigableScenes,
  openDirectorySection,
} from '../../packages/narrative-core/directory';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { SceneSchema, type Story } from '../../packages/narrative-core/schema';
import audit from '../../content/sources/ep04/act01-asset-audit.json' with { type: 'json' };
let raw: Story, reader: Story, source: string;
beforeAll(async () => {
  raw = await loadContent();
  reader = await loadReaderContent();
  source = await readFile(root + '/content/sources/ep04/source-act01-v1.0.md', 'utf8');
});
it('keeps all five source scenes, fifteen spoken answers and all authored prose with correct speakers', () => {
  const parsed = parseEp04Act01(source),
    scenes = parsed.scenes;
  expect(scenes).toHaveLength(25);
  expect(scenes.flatMap((s) => s.segments)).toHaveLength(146);
  connectEp04Act02([...scenes, raw.scenes.EP04_ACT02_SC01]);
  expect(scenes).toEqual(
    Object.values(raw.scenes).filter((s) => s.chapter === 'EP04' && s.act === 'ACT01')
  );
  for (const scene of scenes) {
    SceneSchema.parse(scene);
    expect(scene.status).toBe('DRAFT');
    expect(scene.scoring).toBe('NONE');
    for (const p of scene.segments)
      if (p.kind === 'dialogue' || p.kind === 'thought') {
        expect(p.speaker).toBeTruthy();
        expect(scene.cast).toContain(p.speaker);
      }
    for (const c of scene.choices) {
      expect(c.effects).toEqual([]);
      const response = raw.scenes[c.next];
      expect(response.segments[0]).toMatchObject({ speaker: 'OLIVIA', text: c.text });
      expect(response.next).toBe(scene.id + '_COMMON');
    }
  }
  const lines = source.split(/\r?\n/),
    end = lines.findIndex((l) => l.startsWith('## 7｜25 張 CG'));
  let active = false;
  for (let i = 0; i < end; i++) {
    const t = lines[i].trim();
    if (/^## [2-6]｜完整劇本 SC/.test(t)) active = true;
    if (
      !active ||
      !t ||
      t === '---' ||
      t.startsWith('#') ||
      t.startsWith('**') ||
      t === '畫面漸暗。' ||
      t.startsWith('【ACT01 END')
    )
      continue;
    expect(
      parsed.uses.some((u) => u.line === i + 1 && u.text === lines[i]),
      'Missing source line ' + (i + 1) + ' ' + t
    ).toBe(true);
  }
  const ludovic = raw.scenes.EP04_ACT01_SC03_C.segments.find((p) =>
    p.text.startsWith('路德維克短暫停頓')
  )!;
  expect(ludovic.speaker).toBe('LUDOVIC');
  expect(ludovic.kind).toBe('dialogue');
  const thoughts = scenes.flatMap((s) => s.segments).filter((p) => p.kind === 'thought');
  expect(thoughts).toHaveLength(4);
  expect(thoughts.every((p) => p.speaker === 'OLIVIA')).toBe(true);
  for (const s of Object.values(reader.scenes).filter(
    (s) => s.chapter === 'EP04' && s.act === 'ACT01'
  ))
    for (const p of [...s.segments, ...s.choices])
      expect(p.text).not.toMatch(/EP03|ACT|SOURCE_REQUIRED|PROPOSAL|鏡頭|本 Scene|CG\d|CLEAR/);
  expect(
    reader.scenes.EP04_ACT01_SC02.segments.some((p) => p.text.includes('攝政期限、權限邊界'))
  ).toBe(true);
  expect(
    reader.scenes.EP04_ACT01_SC01.segments.some((p) => p.text.startsWith('前些日子，許多事'))
  ).toBe(true);
});
it('uses every selected original PNG, including all nine v0.2 replacements, with exact storyboard anchors', async () => {
  expect(audit.images).toHaveLength(25);
  expect(audit.images.filter((i) => i.entry.includes('_v0.2'))).toHaveLength(9);
  expect(createHash('sha256').update(Buffer.from(source)).digest('hex')).toBe(audit.sourceSha256);
  await Promise.all(
    audit.images.map(async (image) => {
      const asset = reader.assets.find((a) => a.id === image.id)!;
      expect(asset.status).toBe('APPROVED');
      expect(asset.src).toBe(image.path);
      const b = await readFile(root + '/' + asset.src);
      expect(createHash('sha256').update(b).digest('hex')).toBe(image.sha256);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([image.width, image.height]);
    })
  );
  const segments = Object.values(raw.scenes)
    .filter((s) => s.chapter === 'EP04' && s.act === 'ACT01')
    .flatMap((s) => s.segments);
  expect(segments.filter((p) => p.cg)).toHaveLength(25);
  expect(segments.find((p) => p.cg === 'EP04-ACT01-CG02-03')?.text).toContain('她伸手接過');
  expect(segments.find((p) => p.cg === 'EP04-ACT01-CG03-03')?.speaker).toBe('MATHIEU');
  expect(segments.find((p) => p.cg === 'EP04-ACT01-CG05-03')?.text).toBe(
    '芬利推門而入，手裡帶著幾份整理過的資料。'
  );
});
it('plays every one of the 243 answer combinations without scoring or early chapter completion', () => {
  const lengths: number[] = [];
  for (let code = 0; code < 243; code++) {
    let state = initialState({
      ...reader,
      manifest: { ...reader.manifest, start: 'EP04_ACT01_SC01' },
    });
    state.readChapters = ['EP01', 'EP02', 'EP03'];
    state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 30, cost: 0 }];
    const before = structuredClone(state);
    let n = code,
      index = 0,
      guard = 0;
    while (guard++ < 200) {
      const scene = reader.scenes[state.currentSceneId];
      state = markRead(reader, state);
      if (state.currentSegmentIndex === scene.segments.length - 1) {
        if (scene.kind === 'choice') {
          state = choose(reader, state, 'ABC'[n % 3]);
          n = Math.floor(n / 3);
          index++;
          continue;
        }
        if (scene.kind === 'end') break;
      }
      state = advance(reader, state);
    }
    expect(index).toBe(5);
    expect(guard).toBeLessThan(200);
    expect(state.campaign).toEqual(before.campaign);
    expect(state.flags).toEqual(before.flags);
    expect(state.clear).toEqual(before.clear);
    expect(state.politicalScore).toBe(before.politicalScore);
    expect(state.politicalRoute).toBe(before.politicalRoute);
    expect(state.tarotRoute).toBe(before.tarotRoute);
    expect(state.readChapters).toEqual(before.readChapters);
    expect(restoreSave(state, reader).state).toEqual(state);
    const ending = reader.scenes[state.currentSceneId];
    expect(ending.completion).toMatchObject({ scope: 'ACT', nextChapterId: 'EP04' });
    expect(ending.completion?.nextSceneId).toBe('EP04_ACT02_SC01');
    expect(continueChapter(reader, state).currentSceneId).toBe('EP04_ACT02_SC01');
    lengths.push(state.history.length);
  }
  expect(Math.min(...lengths)).toBeGreaterThan(100);
  expect(Math.max(...lengths)).toBeLessThan(140);
}, 60000);
it('continues an old EP03 ending, charges EP04 only at entry and keeps the directory gated by real choices', () => {
  const scene = reader.scenes.EP03_ACT05_SC05_CH01_COMMON;
  const old = initialState({ ...reader, manifest: { ...reader.manifest, start: scene.id } });
  old.currentSegmentIndex = scene.segments.length - 1;
  old.contentVersion = '0.11.1-ep03-act02-cg-fixed.reader-v1';
  old.readChapters = ['EP01', 'EP02'];
  old.campaign!.unrest = 80;
  old.campaign!.politicalPoints = 75;
  old.campaign!.upkeep = [{ chapter: 'EP03', unrest: 80, cost: 40 }];
  const restored = restoreSave(old, reader).state,
    entered = continueChapter(reader, restored);
  expect(entered.currentSceneId).toBe('EP04_ACT01_SC01');
  expect(entered.campaign!.politicalPoints).toBe(35);
  expect(entered.campaign!.upkeep).toHaveLength(2);
  expect(restored.campaign!.politicalPoints).toBe(75);
  const repeat = {
    ...entered,
    currentSceneId: scene.id,
    currentSegmentIndex: scene.segments.length - 1,
  };
  expect(continueChapter(reader, repeat).campaign!.politicalPoints).toBe(35);
  const poor = structuredClone(old);
  poor.campaign!.politicalPoints = 0;
  const original = structuredClone(poor);
  expect(() => continueChapter(reader, poor)).toThrow();
  expect(poor).toEqual(original);
  const chapter = chapterDirectory(reader).find((c) => c.id === 'EP04')!;
  expect(chapter.acts.map((a) => a.sections.length)).toEqual([5, 6, 5, 6, 5]);
  expect(navigableScenes(reader, entered).has('EP04_ACT01_SC02')).toBe(false);
  expect(() => openDirectorySection(reader, entered, 'EP04_ACT01_SC02')).toThrow();
});
