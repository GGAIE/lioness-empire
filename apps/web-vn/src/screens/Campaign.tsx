import { useEffect, useRef, useState } from 'react';
import type {
  CampaignPlan,
  CampaignState,
} from '../../../../packages/narrative-core/campaign-schema';
import {
  createCampaign,
  openingCost,
  enterChapter,
  advanceAct,
  chooseAlliance,
  reinforce,
  chooseStoryOption,
  recordEventPart,
  assessXi,
  sealEnding,
  type CampaignResult,
} from '../../../../packages/narrative-core/campaign';
import './campaign.css';
import {
  chapterEndNotice,
  chapterStartNotice,
  type SettlementNotice,
} from '../../../../packages/narrative-core/settlement';

const characters = [
  { id: 'alinda', name: '艾琳達', letter: 'A' },
  { id: 'shalia', name: '莎莉亞', letter: 'S' },
  { id: 'tamara', name: '塔瑪拉', letter: 'T' },
  { id: 'finley', name: '芬利', letter: 'F' },
] as const;
const statusLabels = {
  APPLIED: '已套用至試算',
  UNCHANGED: '沒有重複執行',
  UNRESOLVED: '尚待確認',
  BLOCKED: '條件不符',
};
export default function Campaign({
  plan,
  state,
  onStateChange,
  onSettlement,
}: {
  plan: CampaignPlan;
  state: CampaignState;
  onStateChange: (state: CampaignState) => void;
  onSettlement: (notice: SettlementNotice) => void;
}) {
  const [tab, setTab] = useState<'chapters' | 'events' | 'systems' | 'pending'>('chapters'),
    [selected, setSelected] = useState('PROLOGUE');
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const dialog = root.current?.closest('dialog');
    if (dialog) dialog.scrollTop = 0;
  }, [tab, selected]);
  const chapter = plan.chapters.find((c) => c.id === selected)!;
  const events = plan.events.filter((e) => e.chapters.includes(chapter.id));
  return (
    <section ref={root} className="campaign" aria-label="第一部劇情架構">
      <header className="campaign-intro">
        <div>
          <span className="eyebrow">THE SHAPE OF A KINGDOM</span>
          <h3>一頂王冠，十三章歷史</h3>
          <p>逐章規劃 v0.1 · 架構已接入，正式劇本待製作</p>
        </div>
        <div className="campaign-counts">
          <span>
            <b>{plan.chapters.length}</b>章節
          </span>
          <span>
            <b>{plan.chapters.flatMap((c) => c.acts).length}</b>幕節點
          </span>
          <span>
            <b>{plan.events.length}</b>角色事件
          </span>
        </div>
      </header>
      <nav className="campaign-tabs" aria-label="架構分類">
        {(
          [
            ['chapters', '章節與五幕'],
            ['events', '角色事件'],
            ['systems', '規則試算'],
            ['pending', '待確認事項'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'chapters' && (
        <div className="campaign-layout">
          <nav className="campaign-chapters" aria-label="規劃章節">
            {plan.chapters.map((c) => (
              <button key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>
                <span>{c.id === 'PROLOGUE' ? '序' : String(c.order).padStart(2, '0')}</span>
                <strong>{c.title}</strong>
              </button>
            ))}
          </nav>
          <div className="chapter-outline">
            <div className="outline-heading">
              <span>{chapter.id === 'PROLOGUE' ? 'PROLOGUE' : chapter.id}</span>
              <span>規劃稿 · 尚無正式對白</span>
            </div>
            <h3>{chapter.title}</h3>
            <p className="chapter-cause">{chapter.summary}</p>
            <ol className="act-list">
              {chapter.acts.map((act) => (
                <li key={act.id}>
                  <div className="act-index">{['I', 'II', 'III', 'IV', 'V'][act.number - 1]}</div>
                  <div>
                    <div className="act-heading">
                      <h4>{act.label}</h4>
                      <span>
                        {act.decision === 'NONE'
                          ? '無有效選項'
                          : act.decision === 'MAIN_SLOT'
                            ? '主線決策待撰寫'
                            : '支線決策依事件安排'}
                      </span>
                    </div>
                    <p>{act.summary}</p>
                    <small>
                      {act.id} · 原稿第 {act.source.line} 行
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="chapter-events">
              <h4>本章接入事件</h4>
              {events.length ? (
                <div className="event-tags">
                  {events.map((e) => (
                    <span key={e.id}>
                      {e.id} {e.title}
                      {e.chapters.length > 1 ? ' · 跨章' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p>
                  {chapter.id === 'PROLOGUE'
                    ? '序幕不啟動支線或計分。'
                    : chapter.id === 'EP12'
                      ? '全章純結果演出，承接 EP11 封存狀態。'
                      : '政治資源或動盪處置支線；具體選項與數值待撰寫。'}
                </p>
              )}
            </div>
            <details>
              <summary>章末銜接與原稿備註</summary>
              {chapter.notes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </details>
            <div className="chapter-next">
              <span>
                {chapter.next
                  ? `下一章：${plan.chapters.find((c) => c.id === chapter.next)?.title}`
                  : 'XI 銜接第二部，其餘為平行歷史'}
              </span>
              {chapter.next && (
                <button onClick={() => setSelected(chapter.next!)}>瀏覽下一章 →</button>
              )}
            </div>
          </div>
        </div>
      )}
      {tab === 'events' && (
        <div className="event-lanes">
          <p className="campaign-note">
            24 個事件、30 段章節接入。跨章事件是一件事；事件數與 CLEAR
            分數分開。同一里程碑不重複計分，失去合作也不抹除曾經建立的歷史。
          </p>
          {characters.map((c) => (
            <section key={c.id}>
              <header>
                <h3>{c.name}</h3>
                <span>
                  {plan.events.filter((e) => e.character === c.id).length} 件事件 · CLEAR 上限{' '}
                  {plan.rules.clearCaps[c.id]}
                </span>
              </header>
              {plan.events
                .filter((e) => e.character === c.id)
                .map((e) => (
                  <article key={e.id}>
                    <div>
                      <b>{e.id}</b>
                      <h4>{e.title}</h4>
                      {e.id === 'A4' && <span className="pending-badge">入口待核定</span>}
                    </div>
                    <div className="event-parts">
                      {e.parts.map((p, i) => (
                        <span key={p.id}>
                          {p.chapter}
                          {e.parts.length > 1 ? ` · ${i === 0 ? '上篇' : '下篇'}` : ''}
                        </span>
                      ))}
                    </div>
                    <small>{e.entryNote}</small>
                  </article>
                ))}
            </section>
          ))}
        </div>
      )}
      {tab === 'systems' && (
        <>
          <div className="route-strip">
            <article>
              <b>EP06 · ACT III</b>
              <p>
                Sacred ／ World
                <br />
                主導政治聯盟
              </p>
            </article>
            <span>→</span>
            <article>
              <b>EP09 · ACT IV</b>
              <p>
                正式增援？
                <br />
                承擔歷史後果
              </p>
            </article>
            <span>→</span>
            <article>
              <b>三條終局路線</b>
              <p>
                Sacred + 增援 → Star
                <br />
                World + 增援 → Chariot
                <br />
                不正式增援 → Tower
              </p>
            </article>
          </div>
          <section className="resource-calculator" aria-label="固定劇情效果規則">
            <h3>數值由固定劇情選項決定</h3>
            <p>
              劇情與分支預先寫定。玩家選擇行動後，系統套用該選項預設的政治點數與動盪變化；玩家不輸入數值，也不隨機產生效果。
            </p>
            <p>
              目前已登錄 {plan.decisions.length}{' '}
              組正式劇情選項。未提供的選項與數值保留待填，不自行補定。
            </p>
            <p className="campaign-note">
              章初仍依前一章累積的動盪結算。相同狀態選擇相同選項，結果必定相同。
            </p>
          </section>
          <details className="advanced-mechanics">
            <summary>進階開發測試（不屬於玩家操作）</summary>
            <p>以下僅用於驗證章初扣點與章節承接；測試初始狀態不是玩家可調整的遊戲規則。</p>
            <ResourceCalculator plan={plan} />
            <CampaignWalkthrough
              plan={plan}
              state={state}
              onStateChange={onStateChange}
              onSettlement={onSettlement}
            />
          </details>
        </>
      )}
      {tab === 'pending' && (
        <div className="pending-list">
          <p className="campaign-note">
            保留原稿的待定範圍。架構走訪、試算與舊版存檔，不會把下列事項自動升格為正式設定。
          </p>
          {plan.unresolved.map((q, i) => (
            <article key={q.id}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <p>{q.summary}</p>
            </article>
          ))}
          <h3>姓名異拼待核對</h3>
          <p>顯示規劃原文用字，角色 ID 沿用既有工程；不擅自統一正式譯名。</p>
          <div className="name-aliases">
            {plan.aliases.map((a) => (
              <p key={a.id}>
                {a.existingName} ↔ {a.sourceName}
              </p>
            ))}
          </div>
          <p className="source-note">
            來源：{plan.source.file} · {plan.source.version}
            <br />
            來源原件已保存；此稿提及的 v2.1／v6.1 原件尚未補齊，未宣稱完成全文核對。
          </p>
        </div>
      )}
      <footer className="campaign-disclaimer">
        本頁是規劃稿的遊戲架構預覽。瀏覽章節與試算不解鎖正式 CG、已讀章節或結局。
      </footer>
    </section>
  );
}
function ResourceCalculator({ plan }: { plan: CampaignPlan }) {
  const [points, setPoints] = useState(String(plan.rules.resource.initial ?? '')),
    [unrest, setUnrest] = useState(String(plan.rules.unrest.initial ?? '')),
    [chapter, setChapter] = useState('EP01');
  const balance = points.trim() === '' ? null : Number(points),
    level = unrest.trim() === '' ? null : Number(unrest);
  const valid =
    (balance === null || (Number.isInteger(balance) && balance >= 0)) &&
    (level === null || (Number.isInteger(level) && level >= 0 && level <= 100));
  const cost = valid ? openingCost(plan, chapter, level) : null;
  const message = !valid
    ? '請輸入有效整數；動盪範圍為 0–100。'
    : chapter === 'PROLOGUE'
      ? '序幕不啟動計分。'
      : chapter === 'EP12'
        ? 'EP12 免扣點是待確認提案，目前不執行結算。'
        : balance === null
          ? '請輸入測試政治點數；正式初始值尚未決定。'
          : cost === null
            ? '動盪值尚未設定。'
            : balance < cost
              ? '點數不足規則尚未定案：不扣成負值，也不自動進入失敗結局。'
              : `章初扣 ${cost} 點，剩餘 ${balance - cost} 點。`;
  return (
    <section className="resource-calculator">
      <h3>章初動盪結算</h3>
      <p>政治點數是支付成本的資源，與舊版 PS 分開。測試輸入不代表正式初始值。</p>
      <div className="upkeep-bands">
        {plan.rules.resource.bands.map((b) => (
          <div key={b.min}>
            <span>
              動盪 {b.min}–{b.max}
            </span>
            <b>−{b.cost}</b>
          </div>
        ))}
      </div>
      <p className="campaign-note">
        只採命中的單一級距；動盪 80 以上扣 40，不疊加為 50。當章增加的動盪只影響下一章開局。
      </p>
      <div className="calculator-inputs">
        <label>
          試算章節
          <select
            aria-label="試算章節"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          >
            {plan.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          測試政治點數
          <input
            type="number"
            min="0"
            placeholder="初始值待定"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
        <label>
          承接動盪
          <input
            type="number"
            min="0"
            max="100"
            value={unrest}
            onChange={(e) => setUnrest(e.target.value)}
          />
        </label>
      </div>
      <output aria-label="章初試算結果" className="calculation-result">
        {message}
      </output>
    </section>
  );
}
function CampaignWalkthrough({
  plan,
  state,
  onStateChange,
  onSettlement,
}: {
  plan: CampaignPlan;
  state: CampaignState;
  onStateChange: (state: CampaignState) => void;
  onSettlement: (notice: SettlementNotice) => void;
}) {
  const [points, setPoints] = useState(String(plan.rules.resource.initial ?? '')),
    [unrest, setUnrest] = useState(String(plan.rules.unrest.initial ?? '')),
    [notice, setNotice] = useState('');
  const chapter = plan.chapters.find((c) => c.id === state.chapter),
    next = state.chapter ? chapter?.next : 'PROLOGUE',
    act = chapter?.acts.find((a) => a.number === state.act),
    xi = assessXi(state, plan);
  function run(operation: () => CampaignResult, entering = false) {
    try {
      const r = operation();
      onStateChange(r.state);
      setNotice(`${statusLabels[r.status]}：${r.reason}`);
      if (r.status === 'APPLIED') {
        if (r.state.completedChapters.length > state.completedChapters.length)
          onSettlement(chapterEndNotice(plan, r.state));
        else {
          const receipt = chapterStartNotice(state, r.state);
          if (receipt) onSettlement(receipt);
        }
      } else if (entering && r.status === 'UNRESOLVED')
        onSettlement({
          phase: 'CHAPTER_START',
          title: '章初結算警告',
          severity: 'UNRESOLVED',
          lines: [r.reason, '目前狀態保持不變，尚未扣點。'],
        });
    } catch (e) {
      setNotice(String(e));
    }
  }
  function start() {
    try {
      if (!points.trim() || !unrest.trim()) throw Error('請先填入測試數值。');
      onStateChange(
        createCampaign(plan, { politicalPoints: Number(points), unrest: Number(unrest) })
      );
      setNotice('已建立獨立測試情境；CLEAR 的 0 僅為空白測試基底，不是正式初始值。');
    } catch (e) {
      setNotice(String(e));
    }
  }
  const available = plan.events.filter((e) =>
    e.parts.some((p) => p.chapter === state.chapter && p.actId === act?.id)
  );
  return (
    <section className="campaign-walkthrough">
      <h3>章節流程走訪</h3>
      <p>
        以空白測試狀態檢查章初 → 開場 → 主線決策 → 支線 →
        章末。這裡的按鍵是測試操作，不是正式玩家選項。
      </p>
      <div className="calculator-inputs">
        <label>
          走訪政治點數
          <input
            type="number"
            min="0"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="自行指定測試值"
          />
        </label>
        <label>
          走訪初始動盪
          <input
            type="number"
            min="0"
            max="100"
            value={unrest}
            onChange={(e) => setUnrest(e.target.value)}
          />
        </label>
        <button onClick={start}>建立測試情境</button>
      </div>
      <div className="walk-state">
        <b>{state.chapter ? `${state.chapter} · ACT ${state.act}` : '尚未進入章節'}</b>
        <span>政治資源 {state.politicalPoints ?? '待定'}</span>
        <span>動盪 {state.unrest ?? '待定'}</span>
        <span>
          {state.politicalRoute} → {state.tarotRoute}
        </span>
      </div>
      <p>{act?.summary ?? '序幕是無選項的登基鏡框。'}</p>
      <div className="walk-actions">
        <button
          disabled={!next}
          onClick={() => next && run(() => enterChapter(state, plan, next), true)}
        >
          進入下一章
        </button>
        <button disabled={!chapter} onClick={() => run(() => advanceAct(state, plan))}>
          {act?.number === chapter?.acts.length ? '完成本章' : '前進下一幕'}
        </button>
        {state.chapter === 'EP06' && state.act === 3 && (
          <>
            <button onClick={() => run(() => chooseAlliance(state, plan, 'SACRED'))}>
              測試 Sacred 聯盟
            </button>
            <button onClick={() => run(() => chooseAlliance(state, plan, 'WORLD'))}>
              測試 World 聯盟
            </button>
          </>
        )}
        {state.chapter === 'EP09' && state.act === 4 && (
          <>
            <button onClick={() => run(() => reinforce(state, plan, true))}>測試正式增援</button>
            <button onClick={() => run(() => reinforce(state, plan, false))}>測試不正式增援</button>
          </>
        )}
        {state.chapter === 'EP11' && state.act === 5 && (
          <button onClick={() => run(() => sealEnding(state))}>封存 EP11 終局狀態</button>
        )}
      </div>
      {act && act.decision !== 'NONE' && (
        <section className="decision-testing">
          <h4>本幕固定劇情選項</h4>
          {plan.decisions.filter((d) => d.actId === act.id).length === 0 ? (
            <p>本幕尚未提供正式選項與數值，保留待填。</p>
          ) : (
            plan.decisions
              .filter((d) => d.actId === act.id)
              .map((d) => (
                <div key={d.id}>
                  {d.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => run(() => chooseStoryOption(state, plan, d.id, o.id))}
                    >
                      {o.text}
                      {o.status === 'PENDING' ? '（效果待填）' : ''}
                    </button>
                  ))}
                </div>
              ))
          )}
        </section>
      )}
      {available.length > 0 && (
        <div className="walk-events">
          <h4>本幕事件接入</h4>
          {available.map((e) => (
            <div key={e.id}>
              <span>
                {e.id} {e.title}
              </span>
              <button onClick={() => run(() => recordEventPart(state, plan, e.id, 'SUCCEEDED'))}>
                記錄測試成功
              </button>
              <button onClick={() => run(() => recordEventPart(state, plan, e.id, 'FAILED'))}>
                記錄測試失敗
              </button>
            </div>
          ))}
        </div>
      )}
      {notice && (
        <p className="walk-notice" role="status">
          {notice}
        </p>
      )}
      <details>
        <summary>章初結算紀錄（不重複扣點）</summary>
        {state.upkeep.map((r) => (
          <p key={r.chapter}>
            {r.chapter} · 動盪 {r.unrest} · 扣除 {r.cost}
          </p>
        ))}
      </details>
      <div className="xi-checklist">
        <h4>XI 正史資格檢查</h4>
        <p>{xi.reason}</p>
        {xi.checks.map((c) => (
          <div key={c.id}>
            <span>{c.label}</span>
            <b>
              {c.status === 'PASS'
                ? '條件已記錄'
                : c.status === 'BLOCKED'
                  ? '本輪受阻'
                  : '待確認／未完成'}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
