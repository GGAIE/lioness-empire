import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';
import { releaseVersion } from '../../apps/web-vn/src/release-log';

let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});

function play(route: 'SACRED' | 'WORLD', picks: string[], outcome = 'FAILURE', seal = false) {
  const ending = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP07' &&
      s.act === 'ACT03' &&
      s.completion &&
      s.availableWhen &&
      'value' in s.availableWhen &&
      s.availableWhen.value === route
  )!;
  let state = initialState({ ...story, manifest: { ...story.manifest, start: ending.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.flags.EP07_SACRED_NEGOTIATION_RESULT = outcome;
  state.flags.FINLEY_SECRETARY_SEAL = seal;
  state.flags.EP07_W3_SETTLED = true;
  state.contentVersion = '0.17.0-ep07-act03-worldlines.reader-v1';
  delete state.flags.EP07_W4_KALLIS_CONTACT;
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  state = continueChapter(story, restoreSave(state, story).state);
  const images = new Set<string>();
  const dialogue: string[] = [];
  let pick = 0;
  for (let i = 0; i < 90; i++) {
    const scene = story.scenes[state.currentSceneId];
    expect(scene.availableWhen).toEqual({ path: 'politicalRoute', op: 'eq', value: route });
    const segments = visibleSegments(story, state);
    for (let index = 0; index < segments.length; index++) {
      const cg = currentCg(story, { ...state, currentSegmentIndex: index });
      if (cg) images.add(cg);
      dialogue.push(segments[index].text);
    }
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    if (scene.kind === 'end') {
      expect(pick).toBe(picks.length);
      expect(scene.completion?.nextLabel).toContain('第五幕');
      expect([...images].every((id) => id.startsWith(`EP07-ACT04-${route}-`))).toBe(true);
      expect(state.campaign?.politicalPoints).toBe(50);
      expect(state.campaign?.unrest).toBe(30);
      expect(state.flags.ALINDA_A2_CLEAR).toBe(false);
      return { state, images: [...images], dialogue: dialogue.join('\n') };
    }
    state = scene.kind === 'choice' ? choose(story, state, picks[pick++]) : advance(story, state);
  }
  throw Error('Fourth act never reached its ending');
}

it('carries the Sacred result and seal into the right CG and plays both priorities in order', () => {
  const inherited = play('SACRED', ['B'], 'SEAL', true);
  const granted = play('SACRED', ['A', 'A'], 'PARTIAL');
  const ella = play('SACRED', ['B', 'B'], 'FULL');
  for (const [run, exclusive] of [
    [inherited, '12'],
    [granted, '13'],
    [ella, '14'],
  ] as const) {
    expect(run.images.filter((id) => /-1[234]$/.test(id))).toEqual([
      `EP07-ACT04-SACRED-${exclusive}`,
    ]);
    expect(run.state.flags.EP07_S4_EVACUATION_RECORDS_READY).toBe(true);
    expect(run.state.flags.EP07_W4_KALLIS_CONTACT).toBe('UNSET');
  }
  expect(inherited.dialogue).toContain('查閱和轉交都留了痕');
  expect(granted.dialogue).toContain('有兩個時辰還對不上');
  expect(ella.dialogue).toContain('各站今天開始照這份表換班');
  expect(granted.state.flags.FINLEY_SECRETARY_SEAL).toBe(true);
  expect(granted.state.flags.EP07_SACRED_PALACE_DOCUMENT_TRACE_ACTIVE).toBe(false);
  expect(granted.images.filter((id) => /-3[56]$/.test(id)).map((id) => id.slice(-2))).toEqual([
    '35',
    '36',
  ]);
  expect(ella.images.filter((id) => /-3[56]$/.test(id)).map((id) => id.slice(-2))).toEqual([
    '36',
    '35',
  ]);
  expect(play('SACRED', ['B', 'A']).dialogue).toContain('道路一欄留白');
});

it('records all World decisions, preserves the common ending, and never applies unapproved costs', () => {
  const expected = [
    ['ROYAL', 'JOINT', 'JOINT_OVERSIGHT'],
    ['ACADEMY', 'LANCERS_LEAD', 'LANCERS_CUSTODY'],
    ['ACADEMY_LEAD', 'ACADEMY_LEAD', 'ACADEMY_CUSTODY'],
  ];
  for (const [i, key] of ['A', 'B', 'C'].entries()) {
    const { images, state } = play('WORLD', Array(12).fill(key));
    expect(images).toHaveLength(40);
    expect(state.flags.EP07_W4_OTARIA_UNDEAD_ACTIVITY_STOPPED).toBe(true);
    expect(state.flags.EP07_W4_DRAGON_REVIVAL_INVESTIGATION_OPEN).toBe(true);
    expect([
      state.flags.EP07_W4_KALLIS_CONTACT,
      state.flags.EP07_W4_COOPERATION_MODEL,
      state.flags.EP07_W4_AFTERMATH_MODEL,
    ]).toEqual(expected[i]);
  }
});

it('keeps release versions stable and rotates names on Taipei calendar Mondays', () => {
  expect(releaseVersion('2026-11-10')).toBe('OLIVIA2026.11.10');
  expect(releaseVersion('2026-11-15')).toBe('OLIVIA2026.11.15');
  expect(releaseVersion('2026-11-16')).toBe('FINLEY2026.11.16');
  expect(releaseVersion('2027-01-04')).toBe('FINLEY2027.01.04');
});
