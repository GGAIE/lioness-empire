import { CampaignStateSchema, type CampaignPlan, type CampaignState } from './campaign-schema';

export type CampaignResult = {
  status: 'APPLIED' | 'UNCHANGED' | 'UNRESOLVED' | 'BLOCKED';
  state: CampaignState;
  reason: string;
};
const result = (
  status: CampaignResult['status'],
  state: CampaignState,
  reason: string
): CampaignResult => ({ status, state, reason });
const changed = (state: CampaignState, reason: string) =>
  result('APPLIED', CampaignStateSchema.parse(state), reason);
// Explicit sandbox inputs override the authored defaults; no balance is hardcoded in the engine.
export function createCampaign(
  plan: CampaignPlan,
  initial?: { politicalPoints: number; unrest: number; clear?: CampaignState['clear'] }
): CampaignState {
  return CampaignStateSchema.parse({
    schemaVersion: 1,
    planVersion: plan.version,
    mode: 'SANDBOX',
    chapter: null,
    act: 1,
    completedChapters: [],
    politicalPoints: initial?.politicalPoints ?? plan.rules.resource.initial,
    unrest: initial?.unrest ?? plan.rules.unrest.initial,
    politicalRoute: 'NONE',
    tarotRoute: 'NONE',
    clear: initial?.clear ?? { alinda: 0, finley: 0, tamara: 0, shalia: 0 },
    cooperation: {},
    upkeep: [],
    decisions: [],
    milestones: [],
    eventParts: {},
    nielsFailed: false,
    facts: {},
    sealed: false,
  });
}
export function openingCost(
  plan: CampaignPlan,
  chapter: string,
  unrest: number | null
): number | null {
  if (!plan.chapters.some((c) => c.id === chapter)) throw Error('Unknown chapter');
  if (chapter === 'PROLOGUE') return 0;
  if (chapter === 'EP12') return null; // Exemption is a proposal, not an approved zero-cost rule.
  if (unrest === null) return null;
  if (!Number.isInteger(unrest) || unrest < 0 || unrest > 100)
    throw Error('Unrest must be an integer in 0–100');
  return plan.rules.resource.bands.find((b) => unrest >= b.min && unrest <= b.max)?.cost ?? null;
}
export function enterChapter(state: CampaignState, plan: CampaignPlan, id: string): CampaignResult {
  if (state.planVersion !== plan.version)
    return result('UNRESOLVED', state, '規劃版本不同，需要明確遷移。');
  const ch = plan.chapters.find((c) => c.id === id);
  if (!ch) return result('BLOCKED', state, '未知章節。');
  if (state.chapter === id) return result('UNCHANGED', state, '已進入本章，不重複扣點。');
  const index = state.chapter ? plan.chapters.findIndex((c) => c.id === state.chapter) : -1;
  if (ch.order !== index + 1 || (state.chapter && !state.completedChapters.includes(state.chapter)))
    return result('BLOCKED', state, '請先完成目前章節，再依順序承接下一章。');
  if (id === 'EP12')
    return result('UNRESOLVED', state, 'EP12 免扣點例外仍待確認；EP11 封存結果保持原樣。');
  const cost = openingCost(plan, id, state.unrest);
  if (cost === null || (id !== 'PROLOGUE' && state.politicalPoints === null))
    return result('UNRESOLVED', state, '政治點數或動盪初始值尚未設定。');
  if (id !== 'PROLOGUE' && state.politicalPoints! < cost)
    return result('UNRESOLVED', state, '點數不足處理尚未定案；不扣成負值，也不自動判定失敗。');
  const n = structuredClone(state);
  n.chapter = id;
  n.act = 1;
  if (id !== 'PROLOGUE') {
    n.politicalPoints = n.politicalPoints! - cost;
    n.upkeep.push({ chapter: id, unrest: n.unrest!, cost });
  }
  return changed(
    n,
    id === 'PROLOGUE'
      ? '序幕不啟動計分。'
      : `章初依承接動盪 ${n.unrest} 扣除 ${cost} 點；本章不追扣。`
  );
}
export function advanceAct(state: CampaignState, plan: CampaignPlan): CampaignResult {
  const ch = plan.chapters.find((c) => c.id === state.chapter);
  if (!ch) return result('BLOCKED', state, '請先進入章節。');
  if (state.sealed) return result('BLOCKED', state, 'EP11 終局已封存。');
  if (state.completedChapters.includes(ch.id)) return result('UNCHANGED', state, '本章已完成。');
  const n = structuredClone(state);
  if (n.act < ch.acts.length) n.act++;
  else {
    if (ch.id === 'EP11')
      return result('UNRESOLVED', state, '請由終局封存動作完成 EP11，不能繞過路線及未定條件檢查。');
    n.completedChapters.push(ch.id);
  }
  return changed(
    n,
    n.completedChapters.includes(ch.id)
      ? '章末狀態已保存於本次沙盒。'
      : '進入下一幕；這是結構走訪，不代表正式劇情已完成。'
  );
}
export function chooseAlliance(
  state: CampaignState,
  plan: CampaignPlan,
  value: 'SACRED' | 'WORLD'
): CampaignResult {
  if (
    state.sealed ||
    state.chapter !== plan.rules.alliance.chapter ||
    state.act !== plan.rules.alliance.act
  )
    return result('BLOCKED', state, '主導聯盟只在 EP06 ACT III 確立。');
  if (state.politicalRoute !== 'NONE') return result('BLOCKED', state, '政治聯盟已鎖定。');
  return changed({ ...state, politicalRoute: value }, '主導聯盟已鎖定；共同世界事件仍保留。');
}
export function reinforce(state: CampaignState, plan: CampaignPlan, yes: boolean): CampaignResult {
  if (
    state.sealed ||
    state.chapter !== plan.rules.reinforcement.chapter ||
    state.act !== plan.rules.reinforcement.act ||
    state.politicalRoute === 'NONE'
  )
    return result('BLOCKED', state, '先在 EP06 確立聯盟，再於 EP09 ACT IV 決定正式增援。');
  if (state.tarotRoute !== 'NONE') return result('BLOCKED', state, '歷史路線已鎖定。');
  return changed(
    {
      ...state,
      tarotRoute: yes ? (state.politicalRoute === 'SACRED' ? 'STAR' : 'CHARIOT') : 'TOWER',
    },
    '正式增援決定已記錄；Tower 第三團自主攔截不會改寫它。'
  );
}
export interface PlannedDecision {
  id: string;
  cost: number | null;
  unrestDelta: number | null;
  resourceGain: number | null;
}
// Player-facing entry point: callers submit IDs, never point values or generated effects.
export function chooseStoryOption(
  state: CampaignState,
  plan: CampaignPlan,
  decisionId: string,
  optionId: string
): CampaignResult {
  const decision = plan.decisions.find((d) => d.id === decisionId),
    option = decision?.options.find((o) => o.id === optionId);
  const actId = `${state.chapter}_ACT${String(state.act).padStart(2, '0')}`;
  if (!decision || !option || decision.actId !== actId)
    return result('BLOCKED', state, '劇情選項不存在，或不屬於目前場景。');
  const previous = state.storyChoices[decisionId];
  if (previous)
    return result(
      previous === optionId ? 'UNCHANGED' : 'BLOCKED',
      state,
      '這段固定劇情已作出選擇，不重複套用或改選累加。'
    );
  if (option.status !== 'APPROVED')
    return result('UNRESOLVED', state, '這個固定劇情選項的效果尚待作者填寫並核准。');
  const applied = payDecision(state, plan, {
    id: decision.id,
    cost: option.cost,
    resourceGain: option.resourceGain,
    unrestDelta: option.unrestDelta,
  });
  return applied.status === 'APPLIED'
    ? {
        ...applied,
        state: {
          ...applied.state,
          storyChoices: { ...applied.state.storyChoices, [decisionId]: optionId },
        },
      }
    : applied;
}
export function payDecision(
  state: CampaignState,
  plan: CampaignPlan,
  decision: PlannedDecision
): CampaignResult {
  const act = plan.chapters
    .find((c) => c.id === state.chapter)
    ?.acts.find((a) => a.number === state.act);
  if (state.sealed || !act || act.decision === 'NONE')
    return result('BLOCKED', state, '此節點不允許有效玩家決策。');
  const key = `${state.chapter}:${act.id}:${decision.id}`;
  if (state.decisions.includes(key)) return result('UNCHANGED', state, '同一決策效果已執行。');
  if (
    state.politicalPoints === null ||
    state.unrest === null ||
    decision.cost === null ||
    decision.unrestDelta === null ||
    decision.resourceGain === null
  )
    return result('UNRESOLVED', state, '選項成本、資源取得或動盪幅度待填入核准數值。');
  if (
    !decision.id ||
    !Number.isInteger(decision.cost) ||
    decision.cost < 0 ||
    !Number.isInteger(decision.resourceGain) ||
    decision.resourceGain < 0 ||
    !Number.isInteger(decision.unrestDelta)
  )
    throw Error('Invalid decision values');
  if (decision.resourceGain > 0 && decision.unrestDelta <= 0)
    return result('BLOCKED', state, '取得政治資源須記錄其動盪代價。');
  if (state.politicalPoints < decision.cost)
    return result('UNRESOLVED', state, '點數不足規則未定；不借用本選項事後資源支付前置成本。');
  if (decision.resourceGain > 0 && plan.rules.resource.maximum === null)
    return result('UNRESOLVED', state, '資源上限與取得方式尚未核定，不能新增正式資源。');
  const unrest = state.unrest + decision.unrestDelta;
  if (unrest < 0 || unrest > 100)
    return result('UNRESOLVED', state, '動盪越界的截斷方式尚未核定，不默默截斷。');
  return changed(
    {
      ...state,
      politicalPoints: state.politicalPoints - decision.cost + decision.resourceGain,
      unrest,
      decisions: [...state.decisions, key],
    },
    '先支付成本，再記錄局勢結果；不重算當章章初費。'
  );
}
export function recordEventPart(
  state: CampaignState,
  plan: CampaignPlan,
  eventId: string,
  outcome: 'SUCCEEDED' | 'FAILED'
): CampaignResult {
  const event = plan.events.find((e) => e.id === eventId),
    part = event?.parts.find((p) => p.chapter === state.chapter);
  if (
    state.sealed ||
    !event ||
    !part ||
    part.actId !== `${state.chapter}_ACT${String(state.act).padStart(2, '0')}`
  )
    return result('BLOCKED', state, '支線結果必須在對應章節／支線幕記錄。');
  if (
    event.id === 'A4' &&
    !Object.hasOwn(state.eventParts, part.id) &&
    state.facts.NIELS_ENTRY_AUTHORIZED !== true
  )
    return result(
      'UNRESOLVED',
      state,
      '尼爾斯入口 A≥4 與里程碑尚未核定；需明確測試授權，不由 CLEAR 自動觸發。'
    );
  if (state.eventParts[part.id])
    return result(
      state.eventParts[part.id] === outcome ? 'UNCHANGED' : 'BLOCKED',
      state,
      '此事件段落已記錄，不能覆寫或重複得分。'
    );
  if (event.id === 'A4' && state.nielsFailed)
    return result('BLOCKED', state, '本輪尼爾斯事件已失敗，不可事後補回正史資格。');
  const earlier = event.parts.slice(0, event.parts.indexOf(part));
  if (earlier.some((p) => state.eventParts[p.id] !== 'SUCCEEDED'))
    return result('BLOCKED', state, '跨章事件須先完成上篇，不能直接完成下篇。');
  return changed(
    {
      ...state,
      eventParts: { ...state.eventParts, [part.id]: outcome },
      nielsFailed: state.nielsFailed || (event.id === 'A4' && outcome === 'FAILED'),
    },
    '事件進度已記錄；事件篇數不自動等於 CLEAR 點數。'
  );
}
export function awardMilestone(
  state: CampaignState,
  plan: CampaignPlan,
  partId: string
): CampaignResult {
  if (state.sealed) return result('BLOCKED', state, '終局已封存。');
  const event = plan.events.find((e) => e.parts.some((p) => p.id === partId)),
    part = event?.parts.find((p) => p.id === partId);
  if (!part || !event || state.eventParts[partId] !== 'SUCCEEDED')
    return result('BLOCKED', state, '先完成對應里程碑。');
  if (state.milestones.includes(partId)) return result('UNCHANGED', state, '里程碑已計分。');
  if (part.clearAward === null)
    return result('UNRESOLVED', state, '此里程碑 CLEAR 分值尚未核定，不能以事件數代替。');
  const clear = {
    ...state.clear,
    [event.character]: state.clear[event.character] + part.clearAward,
  };
  if (clear[event.character] > plan.rules.clearCaps[event.character])
    return result('BLOCKED', state, 'CLEAR 超出既有上限。');
  return changed(
    { ...state, clear, milestones: [...state.milestones, partId] },
    '里程碑僅計分一次；合作後來失去不抹除建立歷史。'
  );
}
export function assessXi(state: CampaignState, plan: CampaignPlan) {
  const event = plan.events.find((e) => e.id === plan.rules.xi.requiredEvent)!;
  const checks = [
    {
      id: 'STAR',
      label: 'Star 路線',
      status:
        state.tarotRoute === 'STAR'
          ? 'PASS'
          : state.tarotRoute === 'NONE'
            ? 'UNRESOLVED'
            : 'BLOCKED',
    },
    {
      id: 'NIELS',
      label: '尼爾斯事件跨章成功，失敗不可補回',
      status: state.nielsFailed
        ? 'BLOCKED'
        : event.parts.every((p) => state.eventParts[p.id] === 'SUCCEEDED')
          ? 'PASS'
          : 'UNRESOLVED',
    },
    ...plan.rules.xi.requiredFlags.map(({ id, label }) => ({
      id,
      label,
      status:
        state.facts[id] === true ? 'PASS' : state.facts[id] === false ? 'BLOCKED' : 'UNRESOLVED',
    })),
    { id: 'COMMON_GATE', label: '重新校準後的共通門檻', status: 'UNRESOLVED' },
  ];
  return {
    status: checks.some((c) => c.status === 'BLOCKED') ? 'BLOCKED' : 'UNRESOLVED',
    checks,
    awarded: false as const,
    reason: '規劃資格檢查，不頒發正式 XI；父親案結案及尼爾斯血緣證明不列為必要條件。',
  };
}
export function sealEnding(state: CampaignState): CampaignResult {
  if (state.sealed) return result('UNCHANGED', state, '終局已封存。');
  if (state.chapter !== 'EP11' || state.act !== 5 || state.tarotRoute === 'NONE')
    return result('BLOCKED', state, '必須完成 EP11 最終支線幕且路線已形成。');
  return changed(
    { ...state, sealed: true, completedChapters: [...state.completedChapters, 'EP11'] },
    'EP11 狀態已封存；EP12 不得新增改變結局的效果。'
  );
}
