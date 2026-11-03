import type {
  CampaignPlan,
  CampaignState,
} from '../../../../packages/narrative-core/campaign-schema';
import { openingCost } from '../../../../packages/narrative-core/campaign';
export function ResourceHud({
  state,
  plan,
  unlocked = false,
}: {
  state: CampaignState | null;
  plan?: CampaignPlan;
  unlocked?: boolean;
}) {
  const points = state?.politicalPoints ?? null,
    unrest = state?.unrest ?? null;
  const band =
    plan && unrest !== null
      ? plan.rules.resource.bands.find((b) => unrest >= b.min && unrest <= b.max)
      : undefined;
  const next = plan?.chapters.find((c) => c.id === state?.chapter)?.next;
  const cost = plan && next ? openingCost(plan, next, unrest) : null;
  return (
    <section
      className={`resource-hud${band?.cost ? ' resource-hud--warning' : ''}`}
      aria-label="政治點數與動盪值"
    >
      <div className="resource-hud-context">
        <span>{state?.chapter ?? '尚未開始'}</span>
        <small>
          {state?.mode === 'PLAYER'
            ? '劇情進行中'
            : points === null
              ? '新制數值待劇情設定'
              : state?.chapter === null &&
                  points === plan?.rules.resource.initial &&
                  unrest === plan?.rules.unrest.initial
                ? '劇情初始值'
                : '章節走訪 · 測試狀態'}
        </small>
      </div>
      <div className="resource-hud-stat">
        <span>政治點數</span>
        <strong data-testid="political-points">{points ?? '待設定'}</strong>
      </div>
      <div className="resource-hud-stat">
        <span>動盪值</span>
        <strong data-testid="unrest-value">{unrest === null ? '待設定' : `${unrest} / 100`}</strong>
      </div>
      <div className="resource-hud-forecast" aria-live="polite">
        {unlocked
          ? '自由閱讀 · 切換章節不扣點'
          : cost !== null
            ? `下章開局預計扣 ${cost} 點`
            : next === 'EP12'
              ? 'EP12 結算規則待確認'
              : '依固定劇情選項更新'}
      </div>
    </section>
  );
}
