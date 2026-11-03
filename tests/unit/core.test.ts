import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent, readJson } from '../../scripts/load-content';
import { z } from 'zod';
import { EndingRuleSchema } from '../../packages/narrative-core/schema';
import {
  initialState,
  applyEffects,
  choose,
  advance,
  evaluate,
  resolveEnding,
  markRead,
  visibleChoices,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import {
  SceneSchema,
  StateSchema,
  ConditionSchema,
  type GameState,
  type Story,
} from '../../packages/narrative-core/schema';
import { validateStory } from '../../packages/narrative-core/validate';
let story: Story;
beforeAll(async () => {
  story = await loadContent();
  story.manifest.start = story.manifest.chapters.find((c) => c.id === 'DEMO')!.entry!;
  // The v2 resolver remains regression-tested as an explicitly archived model.
  // The new resource model must not reactivate its PS=0/45 or obsolete XI gates.
  story.endings = z.array(EndingRuleSchema).parse(await readJson('endings/legacy-v2-rules.json'));
});
const start = () => initialState(story);
const base = (route: 'STAR' | 'CHARIOT' | 'TOWER' = 'STAR'): GameState => ({
  ...start(),
  politicalRoute: route === 'CHARIOT' ? 'WORLD' : 'SACRED',
  tarotRoute: route,
  clear: { alinda: 3, finley: 3, tamara: 3, shalia: 3 },
});
const gate = (s: GameState, flags: Record<string, boolean | number | string>) => ({
  ...s,
  flags: { ...s.flags, ...flags },
});
describe('data contract and story graph', () => {
  it('validates independently loaded chapters and 30 external slots', () => {
    expect(validateStory(story).errors).toEqual([]);
    expect(story.endings).toHaveLength(30);
    expect(story.endings.filter((r) => r.orientation === 'REVERSED')).toHaveLength(8);
  });
  it('does not compile unavailable Canon chapters', () => {
    expect(story.manifest.chapters.filter((c) => c.status === 'NOT_YET_AVAILABLE')).toHaveLength(8);
    expect(
      Object.values(story.scenes).every(
        (s) =>
          (s.status === 'DEMO_ONLY' && s.chapter === 'DEMO') ||
          (s.status === 'DRAFT' && ['PROLOGUE', 'EP01', 'EP02', 'EP03', 'EP04'].includes(s.chapter))
      )
    ).toBe(true);
  });
  it('rejects non-Olivia choices, EP12 choices and result choices', () => {
    const s = story.scenes.DEMO_ACT01_SC02;
    for (const change of [{ pov: 'FINLEY' }, { chapter: 'EP12' }, { kind: 'result' }])
      expect(SceneSchema.safeParse({ ...s, ...change }).success).toBe(false);
  });
  it('rejects unknown properties, missing condition values and prototype access', () => {
    expect(StateSchema.safeParse({ ...start(), typo: 1 }).success).toBe(false);
    expect(ConditionSchema.safeParse({ path: 'politicalScore', op: 'eq' }).success).toBe(false);
    expect(ConditionSchema.safeParse({ path: 'flags.__proto__', op: 'exists' }).success).toBe(
      false
    );
  });
  it('reports dangling targets, undeclared flags, incompatible assets and conditional dead ends', () => {
    const s = structuredClone(story);
    s.scenes.DEMO_ACT01_SC02.choices[0].next = 'MISSING';
    s.scenes.DEMO_ACT01_SC01.cg = 'demo-calm';
    s.scenes.DEMO_ACT01_SC02.choices.forEach(
      (c) => (c.when = { path: 'flags.NOT_DEFINED', op: 'eq', value: true })
    );
    const r = validateStory(s);
    expect(r.errors.some((e) => e.includes('missing choice target'))).toBe(true);
    expect(r.errors.some((e) => e.includes('undeclared flag'))).toBe(true);
    expect(r.errors.some((e) => e.includes('wrong-type'))).toBe(true);
    expect(r.errors.some((e) => e.includes('fallback'))).toBe(true);
  });
  it('reports closed graph loops', () => {
    const s = structuredClone(story);
    s.scenes.DEMO_BRANCH_ARCHIVE.next = 'DEMO_BRANCH_ARCHIVE';
    expect(validateStory(s).errors.some((e) => e.includes('no path to end'))).toBe(true);
  });
});
describe('state transitions', () => {
  it.each([
    ['SACRED', true, 'STAR'],
    ['WORLD', true, 'CHARIOT'],
    ['SACRED', false, 'TOWER'],
    ['WORLD', false, 'TOWER'],
  ] as const)('preserves historical route %s / %s', (political, reinforce, tarot) => {
    const s = applyEffects(start(), [
      { type: 'political', value: political },
      { type: 'reinforce', value: reinforce },
    ]);
    expect(s.tarotRoute).toBe(tarot);
    expect(() => applyEffects(s, [{ type: 'political', value: political }])).toThrow();
    expect(() => applyEffects(s, [{ type: 'reinforce', value: true }])).toThrow();
  });
  it('validates all effects transactionally without mutating input', () => {
    const s = start();
    expect(() =>
      applyEffects(s, [
        { type: 'flag', key: 'DEMO_DONE', value: true },
        { type: 'clear', key: 'finley', delta: 20 },
      ])
    ).toThrow();
    expect(s.flags.DEMO_DONE).toBe(false);
    expect(s.clear.finley).toBe(1);
  });
  it.each([
    ['alinda', 7],
    ['finley', 10],
    ['tamara', 6],
    ['shalia', 6],
  ] as const)('enforces %s bounds', (key, max) => {
    const s = start();
    s.clear[key] = max;
    expect(() => applyEffects(s, [{ type: 'clear', key, delta: 1 }])).toThrow();
    s.clear[key] = 0;
    expect(() => applyEffects(s, [{ type: 'clear', key, delta: -1 }])).toThrow();
  });
  it('rejects undefined flags and wrong scalar type', () => {
    expect(() => applyEffects(start(), [{ type: 'flag', key: 'MISSING', value: true }])).toThrow();
    expect(() =>
      applyEffects(start(), [{ type: 'flag', key: 'DEMO_DONE', value: 'true' }])
    ).toThrow();
  });
  it('evaluates nested conditions and missing paths safely', () => {
    const s = start();
    expect(
      evaluate(s, {
        all: [
          { path: 'clear.finley', op: 'gte', value: 1 },
          { not: { path: 'flags.DEMO_DONE', op: 'eq', value: true } },
        ],
      })
    ).toBe(true);
    expect(evaluate(s, { path: 'flags.MISSING', op: 'ne', value: true })).toBe(false);
  });
  it('advances, records stable segment IDs and executes a choice exactly once', () => {
    let s = start();
    s = advance(story, s);
    expect(s.currentSegmentIndex).toBe(1);
    expect(s.history).toHaveLength(1);
    s = advance(story, advance(story, s));
    expect(s.currentSceneId).toBe('DEMO_ACT01_SC02');
    s = choose(story, s, 'inspect');
    expect(s.clear.finley).toBe(2);
    expect(s.flags.DEMO_INSPECTED).toBe(true);
    expect(s.decisionLog).toEqual(['DEMO_ACT01_SC02:inspect']);
    expect(() => choose(story, { ...s, currentSceneId: 'DEMO_ACT01_SC02' }, 'dispatch')).toThrow(
      'already committed'
    );
  });
  it.each(['inspect', 'dispatch', 'observe'])(
    'branch %s converges through a no-choice result',
    (choice) => {
      let s = { ...start(), currentSceneId: 'DEMO_ACT01_SC02' };
      s = choose(story, s, choice);
      s = advance(story, s);
      expect(story.scenes[s.currentSceneId].kind).toBe('result');
      expect(visibleChoices(story, s)).toHaveLength(0);
      s = advance(story, advance(story, s));
      expect(s.currentSceneId).toBe('DEMO_FINAL_CHOICE');
      expect(visibleChoices(story, s)).toHaveLength(choice === 'inspect' ? 2 : 1);
      s = choose(story, s, 'finish');
      expect(s.flags.DEMO_DONE).toBe(true);
    }
  );
  it('does not duplicate history while marking read', () => {
    const s = markRead(story, start());
    expect(markRead(story, s)).toEqual(s);
    expect(visibleSegments(story, s)).toHaveLength(3);
  });
});
describe('archived v2: 22 upright draft candidates with priority and trace', () => {
  const cases: [number, () => GameState][] = [
    [
      0,
      () =>
        gate(base('TOWER'), {
          DRAGON_EMPRESS_TRUCE: true,
          KNIGHT_COUNCIL_READY: true,
          OLIVIA_SURRENDER_OFFER: true,
          FINAL_PEACE_TREATY_SIGNED: true,
        }),
    ],
    [
      1,
      () => {
        const s = base();
        s.clear.alinda = 0;
        s.clear.finley = 0;
        return s;
      },
    ],
    [2, () => gate(base(), { HISTORY_POLICY: 'SEAL', ARCHIVE_TRUTH_COMPLETE: true })],
    [
      3,
      () => {
        const s = base();
        s.clear.shalia = 5;
        return s;
      },
    ],
    [4, () => gate(base('CHARIOT'), { SUCCESSION_CONTEST: 'WON' })],
    [
      5,
      () => {
        const s = base();
        s.clear.tamara = 5;
        return s;
      },
    ],
    [6, () => gate(base(), { EARLY_PS_ZERO: true })],
    [7, () => ({ ...base('CHARIOT'), politicalScore: 44 })],
    [
      8,
      () => {
        const s = gate(base('TOWER'), { ALINDA_SAFE_HAVEN: true });
        s.clear.alinda = 4;
        return s;
      },
    ],
    [
      9,
      () => {
        const s = base();
        s.clear.finley = 0;
        return s;
      },
    ],
    [
      10,
      () => {
        const s = base();
        s.clear.shalia = 0;
        return s;
      },
    ],
    [
      11,
      () => {
        const s = gate(base(), {
          HISTORY_POLICY: 'PUBLISH',
          ARCHIVE_TRUTH_COMPLETE: true,
          ALINDA_TRUCE: true,
          CORONATION: 'FORMAL',
          FINAL_AGREEMENT: true,
        });
        s.clear.alinda = 4;
        return s;
      },
    ],
    [12, () => ({ ...base(), politicalScore: 44 })],
    [
      13,
      () => {
        const s = base('TOWER');
        s.clear.tamara = 0;
        return s;
      },
    ],
    [14, () => gate(base('TOWER'), { LATER_ASYLUM: true })],
    [15, () => gate(base('CHARIOT'), { SUCCESSION_CONTEST: 'COMPROMISE' })],
    [16, () => gate(base('TOWER'), { TOWER_SURVIVAL: 'FAILED' })],
    [
      17,
      () => {
        const s = base('CHARIOT');
        s.clear.alinda = 0;
        return s;
      },
    ],
    [18, () => base()],
    [
      19,
      () => {
        const s = base();
        s.clear.tamara = 0;
        return s;
      },
    ],
    [
      20,
      () => {
        const s = base();
        s.clear.alinda = 0;
        return s;
      },
    ],
    [21, () => ({ ...base(), clear: { alinda: 2, finley: 2, tamara: 2, shalia: 2 } })],
  ];
  it.each(cases)('reaches draft Arcana %i without awarding Canon', (n, make) => {
    const s = make(),
      original = structuredClone(s),
      r = resolveEnding(s, story.endings);
    expect(r.candidate?.id).toBe(`ARCANA_${String(n).padStart(2, '0')}`);
    expect(r.status).toBe('UNRESOLVED');
    expect(r.evaluated).toHaveLength(30);
    expect(r.reason.length).toBeGreaterThan(0);
    expect(s).toEqual(original);
  });
  it.each([
    ['STAR', 'alinda'],
    ['STAR', 'tamara'],
    ['STAR', 'shalia'],
    ['CHARIOT', 'alinda'],
    ['CHARIOT', 'tamara'],
    ['CHARIOT', 'shalia'],
    ['TOWER', 'alinda'],
    ['TOWER', 'shalia'],
  ] as const)('reaches %s / %s reversed at F=6', (route, key) => {
    const s = base(route);
    s.clear.finley = 6;
    s.clear[key] = 0;
    const r = resolveEnding(s, story.endings);
    expect(r.candidate?.id).toBe(`REVERSED_${route}_${key.toUpperCase()}`);
    expect(r.candidate?.grade).toBe('NORMAL');
    s.clear.finley = 5;
    expect(resolveEnding(s, story.endings).candidate?.orientation).toBe('UPRIGHT');
  });
  it('Tower T=0 overrides double zero, reverse and treaty', () => {
    const s = gate(base('TOWER'), {
      DRAGON_EMPRESS_TRUCE: true,
      KNIGHT_COUNCIL_READY: true,
      OLIVIA_SURRENDER_OFFER: true,
      FINAL_PEACE_TREATY_SIGNED: true,
    });
    s.clear.alinda = 0;
    s.clear.tamara = 0;
    s.clear.finley = 10;
    const r = resolveEnding(s, story.endings);
    expect(r.candidate?.id).toBe('ARCANA_13');
    expect(r.overridden).toContain('ARCANA_01');
  });
  it('Tower peace survives low PS and one absent pillar', () => {
    const s = gate(base('TOWER'), {
      DRAGON_EMPRESS_TRUCE: true,
      KNIGHT_COUNCIL_READY: true,
      OLIVIA_SURRENDER_OFFER: true,
      FINAL_PEACE_TREATY_SIGNED: true,
    });
    s.politicalScore = 0;
    s.clear.alinda = 0;
    s.clear.finley = 6;
    expect(resolveEnding(s, story.endings).candidate?.id).toBe('ARCANA_00');
  });
  it('early PS zero takes precedence even before Tower hard failure', () => {
    const s = gate(base('TOWER'), { EARLY_PS_ZERO: true });
    s.clear.tamara = 0;
    expect(resolveEnding(s, story.endings).candidate?.id).toBe('ARCANA_06');
  });
  it('Chariot LOST with high F/T never becomes Emperor; unresolved facts remain unresolved', () => {
    const s = gate(base('CHARIOT'), { SUCCESSION_CONTEST: 'LOST' });
    s.clear.finley = 7;
    s.clear.tamara = 5;
    expect(resolveEnding(s, story.endings).candidate).toBeNull();
    expect(resolveEnding(s, story.endings).status).toBe('UNRESOLVED');
  });
  it('does not treat Tower PS=0 as death or infer survival facts', () => {
    const s = base('TOWER');
    s.politicalScore = 0;
    expect(resolveEnding(s, story.endings).candidate).toBeNull();
  });
  it('PS45 boundary passes hanged gate while PS44 does not', () => {
    expect(resolveEnding({ ...base(), politicalScore: 45 }, story.endings).candidate?.id).toBe(
      'ARCANA_18'
    );
    expect(resolveEnding({ ...base(), politicalScore: 44 }, story.endings).candidate?.id).toBe(
      'ARCANA_12'
    );
  });
});
