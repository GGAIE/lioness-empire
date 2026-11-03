import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Story } from '../../../packages/narrative-core/schema';
import {
  advance,
  continueChapter,
  choose,
  choiceUnavailableReason,
  currentCg,
  initialState,
  markRead,
  resolveEnding,
  segmentKey,
  visibleChoices,
  visibleSegments,
} from '../../../packages/narrative-core/engine';
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
import { SecretAccess } from './screens/SecretAccess';
import {
  actName,
  continueCommittedChoice,
  openDirectorySection,
  matchesStoryPassword,
} from '../../../packages/narrative-core/directory';
import { SaveSlots } from './screens/SaveSlots';
import { ResourceHud } from './components/ResourceHud';
import { Music } from './screens/Music';
import {
  chapterEndNotice,
  chapterStartNotice,
  type SettlementNotice,
} from '../../../packages/narrative-core/settlement';
type Panel =
  | 'saves'
  | 'history'
  | 'gallery'
  | 'endings'
  | 'chapters'
  | 'settings'
  | 'music'
  | 'restart'
  | 'access'
  | null;
function playerEndNotice(story: Story, state: GameState, unlocked = false): SettlementNotice {
  if (unlocked)
    return {
      phase: 'CHAPTER_END',
      title: '章末閱讀提醒',
      severity: 'INFO',
      lines: ['自由閱讀已開啟，可接續已提供的章節，切換章節不扣點。'],
    };
  const notice = chapterEndNotice(story.plan!, state.campaign!);
  const chapter = story.manifest.chapters.find(
    (c) => c.id === story.scenes[state.currentSceneId].chapter
  );
  if (chapter) notice.lines[0] = `本章：${chapter.id} ${chapter.title.replace(/ · ACT.*$/, '')}`;
  return notice;
}
export default function App() {
  const [loaded, setLoaded] = useState<{
      story: Story;
      meta: Meta;
      settings: Settings;
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
      if (active) setLoaded({ story, meta, settings });
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
  startupMessage,
}: {
  story: Story;
  meta: Meta;
  settings: Settings;
  startupMessage: string;
}) {
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
  const settlementShown = useRef('');
  useEffect(() => {
    if (
      !started ||
      !last ||
      !writer.complete ||
      scene.completion?.scope !== 'CHAPTER' ||
      scene.chapter === 'PROLOGUE' ||
      !story.plan ||
      !state.campaign ||
      settlementShown.current === key
    )
      return;
    settlementShown.current = key;
    setSettlement(playerEndNotice(story, state, settings.storyUnlocked));
  }, [
    started,
    last,
    writer.complete,
    scene.completion,
    scene.chapter,
    key,
    story,
    state.campaign,
    settings.storyUnlocked,
  ]);
  const hud = (
    <ResourceHud
      plan={story.plan}
      unlocked={settings.storyUnlocked}
      state={state.campaign ?? null}
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
    settings.musicTrack,
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
    if (
      !current.readSegments.includes(segmentKey(story, current)) ||
      JSON.stringify(current.flags) !== JSON.stringify(marked.flags) ||
      current.campaign?.politicalPoints !== marked.campaign?.politicalPoints ||
      current.readChapters.length !== marked.readChapters.length
    )
      setState(marked);
    setMeta((m) => {
      const ending =
        scene.kind === 'end' && !scene.completion ? resolveEnding(marked, story.endings) : null;
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
  }, [started, writer.complete, key, scene.kind, story]);
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
      if (story.scenes[restored.state.currentSceneId]?.status === 'DEMO_ONLY')
        throw Error('此舊版內容已停止開放。原存檔仍可匯出備份。');
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
      const next = openDirectorySection(
        story,
        started ? snapshot : initialState(story),
        id,
        settings.storyUnlocked
      );
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
      if (snapshot.campaign && next.campaign) {
        const notice = chapterStartNotice(snapshot.campaign, next.campaign);
        if (notice) setSettlement(notice);
      }
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
      if (story.scenes[imported.state.currentSceneId]?.status === 'DEMO_ONLY')
        throw Error('此舊版內容已停止開放。原始存檔不會變更。');
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
  async function startNewGame() {
    if (directoryBusy) return;
    setDirectoryBusy(true);
    try {
      const previous = records.find((r) => r.slot === 'auto');
      if (previous) await backupSave(previous);
      await refreshSaves();
      applyLoaded(initialState(story));
      notify('');
    } catch {
      notify('未能備份目前進度，尚未開始新的遊戲。');
    } finally {
      setDirectoryBusy(false);
    }
  }
  async function returnToTitle() {
    if (directoryBusy) return;
    setDirectoryBusy(true);
    setAuto(false);
    setSkip(false);
    try {
      loadGeneration.current++;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      const snapshot = stateRef.current;
      await saveGame({
        slot: 'auto',
        savedAt: new Date().toISOString(),
        title: story.scenes[snapshot.currentSceneId].title,
        thumbnail: await thumbnail(snapshot),
        state: snapshot,
      });
      await refreshSaves();
      setPanel(null);
      setStarted(false);
      setSettlement(null);
      notify('');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      notify('進度未能保存，請稍後再返回標題。');
    } finally {
      setDirectoryBusy(false);
    }
  }
  const labels: Record<Exclude<Panel, null>, string> = {
    saves: '存讀進度',
    history: '對話回顧',
    gallery: 'CG 鑑賞室',
    endings: '命運圖鑑',
    chapters: '章節目錄',
    settings: '閱讀設定',
    music: '背景音樂',
    restart: '重新開始',
    access: '其他選項',
  };
  const controls = [
    ['saves', '存讀檔'],
    ['history', '回顧'],
    ['gallery', '鑑賞'],
    ['endings', '結局'],
    ['chapters', '章節'],
    ['music', '背景音樂'],
    ['settings', '設定'],
  ] as const;
  return (
    <main className={`shell${started ? '' : ' shell--title'}`}>
      <audio
        ref={audio.musicRef}
        data-testid="background-music"
        loop
        preload="none"
        onPause={audio.mediaPaused}
        onTimeUpdate={audio.mediaTimeUpdated}
        onError={audio.mediaError}
      />
      <header className="masthead">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (started) void returnToTitle();
          }}
        >
          <span className="brand-mark">♜</span>
          <span>
            母獅帝國<small>LIONESS EMPIRE</small>
          </span>
        </a>
        <div className="edition">
          <i /> A POLITICAL FANTASY
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
              <nav className="title-actions" aria-label="主選單">
                <button
                  className={records.some((r) => r.slot === 'auto') ? 'primary' : undefined}
                  disabled={!records.some((r) => r.slot === 'auto') || directoryBusy}
                  onClick={() => {
                    const r = records.find((r) => r.slot === 'auto');
                    if (r) requestLoad(r);
                  }}
                >
                  繼續遊戲
                </button>
                <button
                  className={records.some((r) => r.slot === 'auto') ? undefined : 'primary'}
                  disabled={directoryBusy}
                  onClick={() => {
                    if (records.some((r) => r.slot === 'auto')) open('restart');
                    else void startNewGame();
                  }}
                >
                  開始遊戲
                </button>
                <button onClick={() => open('saves')}>存讀檔</button>
                <button aria-label="章節目錄" onClick={() => open('chapters')}>
                  章節目錄
                </button>
                <button onClick={() => open('gallery')}>鑑賞</button>
                <button onClick={() => open('endings')}>結局</button>
                <button onClick={() => open('music')}>背景音樂</button>
                <button onClick={() => open('settings')}>設定</button>
              </nav>
            </div>
          ) : (
            <>
              <div className="scene-heading">
                <div>
                  <span>
                    {scene.status === 'DEMO_ONLY'
                      ? 'DEMO ONLY'
                      : `${scene.chapter === 'PROLOGUE' ? '序幕' : `${scene.chapter} · ${actLabel}`} · ${scene.playback === 'CUTSCENE' ? '無選項過場' : scene.kind === 'choice' ? (scene.choiceMode === 'DIALOGUE_FLAVOR' ? '對話回應' : '劇情抉擇') : '劇情進行中'}`}{' '}
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
                      <button
                        key={c.id}
                        disabled={!!choiceUnavailableReason(state, c)}
                        onClick={() => select(c.id)}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {c.text}
                        {choiceUnavailableReason(state, c) && (
                          <small>{choiceUnavailableReason(state, c)}</small>
                        )}
                        <b>↗</b>
                      </button>
                    ))
                  )}
                </div>
              )}
              {scene.completion && last && writer.complete && (
                <section
                  className={`chapter-complete${segment.kind === 'caption' ? ' with-caption' : ''}${scene.completion.scope === 'CHAPTER' ? ' chapter-complete--chapter' : ''}`}
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
                      : (scene.completion.pendingLabel?.replace('劇本尚未提供', '敬請期待') ??
                        `${scene.completion.nextChapterId} · 敬請期待`)}
                  </p>
                  {scene.completion.nextSceneId && (
                    <button
                      className="primary"
                      onClick={() => {
                        setAuto(false);
                        setSkip(false);
                        try {
                          const before = stateRef.current;
                          const next = continueChapter(story, before, settings.storyUnlocked);
                          setState(next);
                          if (before.campaign && next.campaign) {
                            const notice = chapterStartNotice(before.campaign, next.campaign);
                            if (notice) setSettlement(notice);
                          }
                        } catch (e) {
                          notify(String(e));
                        }
                      }}
                    >
                      {continueLabel} →
                    </button>
                  )}
                  <small>
                    政治點數 {state.campaign?.politicalPoints ?? '待設定'} · 動盪{' '}
                    {state.campaign?.unrest ?? '待設定'} ·{' '}
                    {settings.storyUnlocked
                      ? '自由閱讀已開啟；切換章節不扣點'
                      : scene.completion.scope === 'ACT'
                        ? '數值依已選劇情更新；整章尚未結算'
                        : scene.chapter === 'PROLOGUE'
                          ? '序幕不計分、不扣點'
                          : '數值依劇情選擇更新；章末僅預告，不提前扣章初費'}
                  </small>
                  {scene.completion.scope === 'CHAPTER' &&
                    scene.chapter !== 'PROLOGUE' &&
                    story.plan &&
                    state.campaign && (
                      <button
                        onClick={() =>
                          setSettlement(playerEndNotice(story, state, settings.storyUnlocked))
                        }
                      >
                        查看章末結算提醒
                      </button>
                    )}
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
                          : (scene.completion.pendingLabel?.replace('劇本尚未提供', '敬請期待') ??
                            '待續')
                        : '故事告一段落'
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
          <span>{scene.chapter.startsWith('EP') ? scene.chapter.slice(2) : '00'}</span>
          <div />
          <span>
            {['序', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][
              Number(scene.chapter.replace('EP', ''))
            ] ?? '序'}
          </span>
        </aside>
      </div>
      {started && (
        <nav className="toolbar" aria-label="遊戲選單">
          <span className="session-label">{started ? 'READING SESSION' : 'YOUR STORY AWAITS'}</span>
          <div>
            {controls.map(([p, label]) => (
              <button key={p} onClick={() => open(p)}>
                {label}
              </button>
            ))}
            <button disabled={directoryBusy} onClick={() => void returnToTitle()}>
              返回標題
            </button>
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
      )}
      <footer className="page-footer">
        <span>
          LIONESS EMPIRE <i>／</i> 王冠之下，歷史尚未寫定。
        </span>
        <button className="secret-trigger" aria-label="其他選項" onClick={() => open('access')}>
          ✧
        </button>
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
                  notify('請先開始遊戲。');
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
                    <small>{story.scenes[h.sceneId]?.title ?? '往事'}</small>
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
              unlocked={settings.storyUnlocked}
              onRead={(id, current) => void readSection(id, current)}
            />
          )}
          {panel === 'access' && (
            <SecretAccess
              unlocked={settings.storyUnlocked}
              onUnlock={(password) => {
                if (!matchesStoryPassword(password)) return false;
                setSettings((s) => ({ ...s, storyUnlocked: true }));
                return true;
              }}
              onLock={() => setSettings((s) => ({ ...s, storyUnlocked: false }))}
            />
          )}
          {(panel === 'gallery' || panel === 'endings') && (
            <Library story={story} meta={meta} mode={panel} />
          )}
          {panel === 'music' && (
            <Music
              selected={settings.musicTrack}
              volume={settings.bgm}
              onSelect={(id) => {
                audio.select(id);
                setSettings((s) => ({ ...s, musicTrack: id }));
              }}
              onVolume={(bgm) => setSettings((s) => ({ ...s, bgm }))}
              audio={audio}
              storyTitle={
                started
                  ? story.assets.find((a) => a.type === 'bgm' && a.id === scene.bgm)?.label
                  : undefined
              }
            />
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
              <p>開始新的遊戲？目前的自動存檔會先備份，手動存檔與收藏會保留。</p>
              <button
                className="primary"
                disabled={directoryBusy}
                onClick={() => void startNewGame()}
              >
                確認開始
              </button>
            </>
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
