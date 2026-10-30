import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import { annotateSpeakers, auditSpeakers } from '../../scripts/speaker-annotations';
import review from '../../content/sources/ep01/speaker-annotations-v1.json' with { type: 'json' };
import { initialState } from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { parseEp01Act05 } from '../../scripts/ep01-act05-parser';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
});
it('audits all authored scenes and supplies the 137 reviewed missing headers', () => {
  expect(auditSpeakers(story).errors).toEqual([]);
  expect(review.annotations).toHaveLength(137);
  expect(review.annotations.filter((r) => r.sceneId.startsWith('EP01_ACT02'))).toHaveLength(2);
  expect(review.annotations.filter((r) => r.sceneId.startsWith('EP01_ACT05'))).toHaveLength(135);
  for (const row of review.annotations) {
    const segment = story.scenes[row.sceneId].segments.find((s) => s.id === row.segmentId)!;
    expect(segment).toMatchObject({
      text: row.text,
      kind: 'dialogue',
      speaker: row.speaker,
      speakerLabel: row.speakerLabel,
    });
  }
});
it('preserves every paragraph, identifier, CG cue, branch, presentation and gameplay field', async () => {
  const baseline = (await readJson('../docs/speaker-audit-baseline.json')) as {
    unmodifiedSceneShapes: { sceneId: string; sha256: string }[];
  };
  const canonical = (value: unknown): string =>
    value === null || typeof value !== 'object'
      ? JSON.stringify(value)
      : Array.isArray(value)
        ? '[' + value.map(canonical).join(',') + ']'
        : '{' +
          Object.keys(value)
            .sort()
            .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
            .join(',') +
          '}';
  for (const entry of baseline.unmodifiedSceneShapes) {
    const clone = JSON.parse(JSON.stringify(story.scenes[entry.sceneId])) as {
      segments: Record<string, unknown>[];
    };
    for (const p of clone.segments) {
      delete p.kind;
      delete p.speaker;
      delete p.speakerLabel;
    }
    expect(createHash('sha256').update(canonical(clone)).digest('hex'), entry.sceneId).toBe(
      entry.sha256
    );
  }
});
it('uses context rather than alternating speakers or treating every quote as spoken dialogue', () => {
  for (const [id, indices, speaker] of [
    ['EP01_ACT05_SC02', [19, 21, 23, 25, 26, 28], 'OLIVIA'],
    ['EP01_ACT05_SC04', [20, 22, 24, 26], 'ELVIR'],
    ['EP01_ACT05_SC05_COMMON', [18, 20], 'OLIVIA'],
  ] as const) {
    for (const n of indices) expect(story.scenes[id].segments[n - 1].speaker).toBe(speaker);
  }
  const preserved = [
    ['EP01_ACT01_SC04', 'L027'],
    ['PRO-SC05', 'L018'],
    ['EP01_ACT03_SC02', 'L011'],
    ['EP01_ACT05_SC01_COMMON', 'L009'],
    ['EP01_ACT05_SC02', 'L013'],
    ['EP01_ACT05_SC05', 'L030'],
  ];
  for (const [id, line] of preserved) {
    const p = story.scenes[id].segments.find((s) => s.id === line)!;
    expect(p.kind).toBe('narration');
    expect(p.speaker).toBeUndefined();
  }
  expect(story.scenes.EP01_ACT04_SC01.segments.find((p) => p.kind === 'thought')?.speaker).toBe(
    'OLIVIA'
  );
});
it('stops source re-import when a reviewed paragraph moves or changes', async () => {
  const scenes = structuredClone(Object.values(story.scenes));
  scenes.find((s) => s.id === 'EP01_ACT05_SC01')!.segments[3].text = '「改稿後的新句子。」';
  expect(() => annotateSpeakers(scenes)).toThrow('needs source review');
  const source = await readFile(root + '/content/sources/ep01/source-act05-v0.4.md', 'utf8');
  expect(() =>
    parseEp01Act05(source.replace('「北翼還沒消息？」她問。', '「新的提問。」她問。'))
  ).toThrow('needs source review');
});
it('fails validation for newly unlabelled speech instead of hiding it as narration', () => {
  const changed = structuredClone(story);
  const p = changed.scenes.EP01_ACT05_SC01.segments[3];
  p.kind = 'narration';
  delete p.speaker;
  delete p.speakerLabel;
  expect(auditSpeakers(changed).errors.some((e) => e.includes('EP01_ACT05_SC01/L004'))).toBe(true);
});
it('repairs old history headers on load while leaving old text, position, choices and resources intact', () => {
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT05_SC01' },
  });
  state.currentSegmentIndex = 3;
  state.contentVersion = '0.7.0-ep01-act05-v0.4';
  state.history = [
    {
      sceneId: 'EP01_ACT05_SC01',
      segmentId: 'L004',
      text: story.scenes.EP01_ACT05_SC01.segments[3].text,
    },
    {
      sceneId: 'EP01_ACT05_SC01',
      segmentId: 'L001',
      text: '舊稿中已修改的歷史文字',
      speaker: 'FINLEY',
      speakerLabel: '舊標記',
    },
  ];
  const original = structuredClone(state);
  const result = restoreSave(state, story);
  expect(result.state.history[0]).toMatchObject({
    speaker: 'OLIVIA',
    speakerLabel: '奧莉維亞',
    text: original.history[0].text,
  });
  expect(result.state.history[1]).toEqual(original.history[1]);
  expect(result.state.currentSegmentIndex).toBe(original.currentSegmentIndex);
  expect(result.state.decisionLog).toEqual(original.decisionLog);
  expect(result.state.campaign).toEqual(original.campaign);
  expect(result.state.flags).toEqual(original.flags);
  expect(result.notices.join()).toContain('1 段回顧');
  expect(state).toEqual(original);
});
