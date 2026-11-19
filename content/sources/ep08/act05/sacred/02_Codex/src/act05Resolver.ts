/**
 * Lioness Empire EP08 / Sacred / ACT05 — narrative resolver reference.
 * Standalone TypeScript logic for Codex integration into HTML5 or Unity bridge.
 * It does NOT implement game UI, asset loading, or host political-resource bankruptcy policy.
 * Exact scripts: ../scene_data/SC01..SC05.json
 * Canonical table: ../ACT05_Choice_Graph.json
 */
export type Opening = 'A' | 'B' | 'C' | 'D';
export type Middle = 'LIMIT' | 'BOUND' | 'EXPAND';
export type Closing = 'CASE' | 'OPEN' | 'STANDING';
export type F5Choice = 'F5_A' | 'F5_B' | 'F5_C';

export interface Act05Choices {
  opening: Opening;
  middle: Middle;
  closing: Closing;
}

export interface Act05Result {
  tier: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  politicalDelta: number;
  unrestDelta: number;
  resultCG: string;
  resultKey: string;
}

export interface HostState {
  politicalPoints: number;
  unrest: number;               // range 0..100
  finleyClear: number;          // existing total, do not reset
  flags: Record<string, boolean | string | number>;
}

const ENTRY_BASE: Record<Opening, number> = { A: 0, B: 1, C: 2, D: 4 };
const MID_DELTA: Record<Middle, number> = { LIMIT: -1, BOUND: 0, EXPAND: 1 };
const CLOSE_DELTA: Record<Closing, number> = { CASE: -1, OPEN: 0, STANDING: 1 };
const POINTS = [30, 20, 10, 0, -10, -25, -40] as const;
const UNREST = [15, 10, 5, -5, -10, -20, -30] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveAct05(choices: Act05Choices): Act05Result {
  // Other scene choices marked FL01–FL10 are cosmetic, and F5 is independent.
  const raw = ENTRY_BASE[choices.opening] + MID_DELTA[choices.middle] + CLOSE_DELTA[choices.closing];
  const tier = clamp(raw, 0, 6) as Act05Result['tier'];
  return {
    tier,
    politicalDelta: POINTS[tier],
    unrestDelta: UNREST[tier],
    resultCG: `CG${String(25 + tier).padStart(2, '0')}`,
    resultKey: `EP08_SACRED_ACT05_T${tier}`,
  };
}

/** Resolve F5 at the end of SC01. Never deduct previously earned CLEAR. */
export function applyF5Once(host: HostState, choice: F5Choice): HostState {
  if (host.flags.EP08_SACRED_ACT05_F5_RESOLVED === true) return host;
  const success = choice !== 'F5_C';
  return {
    ...host,
    finleyClear: host.finleyClear + (success ? 1 : 0),
    flags: {
      ...host.flags,
      EP08_SACRED_ACT05_F5_RESOLVED: true,
      EP08_SACRED_ACT05_F5_CLEAR_GRANTED: success,
      EP08_SACRED_ACT05_F5_CHOICE: choice,
    },
  };
}

/**
 * Resolve the political negotiation exactly once at end SC05.
 * Important: no automatic point floor or instant game-over; defer low-resource behavior
 * to the host's latest approved political-points system.
 * EP09 opening unrest penalty is separate and MUST NOT be applied here.
 */
export function applyNegotiationOnce(host: HostState, choices: Act05Choices): {state: HostState; result: Act05Result; applied: boolean} {
  const result = resolveAct05(choices);
  if (host.flags.EP08_SACRED_ACT05_POLITICS_RESOLVED === true) {
    return { state: host, result, applied: false };
  }
  const state: HostState = {
    ...host,
    politicalPoints: host.politicalPoints + result.politicalDelta,
    unrest: clamp(host.unrest + result.unrestDelta, 0, 100),
    flags: {
      ...host.flags,
      EP08_SACRED_ACT05_POLITICS_RESOLVED: true,
      EP08_SACRED_ACT05_POLITICAL_TIER: result.tier,
      EP08_SACRED_ACT05_POLITICAL_RESULT: result.resultKey,
      EP08_SACRED_ACT05_OPENING: choices.opening,
      EP08_SACRED_ACT05_MIDDLE: choices.middle,
      EP08_SACRED_ACT05_CLOSING: choices.closing,
      EP08_SACRED_ACT05_NO_SIGNED_AGREEMENT: true,
    },
  };
  return { state, result, applied: true };
}

/** Referenced only by EP09 opening — exclude from ACT05 end-of-act calculations. */
export function getProposedNextEpisodeOpeningTax(unrestAtEp09Opening: number): number {
  if (unrestAtEp09Opening >= 80) return 40;
  if (unrestAtEp09Opening >= 60) return 10;
  return 0;
}
