import { beforeAll, expect, it } from 'vitest';
import { loadContent } from '../../scripts/load-content';
import {
  prepareReaderStory,
  readerNames,
  readerSpeakerLabel,
  readerTextEdits,
  readerText,
} from '../../packages/narrative-core/reader-text';
import { initialState, choose } from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import type { Story } from '../../packages/narrative-core/schema';
let original: Story, reader: Story;
beforeAll(async () => {
  original = await loadContent();
  reader = prepareReaderStory(original);
});
it('preserves the story graph and applies only reviewed text and character name changes', () => {
  const scenes = Object.values(reader.scenes).filter((s) => s.status !== 'DEMO_ONLY');
  expect(scenes.flatMap((s) => s.segments)).toHaveLength(9852);
  expect(scenes.flatMap((s) => s.choices)).toHaveLength(642);
  expect(readerTextEdits).toHaveLength(47);
  expect(readerTextEdits.filter((e) => e.choiceId)).toHaveLength(1);
  const reconstructed = structuredClone(reader.scenes);
  for (const edit of readerTextEdits) {
    const scene = reconstructed[edit.sceneId];
    const item = edit.choiceId
      ? scene.choices.find((c) => c.id === edit.choiceId)
      : scene.segments.find((p) => p.id === edit.segmentId);
    expect(item?.text).toBe(readerNames(edit.to));
    item!.text = edit.from;
  }
  const expected = structuredClone(original.scenes);
  for (const scene of Object.values(expected)) {
    if (scene.status === 'DEMO_ONLY') continue;
    for (const segment of scene.segments) {
      if (!readerTextEdits.some((e) => e.sceneId === scene.id && e.segmentId === segment.id))
        segment.text = readerNames(segment.text);
      if (segment.speakerLabel)
        segment.speakerLabel = readerSpeakerLabel(segment.speaker, segment.speakerLabel);
    }
    for (const choice of scene.choices)
      if (!readerTextEdits.some((e) => e.sceneId === scene.id && e.choiceId === choice.id))
        choice.text = readerNames(choice.text);
  }
  expect(reconstructed).toEqual(expected);
  expect(reader.assets).toEqual(original.assets);
  expect(reader.characters).toMatchObject({ MIYER: '米耶爾', MIEL: '米耶爾' });
  expect(reader.scenes['PRO-SC08'].segments.find((s) => s.id === 'L042')?.speakerLabel).toBe(
    '艾琳達（心聲）'
  );
  expect(reader.scenes.EP02_ACT02_SC04.segments.find((s) => s.id === 'L016')?.speakerLabel).toBe(
    '奧莉維亞、芬利（同時）'
  );
  expect(reader.endings).toEqual(original.endings);
  expect(reader.plan).toEqual(original.plan);
  for (const scene of scenes)
    for (const p of [...scene.segments, ...scene.choices])
      expect(p.text).not.toMatch(
        /\bACT\b|ACT\s*\d|\bEP\d|\bSC\d|\bCG\b|上一章|下一章|本章|上一幕|下一幕|本幕|畫面轉到|分支合流|不論.{0,20}選擇|不管選哪句/iu
      );
});
it('preserves ordinary in-world references to acting, stories, magical settings and travel routes', () => {
  for (const scene of Object.values(original.scenes))
    for (const p of scene.segments) {
      if (/演戲|版本|巡查|故事/.test(p.text))
        expect(reader.scenes[scene.id].segments.find((s) => s.id === p.id)?.text).toBe(
          readerNames(p.text)
        );
    }
  expect(prepareReaderStory(reader)).toEqual(reader);
  const edit = readerTextEdits[0];
  expect(() => readerText(edit.sceneId, edit.segmentId!, 'new source not yet reviewed')).toThrow(
    'source review'
  );
});
it('refreshes exact old history wording while preserving position, speakers, choices, scores and original input', () => {
  const source = { ...original, manifest: { ...original.manifest, start: 'EP03_ACT02_SC04' } };
  let old = initialState(source);
  old.currentSegmentIndex = source.scenes[old.currentSceneId].segments.length - 1;
  old = choose(source, old, 'C');
  old.history = readerTextEdits
    .filter((e) => e.segmentId)
    .map((e) => {
      const p = original.scenes[e.sceneId].segments.find((p) => p.id === e.segmentId)!;
      return {
        sceneId: e.sceneId,
        segmentId: p.id,
        speaker: p.speaker,
        speakerLabel: p.speakerLabel,
        text: e.from,
      };
    });
  const first = old.history[0];
  old.history.push({ ...first, text: '使用者自訂的歷史文字' });
  const before = structuredClone(old),
    restored = restoreSave(old, reader);
  expect(old).toEqual(before);
  for (const p of restored.state.history.slice(0, -1))
    expect(p.text).toBe(reader.scenes[p.sceneId].segments.find((s) => s.id === p.segmentId)?.text);
  expect(restored.state.history.at(-1)?.text).toBe('使用者自訂的歷史文字');
  expect({
    ...restored.state,
    history: before.history,
    contentVersion: before.contentVersion,
  }).toEqual(before);
  expect(restored.notices.join()).toContain('46 段回顧');
  expect(reader.scenes.EP03_ACT02_SC04.choices.find((c) => c.id === 'C')?.text).toBe(
    '拿上次的補給問題打趣'
  );
});
