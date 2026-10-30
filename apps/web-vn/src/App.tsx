import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { GameState, Story } from '../../../packages/narrative-core/schema';
import {
  advance,
  continueChapter,
  choose,
  currentCg,
  initialState,
  markRead,
  resolveEnding,
  segmentKey,
  visibleChoices,
  visibleSegments,
} from '../../../packages/narrative-core/engine';
import { EndingRuleSchema } from '../../../packages/narrative-core/schema';
import { loadStory, assetUrl } from './engine/load';
import {
  defaults,
  emptyMeta,
  getPreference,
  getSaves,
  mergeMeta,
  MetaSchema,
  SettingsSchema,
  putPreference,
  saveGame,
  backupSave,
  restoreSave,
  parseImport,
  exportSave,
  type Meta,
  type SaveRecord,
  type Settings,
} from './storage/saves';
import { useTypewriter } from './hooks/useTypewriter';
import { useAudio } from './hooks/useAudio';
import { Stage } from './components/Stage';
import { Modal } from './components/Modal';
import { Library } from './screens/Library';
import { ChapterDirectory } from './screens/ChapterDirectory';
import {
  actName,
  continueCommittedChoice,
  openDirectorySection,
} from '../../../packages/narrative-core/directory';
import { SaveSlots } from './screens/SaveSlots';
import { ResourceHud } from './components/ResourceHud';
import { createCampaign } from '../../../packages/narrative-core/campaign';
import type { CampaignState } from '../../../packages/narrative-core/campaign-schema';
import type { SettlementNotice } from '../../../packages/narrative-core/settlement';
const Developer = import.meta.env.DEV ? lazy(() => import('./screens/Developer')) : null;
const Campaign = import.meta.env.DEV ? lazy(() => import('./screens/Campaign')) : null;
type Panel =
  | 'saves'
  | 'history'
  | 'gallery'
  | 'endings'
  | 'chapters'
  | 'settings'
  | 'developer'
  | 'restart'
  | 'campaign'
  | null;
