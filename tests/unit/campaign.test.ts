import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContent, readJson, root } from '../../scripts/load-content';
import {
  CampaignPlanSchema,
  CampaignStateSchema,
  validatePlan,
  type CampaignPlan,
  type CampaignState,
} from '../../packages/narrative-core/campaign-schema';
import {
  createCampaign,
  openingCost,
  enterChapter,
  advanceAct,
  chooseAlliance,
  reinforce,
  payDecision,
  chooseStoryOption,
  recordEventPart,
  awardMilestone,
  assessXi,
  sealEnding,
} from '../../packages/narrative-core/campaign';
import { resolveEnding, initialState } from '../../packages/narrative-core/engine';
import { validateStory } from '../../packages/narrative-core/validate';
let plan: CampaignPlan;
beforeAll(async () => {
  plan = CampaignPlanSchema.parse(await readJson('planning/part-one.json'));
});
const base = () => createCampaign(plan, { politicalPoints: 100, unrest: 0 });
const at = (chapter: string, act: number = 5): CampaignState =>
  CampaignStateSchema.parse({ ...base(), chapter, act });

describe('fixed authored story choices', () => {
  const authored = () => {
    const p = structuredClone(plan);
    p.decisions = [
      {
        id: 'TEST_DECISION',
        actId: 'EP04_ACT02',
        source: 'TEST_ONLY: not Canon content',
        pov: 'OLIVIA',
        options: [
          {
            id: 'A',
            text: '單元測試 A',
            status: 'APPROVED',
            cost: 5,
            resourceGain: 0,
            unrestDelta: 10,
          },
          {
            id: 'B',
            text: '單元測試 B',
            status: 'APPROVED',
            cost: 10,
            resourceGain: 0,
            unrestDelta: -5,
          },
        ],
      },
    ];
    return p;
  };
  it('replays the same input and choice with identical results and no mutation', () => {
    const p = authored(),
      s = at('EP04', 2),
      original = structuredClone(s);
    expect(p.choiceResolution).toBe('AUTHORED_FIXED');
    const first = chooseStoryOption(s, p, 'TEST_DECISION', 'A'),
      second = chooseStoryOption(s, p, 'TEST_DECISION', 'A');
    expect(first).toEqual(second);
    expect(first.state.politicalPoints).toBe(95);
    expect(first.state.unrest).toBe(10);
    expect(s).toEqual(original);
  });
  it('uses only declared option values and rejects unknown IDs', () => {
    const p = authored();
    const s = { ...at('EP04', 2), unrest: 10 };
    const r = chooseStoryOption(s, p, 'TEST_DECISION', 'B');
    expect(r.state.politicalPoints).toBe(90);
    expect(r.state.unrest).toBe(5);
    expect(chooseStoryOption(s, p, 'MISSING', 'A').status).toBe('BLOCKED');
  });
  it('records the chosen branch and prevents replaying or farming another option', () => {
    const p = authored(),
      r = chooseStoryOption(at('EP04', 2), p, 'TEST_DECISION', 'A');
    expect(r.state.storyChoices.TEST_DECISION).toBe('A');
    expect(chooseStoryOption(r.state, p, 'TEST_DECISION', 'A').status).toBe('UNCHANGED');
    expect(chooseStoryOption(r.state, p, 'TEST_DECISION', 'B').status).toBe('BLOCKED');
  });
  it('keeps missing values pending and rejects approval without fixed values', () => {
    const p = authored();
    p.decisions[0].options[0].cost = null;
    p.decisions[0].options[0].status = 'PENDING';
    expect(chooseStoryOption(at('EP04', 2), p, 'TEST_DECISION', 'A').status).toBe('UNRESOLVED');
    p.decisions[0].options[0].status = 'APPROVED';
    expect(validatePlan(p).some((e) => e.includes('needs fixed values'))).toBe(true);
  });
});
describe('source-backed chapter architecture', () => {
  it('preserves exact source provenance', async () => {
    const bytes = await readFile(`${root}/content/${plan.source.file}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(plan.source.sha256);
  });
  it('contains 13 chapters, 61 acts, 24 distinct events and 30 chapter parts', () => {
    expect(validatePlan(plan)).toEqual([]);
    expect(plan.chapters).toHaveLength(13);
    expect(plan.chapters.flatMap((c) => c.acts)).toHaveLength(61);
    expect(plan.events).toHaveLength(24);
    expect(plan.events.flatMap((e) => e.parts)).toHaveLength(30);
    expect(
      plan.events.filter((e) => e.character === 'finley').every((e) => e.chapters[0] >= 'EP04')
    ).toBe(true);
  });
  it('does not turn planning prose into dialogue or effective opening choices', async () => {
    const story = await loadContent();
    expect(
      Object.values(story.scenes).every(
        (s) =>
          s.status === 'DEMO_ONLY' ||
          (s.status === 'DRAFT' && ['PROLOGUE', 'EP01'].includes(s.chapter))
      )
    ).toBe(true);
    expect(plan.chapters.every((c) => c.availability === 'NOT_YET_AVAILABLE')).toBe(true);
    expect(plan.chapters.every((c) => c.acts[0].decision === 'NONE')).toBe(true);
    expect(plan.chapters[12].acts.every((a) => a.decision === 'NONE')).toBe(true);
  });
  it('checks duplicate nodes, part locations, branch timing and upkeep overlaps', () => {
    const p = structuredClone(plan);
    p.chapters[1].acts[1].id = p.chapters[0].acts[0].id;
    p.events[0].parts[0].actId = 'MISSING';
    p.rules.resource.bands[1].min = 59;
    const errors = validatePlan(p);
    expect(errors.some((e) => e.includes('plan node'))).toBe(true);
    expect(errors.some((e) => e.includes('part location'))).toBe(true);
    expect(errors.some((e) => e.includes('overlap'))).toBe(true);
  });
  it('validates playable scene references to blueprint nodes', async () => {
    const story = await loadContent();
    story.scenes.DEMO_ACT01_SC01.planNodeId = 'EP06_ACT01';
    expect(validateStory(story).errors.some((e) => e.includes('unknown planning node'))).toBe(true);
  });
  it('retires invalidated active PS/XI gates while retaining all 30 slots', async () => {
    const story = await loadContent();
    for (const id of ['ARCANA_06', 'ARCANA_07', 'ARCANA_11', 'ARCANA_12', 'ARCANA_21']) {
      const r = story.endings.find((r) => r.id === id)!;
      expect(r.status).toBe('UNRESOLVED');
      expect(r.when).toBeUndefined();
    }
    expect(story.endings).toHaveLength(30);
    const s = {
      ...initialState(story),
      politicalRoute: 'SACRED' as const,
      tarotRoute: 'STAR' as const,
      politicalScore: 0,
      clear: { alinda: 3, finley: 3, tamara: 3, shalia: 3 },
    };
    const r = resolveEnding(s, story.endings);
    expect(r.candidate?.id).not.toBe('ARCANA_06');
    expect(r.candidate?.id).not.toBe('ARCANA_12');
    expect(r.status).toBe('UNRESOLVED');
  });
});
describe('political resources and carried unrest', () => {
  it.each([
    [0, 0],
    [59, 0],
    [60, 10],
    [79, 10],
    [80, 40],
    [100, 40],
  ])('unrest %i costs %i only once, without stacking', (unrest, cost) =>
    expect(openingCost(plan, 'EP02', unrest)).toBe(cost)
  );
  it('loads authored initial balances while keeping unapproved limits and EP12 unresolved', () => {
    const s = createCampaign(plan);
    expect(s.politicalPoints).toBe(50);
    expect(s.unrest).toBe(30);
    expect(openingCost(plan, 'PROLOGUE', null)).toBe(0);
    expect(openingCost(plan, 'EP12', 100)).toBeNull();
    expect(plan.rules.resource.initial).toBe(50);
    expect(plan.rules.resource.maximum).toBeNull();
  });
  it('starts EP01 at 50 points and unrest 30 with zero chapter-opening cost', () => {
    let s = createCampaign(plan);
    s = enterChapter(s, plan, 'PROLOGUE').state;
    s = advanceAct(s, plan).state;
    s = enterChapter(s, plan, 'EP01').state;
    expect(s.politicalPoints).toBe(50);
    expect(s.unrest).toBe(30);
    expect(s.upkeep[0].cost).toBe(0);
  });
  it('applies chapter upkeep once and carries new unrest to the next chapter', () => {
    let s = base();
    s = enterChapter(s, plan, 'PROLOGUE').state;
    s = advanceAct(s, plan).state;
    s = enterChapter(s, plan, 'EP01').state;
    expect(s.politicalPoints).toBe(100);
    s = advanceAct(s, plan).state;
    s = payDecision(s, plan, { id: 'cost', cost: 5, unrestDelta: 80, resourceGain: 0 }).state;
    expect(s.politicalPoints).toBe(95);
    expect(s.unrest).toBe(80);
    expect(enterChapter(s, plan, 'EP01').state.politicalPoints).toBe(95);
    for (let i = 0; i < 4; i++) s = advanceAct(s, plan).state;
    s = enterChapter(s, plan, 'EP02').state;
    expect(s.politicalPoints).toBe(55);
    expect(s.upkeep.map((r) => r.cost)).toEqual([0, 40]);
    expect(enterChapter(s, plan, 'EP02').status).toBe('UNCHANGED');
  });
  it('halts insufficient upkeep atomically instead of negative balance or failure ending', () => {
    const s = {
      ...base(),
      politicalPoints: 3,
      unrest: 80,
      chapter: 'EP01',
      completedChapters: ['PROLOGUE', 'EP01'],
    };
    const r = enterChapter(s, plan, 'EP02');
    expect(r.status).toBe('UNRESOLVED');
    expect(r.state).toBe(s);
    expect(s.politicalPoints).toBe(3);
  });
  it('does not infer a loss at zero points', () => {
    const s = { ...at('EP02', 2), politicalPoints: 5 };
    const r = payDecision(s, plan, { id: 'zero', cost: 5, unrestDelta: 0, resourceGain: 0 });
    expect(r.status).toBe('APPLIED');
    expect(r.state.politicalPoints).toBe(0);
    expect(r.state.tarotRoute).toBe('NONE');
  });
  it('rejects unknown costs, free resource farming, invalid ranges and duplicate effects', () => {
    const s = at('EP04', 2),
      decision = { id: 'test', cost: 10, unrestDelta: 5, resourceGain: 0 };
    expect(payDecision(s, plan, { ...decision, cost: null }).status).toBe('UNRESOLVED');
    expect(payDecision(s, plan, { ...decision, resourceGain: 20, unrestDelta: 0 }).status).toBe(
      'BLOCKED'
    );
    expect(payDecision(s, plan, { ...decision, resourceGain: 20 }).status).toBe('UNRESOLVED');
    expect(payDecision(s, plan, { ...decision, unrestDelta: 101 }).status).toBe('UNRESOLVED');
    const first = payDecision(s, plan, decision);
    expect(first.state.politicalPoints).toBe(90);
    expect(payDecision(first.state, plan, decision).status).toBe('UNCHANGED');
    expect(s.politicalPoints).toBe(100);
  });
  it('does not permit actions at Prologue, ACT I or frozen EP12', () => {
    const d = { id: 'x', cost: 0, unrestDelta: 0, resourceGain: 0 };
    for (const s of [at('PROLOGUE', 1), at('EP04', 1), at('EP12', 3)])
      expect(payDecision(s, plan, d).status).toBe('BLOCKED');
  });
});
describe('historical routes, events and ending seals', () => {
  it.each([
    ['SACRED', true, 'STAR'],
    ['WORLD', true, 'CHARIOT'],
    ['SACRED', false, 'TOWER'],
    ['WORLD', false, 'TOWER'],
  ] as const)('locks %s with reinforcement %s into %s', (alliance, yes, route) => {
    let s = chooseAlliance(at('EP06', 3), plan, alliance).state;
    expect(chooseAlliance(s, plan, alliance).status).toBe('BLOCKED');
    s = { ...s, chapter: 'EP09', act: 4 };
    s = reinforce(s, plan, yes).state;
    expect(s.tarotRoute).toBe(route);
    expect(reinforce(s, plan, !yes).status).toBe('BLOCKED');
  });
  it('rejects premature alliance and reinforcement, while preserving three-route history', () => {
    expect(chooseAlliance(at('EP05', 3), plan, 'WORLD').status).toBe('BLOCKED');
    expect(reinforce(at('EP09', 4), plan, true).status).toBe('BLOCKED');
    expect(chooseAlliance(at('EP06', 2), plan, 'SACRED').status).toBe('BLOCKED');
  });
  it('does not assume A≥4 alone authorizes Niels or count events as CLEAR', () => {
    const s = { ...at('EP09'), clear: { alinda: 7, finley: 10, tamara: 6, shalia: 6 } };
    expect(recordEventPart(s, plan, 'A4', 'SUCCEEDED').status).toBe('UNRESOLVED');
    const first = recordEventPart(at('EP06'), plan, 'A1', 'SUCCEEDED');
    expect(first.state.clear.alinda).toBe(0);
    expect(awardMilestone(first.state, plan, 'A1_PART1').status).toBe('UNRESOLVED');
  });
  it('requires the upper Niels part and preserves irreversible failure across chapters', () => {
    let s: CampaignState = { ...at('EP10'), facts: { NIELS_ENTRY_AUTHORIZED: true } };
    expect(recordEventPart(s, plan, 'A4', 'SUCCEEDED').status).toBe('BLOCKED');
    s = { ...s, chapter: 'EP09' };
    s = recordEventPart(s, plan, 'A4', 'FAILED').state;
    s = {
      ...s,
      chapter: 'EP10',
      clear: { alinda: 7, finley: 10, tamara: 6, shalia: 6 },
      politicalPoints: 99999,
      tarotRoute: 'STAR',
      politicalRoute: 'SACRED',
    };
    expect(recordEventPart(s, plan, 'A4', 'SUCCEEDED').status).toBe('BLOCKED');
    expect(assessXi(s, plan).status).toBe('BLOCKED');
  });
  it('records both Niels parts without requiring bloodline or father-case closure', () => {
    let s: CampaignState = { ...at('EP09'), facts: { NIELS_ENTRY_AUTHORIZED: true } };
    s = recordEventPart(s, plan, 'A4', 'SUCCEEDED').state;
    s = { ...s, chapter: 'EP10' };
    s = recordEventPart(s, plan, 'A4', 'SUCCEEDED').state;
    s = {
      ...s,
      tarotRoute: 'STAR',
      politicalRoute: 'SACRED',
      facts: {
        ...s.facts,
        ...Object.fromEntries(plan.rules.xi.requiredFlags.map((f) => [f.id, true])),
      },
    };
    const xi = assessXi(s, plan);
    expect(xi.checks.filter((c) => c.id !== 'COMMON_GATE').every((c) => c.status === 'PASS')).toBe(
      true
    );
    expect(xi.status).toBe('UNRESOLVED');
    expect(xi.awarded).toBe(false);
    expect(plan.rules.xi.fatherCaseRequired).toBe(false);
    expect(plan.rules.xi.bloodlineProofRequired).toBe(false);
  });
  it('Tower cannot obtain XI even when every other known requirement passes', () => {
    const s = {
      ...at('EP11'),
      tarotRoute: 'TOWER' as const,
      politicalRoute: 'SACRED' as const,
      eventParts: { A4_PART1: 'SUCCEEDED' as const, A4_PART2: 'SUCCEEDED' as const },
      facts: Object.fromEntries(plan.rules.xi.requiredFlags.map((f) => [f.id, true])),
    };
    expect(assessXi(s, plan).status).toBe('BLOCKED');
  });
  it('awards a specifically configured milestone once without rewriting established history', () => {
    const p = structuredClone(plan);
    p.events.find((e) => e.id === 'A1')!.parts[0].clearAward = 2;
    let s = recordEventPart(at('EP06'), p, 'A1', 'SUCCEEDED').state;
    s = awardMilestone(s, p, 'A1_PART1').state;
    expect(s.clear.alinda).toBe(2);
    expect(awardMilestone(s, p, 'A1_PART1').status).toBe('UNCHANGED');
    s = { ...s, cooperation: { alinda: 'LOST' } };
    expect(s.clear.alinda).toBe(2);
  });
  it('seals EP11 and prevents later point, event, route or milestone changes', () => {
    const s = sealEnding({ ...at('EP11'), tarotRoute: 'STAR', politicalRoute: 'SACRED' }).state;
    expect(s.sealed).toBe(true);
    expect(advanceAct(s, plan).status).toBe('BLOCKED');
    expect(recordEventPart(s, plan, 'A6', 'SUCCEEDED').status).toBe('BLOCKED');
    expect(awardMilestone(s, plan, 'A1_PART1').status).toBe('BLOCKED');
    expect(
      payDecision(s, plan, { id: 'late', cost: 0, unrestDelta: 0, resourceGain: 0 }).status
    ).toBe('BLOCKED');
    expect(enterChapter(s, plan, 'EP12').status).toBe('UNRESOLVED');
  });
});
