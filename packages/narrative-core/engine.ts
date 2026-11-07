import {
  StateSchema,
  type Condition,
  type GameState,
  type Effect,
  type Story,
  type EndingRule,
  type Scene,
} from './schema';
import { createCampaign, enterChapter } from './campaign';
export const clone = <T>(value: T): T => structuredClone(value);
export function valueAt(state: GameState, path: string): unknown {
  if (
    !/^(politicalRoute|tarotRoute|politicalScore|clear\.(alinda|finley|tamara|shalia)|flags\.[A-Z][A-Z0-9_]*)$/.test(
      path
    )
  )
    return undefined;
  return path
    .split('.')
    .reduce<unknown>(
      (v, k) =>
        v && typeof v === 'object' && Object.hasOwn(v, k)
          ? (v as Record<string, unknown>)[k]
          : undefined,
      state
    );
}
export function evaluate(state: GameState, c: Condition): boolean {
  if ('all' in c) return c.all.every((x) => evaluate(state, x));
  if ('any' in c) return c.any.some((x) => evaluate(state, x));
  if ('not' in c) return !evaluate(state, c.not);
  const v = valueAt(state, c.path);
  if (c.op === 'exists') return v !== undefined;
  if (v === undefined || c.value === undefined) return false;
  if (c.op === 'eq') return v === c.value;
  if (c.op === 'ne') return v !== c.value;
  if (typeof v !== 'number' || typeof c.value !== 'number') return false;
  return c.op === 'gt'
    ? v > c.value
    : c.op === 'gte'
      ? v >= c.value
      : c.op === 'lt'
        ? v < c.value
        : v <= c.value;
}
export function explain(state: GameState, c: Condition): unknown {
  if ('all' in c) return { all: c.all.map((x) => explain(state, x)), passed: evaluate(state, c) };
  if ('any' in c) return { any: c.any.map((x) => explain(state, x)), passed: evaluate(state, c) };
  if ('not' in c) return { not: explain(state, c.not), passed: evaluate(state, c) };
  return { ...c, actual: valueAt(state, c.path) ?? null, passed: evaluate(state, c) };
}
export function initialState(story: Story): GameState {
  return StateSchema.parse({
    ...(story.plan && story.scenes[story.manifest.start].status !== 'DEMO_ONLY'
      ? {
          campaign: {
            ...createCampaign(story.plan),
            mode: 'PLAYER',
            chapter: story.scenes[story.manifest.start].chapter,
            act: story.scenes[story.manifest.start].interlude
              ? 5
              : Number(story.scenes[story.manifest.start].act.replace('ACT', '')),
          },
        }
      : {}),
    schemaVersion: 2,
    contentVersion: story.manifest.version,
    currentSceneId: story.manifest.start,
    currentSegmentIndex: 0,
    politicalRoute: 'NONE',
    tarotRoute: 'NONE',
    politicalScore: 60,
    clear: { alinda: 1, finley: 1, tamara: 1, shalia: 1 },
    flags: Object.fromEntries(Object.entries(story.manifest.flags).map(([k, v]) => [k, v.initial])),
    decisionLog: [],
    readSegments: [],
    readChapters: [],
    history: [],
  });
}
export function applyEffects(state: GameState, effects: Effect[]): GameState {
  const n = clone(state);
  for (const e of effects) {
    if (e.type === 'flag') {
      if (!Object.hasOwn(n.flags, e.key) || typeof n.flags[e.key] !== typeof e.value)
        throw Error(`Undeclared or wrong-type flag: ${e.key}`);
      n.flags[e.key] = e.value;
    }
    if (e.type === 'clear') n.clear[e.key] += e.delta;
    if (e.type === 'score') n.politicalScore += e.delta;
    if (e.type === 'points') {
      if (!n.campaign || n.campaign.politicalPoints === null)
        throw Error('目前無法確認政治點數，請載入有效的玩家進度。');
      if (n.campaign.politicalPoints + e.delta < 0)
        throw Error(`政治點數不足，需要 ${-e.delta} 點。`);
      n.campaign.politicalPoints += e.delta;
    }
    if (e.type === 'unrest') {
      if (!n.campaign || n.campaign.unrest === null) throw Error('目前無法確認動盪值');
      const value = n.campaign.unrest + e.delta;
      if (!e.clamp && (value < 0 || value > 100)) throw Error('動盪值超出可用範圍');
      n.campaign.unrest = e.clamp ? Math.max(0, Math.min(100, value)) : value;
    }
    if (e.type === 'political') {
      if ((n.politicalRoute !== 'NONE' && n.politicalRoute !== e.value) || n.tarotRoute !== 'NONE')
        throw Error('Political route is locked');
      n.politicalRoute = e.value;
      if (n.campaign?.mode === 'PLAYER') n.campaign.politicalRoute = e.value;
    }
    if (e.type === 'reinforce') {
      if (n.tarotRoute !== 'NONE' || n.politicalRoute === 'NONE')
        throw Error('Invalid historical route transition');
      n.tarotRoute = e.value ? (n.politicalRoute === 'SACRED' ? 'STAR' : 'CHARIOT') : 'TOWER';
    }
  }
  return StateSchema.parse(n);
}
export function choiceUnavailableReason(
  state: GameState,
  choice: Scene['choices'][number]
): string | undefined {
  let points = state.campaign?.politicalPoints;
  for (const effect of choice.effects) {
    if (effect.type !== 'points') continue;
    if (points === undefined || points === null) return '目前無法確認政治點數';
    points += effect.delta;
    if (points < 0) return `政治點數不足，需要 ${-effect.delta} 點`;
  }
  if (choice.previewEffects) {
    try {
      let preview = applyEffects(state, choice.effects);
      for (const item of choice.previewEffects)
        if (evaluate(preview, item.when)) preview = applyEffects(preview, item.effects);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
  return undefined;
}
export function visibleSegments(story: Story, state: GameState) {
  return story.scenes[state.currentSceneId].segments.filter(
    (s) => !s.when || evaluate(state, s.when)
  );
}
export function visibleChoices(story: Story, state: GameState) {
  return story.scenes[state.currentSceneId].choices.filter(
    (c) => !c.when || evaluate(state, c.when)
  );
}
export function segmentKey(story: Story, state: GameState) {
  return `${state.currentSceneId}:${visibleSegments(story, state)[state.currentSegmentIndex]?.id}`;
}
export function nextSceneId(story: Story, state: GameState): string | undefined {
  const scene = story.scenes[state.currentSceneId];
  return scene.conditionalNext && evaluate(state, scene.conditionalNext.when)
    ? scene.conditionalNext.next
    : scene.next;
}
export function markRead(story: Story, state: GameState): GameState {
  let n = clone(state);
  const segment = visibleSegments(story, n)[n.currentSegmentIndex],
    key = segmentKey(story, n);
  if (!segment) return n;
  if (!n.readSegments.includes(key)) n.readSegments.push(key);
  if (
    segment.text.trim() &&
    !n.history.some((h) => h.sceneId === n.currentSceneId && h.segmentId === segment.id)
  )
    n.history.push({
      sceneId: n.currentSceneId,
      segmentId: segment.id,
      speaker: segment.speaker,
      speakerLabel: segment.speakerLabel,
      text: segment.text,
    });
  if (n.currentSegmentIndex === visibleSegments(story, n).length - 1) {
    const completion = story.scenes[n.currentSceneId].completionEffects;
    if (completion && evaluate(n, completion.when)) n = applyEffects(n, completion.effects);
    for (const settlement of story.scenes[n.currentSceneId].settlements ?? [])
      if (evaluate(n, settlement.when)) n = applyEffects(n, settlement.effects);
    for (const [key, value] of Object.entries(
      story.scenes[n.currentSceneId].completionFlags ?? {}
    )) {
      if (!Object.hasOwn(n.flags, key) || typeof n.flags[key] !== typeof value)
        throw Error(`Invalid completion flag ${key}`);
      n.flags[key] = value;
    }
    const ch = story.scenes[n.currentSceneId].chapter;
    if (
      !n.readChapters.includes(ch) &&
      story.scenes[n.currentSceneId].kind === 'end' &&
      story.scenes[n.currentSceneId].completion?.scope !== 'ACT'
    )
      n.readChapters.push(ch);
  }
  return n;
}
export function advance(story: Story, state: GameState): GameState {
  const scene = story.scenes[state.currentSceneId];
  let n = markRead(story, state);
  if (n.currentSegmentIndex < visibleSegments(story, n).length - 1) n.currentSegmentIndex++;
  else if (nextSceneId(story, n)) {
    n.currentSceneId = nextSceneId(story, n)!;
    n.currentSegmentIndex = 0;
  }
  return n;
}
export function choose(story: Story, state: GameState, id: string): GameState {
  const scene = story.scenes[state.currentSceneId];
  if (scene.kind !== 'choice' || scene.pov !== 'OLIVIA' || scene.chapter === 'EP12')
    throw Error('Player choice is forbidden');
  if (state.currentSegmentIndex !== visibleSegments(story, state).length - 1)
    throw Error('Read scene before choosing');
  const c = visibleChoices(story, state).find((c) => c.id === id),
    key = `${scene.id}:${id}`;
  if (!c) throw Error('Choice is unavailable');
  if (state.decisionLog.some((x) => x.startsWith(`${scene.id}:`)))
    throw Error('Choice already committed in this playthrough');
  const unavailable = choiceUnavailableReason(state, c);
  if (unavailable) throw Error(unavailable);
  const n = applyEffects(markRead(story, state), c.effects);
  n.decisionLog.push(key);
  n.currentSceneId = c.next;
  n.currentSegmentIndex = 0;
  return n;
}
export function continueChapter(story: Story, state: GameState, unlocked = false): GameState {
  const scene = story.scenes[state.currentSceneId];
  const target = scene.completion?.nextSceneId;
  if (
    scene.kind !== 'end' ||
    state.currentSegmentIndex !== visibleSegments(story, state).length - 1 ||
    !target ||
    !story.scenes[target] ||
    story.scenes[target].chapter !== scene.completion?.nextChapterId ||
    (story.scenes[target].status === 'DEMO_ONLY') !== (scene.status === 'DEMO_ONLY')
  )
    throw Error('尚未到達可銜接的章節結尾');
  let n = markRead(story, state);
  if (!unlocked) n = enterPlayerChapter(story, n, story.scenes[target].chapter);
  n.currentSceneId = target;
  n.currentSegmentIndex = 0;
  if (n.campaign?.mode === 'PLAYER') {
    const chapter = story.plan?.chapters.find((c) => c.id === story.scenes[target].chapter);
    if (!chapter) throw Error('Missing next chapter plan');
    if (scene.completion?.scope !== 'ACT' && !n.campaign.completedChapters.includes(scene.chapter))
      n.campaign.completedChapters.push(scene.chapter);
    n.campaign.chapter = chapter.id;
    n.campaign.act = story.scenes[target].interlude
      ? 5
      : Number(story.scenes[target].act.replace('ACT', ''));
  }
  return StateSchema.parse(n);
}
// Charge a new chapter once; return visits use its existing receipt.
export function enterPlayerChapter(story: Story, state: GameState, chapterId: string): GameState {
  if (!state.campaign || state.campaign.mode !== 'PLAYER') {
    if ((story.plan?.chapters.find((c) => c.id === chapterId)?.order ?? 0) >= 2)
      throw Error('缺少可結算的玩家數值，請載入具有政治點數與動盪值的存檔。');
    return state;
  }
  if (state.campaign.chapter === chapterId) return state;
  const plan = story.plan,
    chapter = plan?.chapters.find((c) => c.id === chapterId);
  if (!plan || !chapter) throw Error('找不到章節規劃。');
  const n = clone(state),
    campaign = n.campaign!;
  if (chapter.order <= 1 || campaign.upkeep.some((r) => r.chapter === chapterId)) {
    campaign.chapter = chapterId;
    campaign.act = 1;
    return n;
  }
  const previous = plan.chapters.find((c) => c.order === chapter.order - 1);
  if (!previous || !n.readChapters.includes(previous.id))
    throw Error('請先完成前一章，再進入新的章節。');
  campaign.chapter = previous.id;
  if (!campaign.completedChapters.includes(previous.id))
    campaign.completedChapters.push(previous.id);
  const entered = enterChapter(campaign, plan, chapterId);
  if (!['APPLIED', 'UNCHANGED'].includes(entered.status)) throw Error(entered.reason);
  n.campaign = entered.state;
  return n;
}
export function resolveEnding(state: GameState, rules: EndingRule[]) {
  const evaluated = [...rules]
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      id: r.id,
      matched: !!r.when && evaluate(state, r.when),
      trace: r.when ? explain(state, r.when) : 'UNRESOLVED: no approved condition',
    }));
  const hits = evaluated.filter((x) => x.matched),
    winner = rules.find((x) => x.id === hits[0]?.id);
  // Draft Canon is inspectable, but never awarded to the player as an approved ending.
  return {
    status: winner
      ? winner.status === 'APPROVED'
        ? 'RESOLVED'
        : winner.status === 'DEMO_ONLY'
          ? 'DEMO_ONLY'
          : 'UNRESOLVED'
      : 'UNRESOLVED',
    candidate: winner ?? null,
    reason: winner?.reason ?? 'No complete rule matched; author decision required.',
    overridden: hits.slice(1).map((x) => x.id),
    evaluated,
  };
}
export function currentCg(story: Story, state: GameState) {
  const scene = story.scenes[state.currentSceneId];
  if (scene.imageWhen && !evaluate(state, scene.imageWhen)) return undefined;
  const base = (scene.cgWhen ?? []).reduce(
    (cg, variant) => (evaluate(state, variant.when) ? variant.cg : cg),
    scene.cg
  );
  return visibleSegments(story, state)
    .slice(0, state.currentSegmentIndex + 1)
    .reduce((cg, s) => s.cg ?? (s.visual === 'BLACK' && !s.text.trim() ? undefined : cg), base);
}