export default function App() {
  const [loaded, setLoaded] = useState<{
      story: Story;
      meta: Meta;
      settings: Settings;
      demoRules: z.infer<typeof EndingRuleSchema>[];
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const story = await loadStory();
      let meta = emptyMeta,
        settings = defaults;
      try {
        const [m, s] = await Promise.all([getPreference('meta'), getPreference('settings')]);
        if (m) meta = MetaSchema.parse(m);
        if (s) settings = SettingsSchema.parse(s);
      } catch {
        if (active) setError('瀏覽器儲存暫不可用或設定損壞。仍可開始閱讀，存檔時會顯示結果。');
      }
      const r = await fetch(assetUrl('content/endings/demo.json'));
      if (!r.ok) throw Error('示範規則載入失敗');
      const demoRules = z.array(EndingRuleSchema).parse(await r.json());
      if (active) setLoaded({ story, meta, settings, demoRules });
    })().catch((e) => {
      if (active) setError(String(e));
    });
    return () => {
      active = false;
    };
  }, []);
  if (!loaded)
    return (
      <main className="loading">
        <div className="crest">♜</div>
        <h1>母獅帝國</h1>
        <p>{error || '正在整理尚未寫下的歷史……'}</p>
        {error && <button onClick={() => location.reload()}>重新載入</button>}
      </main>
    );
  return <Game {...loaded} startupMessage={error} />;
}
function Game({
  story,
  meta: initialMeta,
  settings: initialSettings,
  demoRules,
  startupMessage,
}: {
  story: Story;
  meta: Meta;
  settings: Settings;
  demoRules: z.infer<typeof EndingRuleSchema>[];
  startupMessage: string;
}) {
  const [campaignState, setCampaignState] = useState<CampaignState | null>(() =>
    story.plan ? createCampaign(story.plan) : null
  );
  const [settlement, setSettlement] = useState<SettlementNotice | null>(null);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [state, setState] = useState(() => initialState(story)),
    [meta, setMeta] = useState(initialMeta),
    [settings, setSettings] = useState(initialSettings),
    [started, setStarted] = useState(false),
    [panel, setPanel] = useState<Panel>(null),
    [message, setMessage] = useState(startupMessage),
    [records, setRecords] = useState<SaveRecord[]>([]),
    [auto, setAuto] = useState(false),
    [skip, setSkip] = useState(false),
    [nonce, setNonce] = useState(0),
    [pending, setPending] = useState<{
      state: GameState;
      notices: string[];
      original?: SaveRecord;
    } | null>(null);
  const skipKnown = useRef(new Set<string>()),
    metaRef = useRef(meta),
    stateRef = useRef(state),
    autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    loadGeneration = useRef(0);
  const frameRef = useRef<HTMLElement>(null),
    dialogueRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (started) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [started]);
  useEffect(() => {
    if (!started || !dialogueRef.current) return;
    const element = dialogueRef.current;
    let resizeFrame = 0,
      previousHeight = -1;
    const update = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height === previousHeight) return;
      previousHeight = height;
      frameRef.current?.style.setProperty('--dialogue-height', `${height}px`);
    };
    update();
    // Defer layout writes outside ResizeObserver delivery to avoid WebKit loops
    // when the mobile frame grows to fit a long paragraph or the final caption.
    const observer = new ResizeObserver(() => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        update();
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
    };
  }, [started]);
  stateRef.current = state;
  metaRef.current = meta;
  const scene = story.scenes[state.currentSceneId],
    segments = visibleSegments(story, state),
    segment = segments[state.currentSegmentIndex],
    key = `${nonce}:${segmentKey(story, state)}`,
    last = state.currentSegmentIndex === segments.length - 1;
  const actLabel = actName(Number(scene.act.replace('ACT', '')));
  const actScenes = Object.values(story.scenes).filter(
    (s) => s.chapter === scene.chapter && s.act === scene.act
  );
  const sceneNumber = scene.sceneNumber ?? actScenes.findIndex((s) => s.id === scene.id) + 1;
  const sceneCount = new Set(actScenes.map((s) => s.sceneNumber ?? s.id)).size;
  const continueLabel = scene.completion?.continueLabel ?? '進入 EP01 第一幕';
  const committedChoice = scene.choices.find((c) =>
    state.decisionLog.includes(`${scene.id}:${c.id}`)
  );
  const writer = useTypewriter(started ? segment.text : '', settings.speed, key);
  const hud = (
    <ResourceHud
      plan={story.plan}
      state={
        started && scene.status !== 'DEMO_ONLY' && panel !== 'campaign'
          ? (state.campaign ?? null)
          : campaignState
      }
    />
  );
  const notify = useCallback((m: string) => setMessage(m), []);
  const audio = useAudio(
    story,
    started ? scene.bgm : undefined,
    started ? segment.sfx : undefined,
    key,
    settings.bgm,
    settings.sfx,
    notify
  );
  const refreshSaves = useCallback(async () => {
    try {
      setRecords(await getSaves());
    } catch {
      notify('無法讀取瀏覽器存檔；請檢查儲存權限。');
    }
  }, [notify]);
  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 8000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    void putPreference('settings', settings).catch(() => notify('設定未能保存。'));
  }, [settings, notify]);
  useEffect(() => {
    void putPreference('meta', meta).catch(() => notify('收藏與已讀紀錄未能保存。'));
  }, [meta, notify]);
  const collect = useCallback(
    (id: string) => setMeta((m) => (m.cg.includes(id) ? m : { ...m, cg: [...m.cg, id] })),
    []
  );
  useEffect(() => {
    if (!started || !writer.complete) return;
    const current = stateRef.current,
      marked = markRead(story, current);
    if (!current.readSegments.includes(segmentKey(story, current))) setState(marked);
    setMeta((m) => {
      const ending =
        scene.kind === 'end' && !scene.completion
          ? resolveEnding(marked, scene.status === 'DEMO_ONLY' ? demoRules : story.endings)
          : null;
      const result = mergeMeta(
        m,
        marked,
        undefined,
        ending && (ending.status === 'RESOLVED' || ending.status === 'DEMO_ONLY')
          ? ending.candidate?.id
          : undefined
      );
      return JSON.stringify(m) === JSON.stringify(result) ? m : result;
    });
  }, [started, writer.complete, key, scene.kind, story, demoRules]);
  async function thumbnail(snapshot: GameState): Promise<string | null> {
    const id = currentCg(story, snapshot),
      a = story.assets.find((a) => a.id === id);
    if (!a) return null;
    try {
      const img = new Image();
      img.src = assetUrl(a.src);
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      canvas.getContext('2d')?.drawImage(img, 0, 0, 320, 180);
      return canvas.toDataURL('image/jpeg', 0.65);
    } catch {
      return null;
    }
  }
  const store = useCallback(
    async (slot: string, snapshot: GameState, generation = loadGeneration.current) => {
      try {
        const thumb = await thumbnail(snapshot);
        if (slot === 'auto' && generation !== loadGeneration.current) return;
        await saveGame({
          slot,
          savedAt: new Date().toISOString(),
          title: story.scenes[snapshot.currentSceneId].title,
          thumbnail: thumb,
          state: snapshot,
        });
        await refreshSaves();
        if (slot !== 'auto') notify('進度已儲存。');
      } catch (e) {
        notify('存檔失敗，進度仍在本頁。' + String(e));
      }
    },
    [story, refreshSaves, notify]
  );
  useEffect(() => {
    if (!started || pending) return;
    const generation = loadGeneration.current;
    autoSaveTimer.current = setTimeout(() => void store('auto', state, generation), 350);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [state, started, pending, store]);
  const move = useCallback(() => {
    if (panel || pending || !started) return;
    if (!writer.complete) {
      writer.reveal();
      return;
    }
    if ((scene.kind === 'end' || scene.kind === 'choice') && last) return;
    setState((s) => advance(story, s));
  }, [panel, pending, started, writer.complete, key, scene.kind, last, story]);
  const select = (id: string) => {
    try {
      setState((s) => choose(story, s, id));
      setSkip(false);
    } catch (e) {
      notify(String(e));
    }
  };
  useEffect(() => {
    if (panel || pending || !started || (!auto && !skip)) return;
    if (skip && !skipKnown.current.has(segmentKey(story, state))) {
      setSkip(false);
      notify('已到達尚未閱讀的段落。');
      return;
    }
    if (last && (scene.kind === 'choice' || scene.kind === 'end')) {
      setSkip(false);
      return;
    }
    const t = setTimeout(
      () => {
        if (skip && !writer.complete) writer.reveal();
        else if (writer.complete) move();
      },
      skip ? 80 : settings.autoDelay
    );
    return () => clearTimeout(t);
  }, [
    auto,
    skip,
    started,
    panel,
    pending,
    key,
    writer.complete,
    last,
    scene.kind,
    settings.autoDelay,
    move,
    state,
    story,
  ]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName)
      )
        return;
      if (['Space', 'Enter'].includes(e.code)) {
        e.preventDefault();
        move();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [move]);
  function applyLoaded(next: GameState) {
    loadGeneration.current++;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAuto(false);
    setSkip(false);
    setState(next);
    setNonce((n) => n + 1);
    setStarted(true);
    setPanel(null);
    setPending(null);
    notify('已載入進度。');
  }
  function requestLoad(r: SaveRecord) {
    try {
      const restored = restoreSave(r.state, story);
      if (restored.notices.length) setPending({ ...restored, original: r });
      else applyLoaded(restored.state);
    } catch (e) {
      notify('無法讀取此存檔：' + String(e));
    }
  }
  async function readSection(id: string, current: boolean) {
    if (directoryBusy) return;
    if (current) {
      applyLoaded(stateRef.current);
      notify('');
      return;
    }
    setDirectoryBusy(true);
    try {
      const snapshot = stateRef.current;
      const next = openDirectorySection(story, started ? snapshot : initialState(story), id);
      if (started) {
        loadGeneration.current++;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        await backupSave({
          slot: 'chapter-navigation',
          savedAt: new Date().toISOString(),
          title: `章節切換前 · ${story.scenes[snapshot.currentSceneId].title}`,
          thumbnail: await thumbnail(snapshot),
          state: snapshot,
        });
        await refreshSaves();
      } else {
        const previous = records.find((r) => r.slot === 'auto');
        if (previous) {
          await backupSave(previous);
          await refreshSaves();
        }
      }
      applyLoaded(next);
      notify('');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      notify('尚未切換小節。請先完成前面的選擇，或確認目前進度能正常保存。');
    } finally {
      setDirectoryBusy(false);
    }
  }
  function download(r: SaveRecord) {
    const blob = new Blob([exportSave(r)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `lioness-save-${r.slot}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file: File) {
    try {
      if (file.size > 5_000_000) throw Error('檔案超過 5 MB');
      const imported = parseImport(await file.text(), story);
      setPending({
        state: imported.state,
        original: imported.record,
        notices: [
          '匯入將在確認後載入；原始資料會另存遷移備份，可在存讀檔視窗匯出。',
          ...imported.notices,
        ],
      });
    } catch (e) {
      notify('匯入失敗：' + String(e));
    }
  }
  const open = (p: Panel) => {
    setAuto(false);
    setSkip(false);
    setPanel(p);
  };
  const labels: Record<Exclude<Panel, null>, string> = {
    saves: '存讀進度',
    history: '對話回顧',
    gallery: 'CG 鑑賞室',
    endings: '命運圖鑑',
    chapters: '章節目錄',
    settings: '閱讀設定',
    developer: '開發者工具',
    restart: '重新開始',
    campaign: '第一部劇情架構',
  };
  const controls = [
    ['saves', '存讀檔'],
    ['history', '回顧'],
    ['gallery', '鑑賞'],
    ['endings', '結局'],
    ['chapters', '章節'],
    ['settings', '設定'],
  ] as const;
  return (
    <main className="shell">
      <header className="masthead">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (started) open('restart');
          }}
        >
          <span className="brand-mark">♜</span>
          <span>
            母獅帝國<small>LIONESS EMPIRE</small>
          </span>
        </a>
        <div className="edition">
          <i /> HTML5 VISUAL NOVEL <span>第一階段 · 0.1</span>
        </div>
        <button className="sound" onClick={audio.toggle}>
          {audio.enabled ? '關閉聲音' : '開啟聲音'}
        </button>
      </header>
      {hud}
      <div className="workspace">
        <aside className="side-label">
          <span>THE CHRONICLES OF A CROWN</span>
          <span>EST. MMXXVI</span>
        </aside>
        <section
          ref={frameRef}
          className="game-frame"
          aria-label="視覺小說閱讀器"
          data-scene-id={scene.id}
          data-segment-id={segment.id}
        >
          <Stage story={story} state={state} onLoaded={collect} active={started} />
          {!started ? (
            <div className="title-screen">
              <div className="eyebrow">A KINGDOM. A CROWN. A CHOICE.</div>
              <span className="title-ornament">◇</span>
              <h1>母獅帝國</h1>
              <p className="latin-title">LIONESS EMPIRE</p>
              <p className="title-copy">王冠之下，歷史尚未寫定。</p>
              <div className="title-actions">
                {Campaign && story.plan && (
                  <button className="outline-entry" onClick={() => open('campaign')}>
                    瀏覽劇情架構 <span>↗</span>
                  </button>
                )}
                <button
                  className="primary"
                  onClick={() => {
                    setCampaignState(story.plan ? createCampaign(story.plan) : null);
                    setStarted(true);
                  }}
                >
                  開始序幕 <span>→</span>
                </button>
                <button aria-label="章節目錄" onClick={() => open('chapters')}>
                  章節目錄 <span>→</span>
                </button>
                {Developer && (
                  <button
                    onClick={() => {
                      const entry = story.manifest.chapters.find(
                        (c) => c.status === 'DEMO_ONLY'
                      )?.entry;
                      if (entry) {
                        applyLoaded({ ...initialState(story), currentSceneId: entry });
                        setAuto(false);
                      }
                    }}
                  >
                    引擎試演
                  </button>
                )}
                <button
                  disabled={!records.find((r) => r.slot === 'auto')}
                  onClick={() => {
                    const r = records.find((r) => r.slot === 'auto');
                    if (r) requestLoad(r);
                  }}
                >
                  繼續閱讀
                </button>
              </div>
              <div className="demo-note">
                序幕〈母獅登基〉· v0.6
                <br />
                <span>序幕已開放 ／ 第一章已提供四幕 · 原稿草稿版</span>
              </div>
            </div>
          ) : (
            <>
              <div className="scene-heading">
                <div>
                  <span>
                    {scene.status === 'DEMO_ONLY'
                      ? 'DEMO ONLY'
                      : `${scene.chapter === 'PROLOGUE' ? '序幕' : `${scene.chapter} · ${actLabel}`} · ${scene.playback === 'CUTSCENE' ? '無選項過場' : scene.kind === 'choice' ? (scene.choiceMode === 'DIALOGUE_FLAVOR' ? '對話回應' : '工作優先順序') : '劇情進行中'}`}{' '}
                    /{' '}
                    {scene.kind === 'result'
                      ? 'RESULT · NO CHOICE'
                      : `${sceneNumber} / ${sceneCount}`}
                  </span>
                  <h2>{scene.title}</h2>
                </div>
                <span className="scene-progress">
                  {String(state.currentSegmentIndex + 1).padStart(2, '0')} /{' '}
                  {String(segments.length).padStart(2, '0')}
                </span>
              </div>
              {scene.kind === 'choice' && last && writer.complete && (
                <div className="choices" aria-label="劇情選項">
                  {committedChoice ? (
                    <>
                      <p className="committed-choice">已選擇：{committedChoice.text}</p>
                      <button
                        onClick={() => {
                          applyLoaded(continueCommittedChoice(story, state));
                          notify('');
                        }}
                      >
                        繼續已選擇的路線 <b>↗</b>
                      </button>
                    </>
                  ) : (
                    visibleChoices(story, state).map((c, i) => (
                      <button key={c.id} onClick={() => select(c.id)}>
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {c.text}
                        <b>↗</b>
                      </button>
                    ))
                  )}
                </div>
              )}
              {scene.completion && last && writer.complete && (
                <section
                  className={`chapter-complete${segment.kind === 'caption' ? ' with-caption' : ''}`}
                  aria-label="章節完成"
                >
                  <span>
                    {scene.chapter} /{' '}
                    {scene.completion.scope === 'ACT' ? `${scene.act} COMPLETE` : 'COMPLETE'}
                  </span>
                  <h3>{scene.completion.title}</h3>
                  <p>
                    {scene.completion.nextSceneId
                      ? (scene.completion.nextLabel ?? 'EP01〈王冠之前〉· ACT I〈平靜被打破〉')
                      : (scene.completion.pendingLabel ??
                        `${scene.completion.nextChapterId} · 劇本尚未提供`)}
                  </p>
                  {scene.completion.nextSceneId && (
                    <button
                      className="primary"
                      onClick={() => {
                        setAuto(false);
                        setSkip(false);
                        setState((s) => continueChapter(story, s));
                      }}
                    >
                      {continueLabel} →
                    </button>
                  )}
                  <small>
                    政治點數 {state.campaign?.politicalPoints ?? '待設定'} · 動盪{' '}
                    {state.campaign?.unrest ?? '待設定'} ·{' '}
                    {scene.completion.scope === 'ACT'
                      ? '本幕不變更數值；整章尚未結算'
                      : '序幕不計分、不扣點'}
                  </small>
                </section>
              )}
              <div
                ref={dialogueRef}
                className={`dialogue-wrap${segment.kind === 'caption' && !(last && scene.completion) ? ' caption-mode' : ''}`}
              >
                {segment.speaker && segment.speaker !== 'NARRATOR' && (
                  <div className="speaker-line">
                    <span>{segment.speakerLabel ?? story.characters[segment.speaker]}</span>
                    <small>{scene.kind === 'result' ? 'NO CHOICE' : 'LIONESS EMPIRE'}</small>
                  </div>
                )}
                <button
                  className="dialogue"
                  aria-label="推進對話"
                  onClick={move}
                  style={{ fontSize: settings.fontSize + (segment.kind === 'caption' ? 6 : 0) }}
                >
                  <span data-testid="dialogue-text">{writer.text}</span>
                  <span className="continue-mark">
                    {writer.complete
                      ? scene.kind === 'end' && last
                        ? '終'
                        : scene.kind === 'choice' && last
                          ? '◇'
                          : '▼'
                      : '·'}
                  </span>
                </button>
                <div className="dialogue-bottom">
                  <span>
                    {scene.kind === 'end' && last
                      ? scene.completion
                        ? scene.completion.nextSceneId
                          ? `可${continueLabel}`
                          : (scene.completion.pendingLabel ?? '待續')
                        : 'DEMO_ONLY · 測試完成'
                      : !writer.complete
                        ? '點擊顯示全文'
                        : scene.kind === 'choice' && last
                          ? '選擇下一步'
                          : '點擊繼續 / SPACE'}
                  </span>
                  <div>
                    <button
                      aria-pressed={auto}
                      onClick={() => {
                        setAuto((v) => !v);
                        setSkip(false);
                      }}
                    >
                      AUTO
                    </button>
                    <button
                      aria-pressed={skip}
                      onClick={() => {
                        skipKnown.current = new Set(metaRef.current.read);
                        setSkip((v) => !v);
                        setAuto(false);
                      }}
                    >
                      已讀跳過
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
        <aside className="right-rail">
          <span>01</span>
          <div />
          <span>{scene.chapter === 'EP01' ? '一' : '序'}</span>
        </aside>
      </div>
      <nav className="toolbar" aria-label="遊戲選單">
        <span className="session-label">{started ? 'READING SESSION' : 'YOUR STORY AWAITS'}</span>
        <div>
          {Campaign && story.plan && <button onClick={() => open('campaign')}>劇情架構</button>}
          {controls.map(([p, label]) => (
            <button key={p} onClick={() => open(p)}>
              {label}
            </button>
          ))}
          {Developer && <button onClick={() => open('developer')}>開發</button>}
          <button
            onClick={() => {
              const action = document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen?.();
              if (!action) notify('此瀏覽器不支援網頁全螢幕，可使用加入主畫面模式。');
              else void action.catch(() => notify('瀏覽器未允許全螢幕。'));
            }}
          >
            全螢幕
          </button>
        </div>
      </nav>
      <footer className="page-footer">
        <span>
          序章 + EP01—EP12 <i>／</i> 內容持續建構中
        </span>
        <span>
          {scene.status === 'DEMO_ONLY'
            ? 'DEMO_ONLY · 引擎試演'
            : scene.chapter === 'EP01'
              ? `${scene.chapter} ${actLabel} v${scene.version.replace(/\.0$/, '')} · 草稿試演`
              : '序幕 v0.6 · 草稿試演'}
        </span>
      </footer>
      {message && !panel && !pending && (
        <div className="toast" role="status">
          {message}
          <button aria-label="關閉通知" onClick={() => setMessage('')}>
            ✕
          </button>
        </div>
      )}
      {panel && (
        <Modal
          title={labels[panel]}
          statusBar={hud}
          close={() => {
            setPanel(null);
            setPending(null);
          }}
        >
          {panel === 'campaign' && Campaign && story.plan && (
            <Suspense fallback={<p>載入章節規劃……</p>}>
              <Campaign
                plan={story.plan}
                state={campaignState!}
                onStateChange={setCampaignState}
                onSettlement={setSettlement}
              />
            </Suspense>
          )}
          {message && !pending && (
            <p className="panel-message" role="status">
              {message}
            </p>
          )}
          {panel === 'saves' && (
            <SaveSlots
              records={records}
              onSave={async (id) => {
                if (!started) {
                  notify('請先開始試演。');
                  return;
                }
                await store(id, stateRef.current);
              }}
              onLoad={requestLoad}
              onExport={download}
              onImport={(file) => void importFile(file)}
            />
          )}
          {panel === 'history' && (
            <div className="history">
              {state.history.length ? (
                state.history.map((h, i) => (
                  <article key={i}>
                    {h.speaker && h.speaker !== 'NARRATOR' && (
                      <span>{h.speakerLabel ?? story.characters[h.speaker]}</span>
                    )}
                    <p>{h.text}</p>
                    <small>{h.sceneId}</small>
                  </article>
                ))
              ) : (
                <p>閱讀過的完整段落會出現在這裡。</p>
              )}
            </div>
          )}
          {panel === 'chapters' && (
            <ChapterDirectory
              story={story}
              meta={meta}
              state={state}
              started={started}
              busy={directoryBusy}
              onRead={(id, current) => void readSection(id, current)}
            />
          )}
          {(panel === 'gallery' || panel === 'endings') && (
            <Library story={story} meta={meta} mode={panel} />
          )}
          {panel === 'settings' && (
            <div className="settings">
              {(
                [
                  ['speed', '逐字間隔（0 為立即顯示）', 0, 100, 1, 'ms'],
                  ['fontSize', '字型大小', 16, 32, 1, 'px'],
                  ['bgm', '配樂音量', 0, 1, 0.05, ''],
                  ['sfx', '音效音量', 0, 1, 0.05, ''],
                  ['autoDelay', '自動閱讀等待', 500, 10000, 100, 'ms'],
                ] as const
              ).map(([k, label, min, max, step, unit]) => (
                <label key={k}>
                  {label}
                  <output>
                    {settings[k].toFixed(k === 'bgm' || k === 'sfx' ? 2 : 0)}
                    {unit}
                  </output>
                  <input
                    aria-label={label}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[k]}
                    onChange={(e) => setSettings((s) => ({ ...s, [k]: Number(e.target.value) }))}
                  />
                </label>
              ))}
              <p>聲音須先按「開啟聲音」。自動播放在選項前停下；已讀跳過遇到新段落會停止。</p>
              <button onClick={() => setSettings(defaults)}>恢復預設設定</button>
            </div>
          )}
          {panel === 'restart' && (
            <>
              <p>重新開始試演？手動存檔與收藏會保留，自動存檔將隨新進度更新。</p>
              <button
                className="primary"
                onClick={() => {
                  applyLoaded(initialState(story));
                  setCampaignState(story.plan ? createCampaign(story.plan) : null);
                  notify('已開始新的試演。');
                }}
              >
                重新開始
              </button>
            </>
          )}
          {panel === 'developer' && Developer && (
            <Suspense fallback={<p>載入工具……</p>}>
              <Developer
                story={story}
                state={state}
                jump={(id) => {
                  if (story.scenes[id]) {
                    setState((s) => ({ ...s, currentSceneId: id, currentSegmentIndex: 0 }));
                    setNonce((n) => n + 1);
                    setStarted(true);
                    setPanel(null);
                    notify('開發跳轉完成；既有選擇效果不會重複執行。');
                  }
                }}
              />
            </Suspense>
          )}
        </Modal>
      )}
      {pending && (
        <Modal
          title="確認存檔遷移"
          role="alertdialog"
          close={() => setPending(null)}
          statusBar={hud}
        >
          <div className="migration-notices">
            {message && (
              <p className="panel-message" role="status">
                {message}
              </p>
            )}
            {pending.notices.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
            <button
              className="primary"
              onClick={() => {
                void (async () => {
                  if (pending.original) await backupSave(pending.original);
                  applyLoaded(pending.state);
                  await refreshSaves();
                })().catch(() => notify('未能保存原始備份，尚未替換目前進度。可取消後重試。'));
              }}
            >
              確認並載入
            </button>
            <button onClick={() => setPending(null)}>取消</button>
          </div>
        </Modal>
      )}
      {settlement && (
        <Modal
          title={settlement.title}
          role="alertdialog"
          close={() => setSettlement(null)}
          statusBar={hud}
        >
          <div className={`settlement-notice settlement-${settlement.severity.toLowerCase()}`}>
            <span className="settlement-label">
              {settlement.phase === 'CHAPTER_END' ? '章末狀態與下章預告' : '實際章初扣點'}
            </span>
            {settlement.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <button className="primary" onClick={() => setSettlement(null)}>
              確認結算資訊
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
