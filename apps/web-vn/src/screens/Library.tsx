import { useMemo, useState } from 'react';
import { galleryEntries, galleryActTitle, type GalleryRoute } from '../engine/gallery';
import type { Story } from '../../../../packages/narrative-core/schema';
import type { Meta } from '../storage/saves';
import { assetUrl } from '../engine/load';
export function Library({
  story,
  meta,
  mode,
}: {
  story: Story;
  meta: Meta;
  mode: 'gallery' | 'endings';
}) {
  const [chapter, setChapter] = useState('ALL');
  const [act, setAct] = useState('ALL');
  const [route, setRoute] = useState<GalleryRoute | 'ALL'>('ALL');
  const [collection, setCollection] = useState('ALL');
  const [page, setPage] = useState(0);
  const entries = useMemo(() => galleryEntries(story), [story]);
  const unlocked = new Set(meta.cg);
  const chapters = story.manifest.chapters.filter((ch) =>
    entries.some((e) => e.locations.some((l) => l.chapter === ch.id))
  );
  const acts = [
    ...new Set(
      entries.flatMap((e) => e.locations.filter((l) => l.chapter === chapter).map((l) => l.act))
    ),
  ].sort();
  const filtered = entries.filter(
    (e) =>
      e.locations.some(
        (l) =>
          (chapter === 'ALL' || l.chapter === chapter) &&
          (act === 'ALL' || l.act === act) &&
          (route === 'ALL' || l.route === route)
      ) &&
      (collection === 'ALL' || unlocked.has(e.asset.id) === (collection === 'UNLOCKED'))
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pageCount - 1);
  const reset = () => {
    setChapter('ALL');
    setAct('ALL');
    setRoute('ALL');
    setCollection('ALL');
    setPage(0);
  };
  if (mode === 'endings')
    return (
      <>
        <p className="muted">二十二個正位、八個逆位，記錄你走過的不同歷史。</p>
        <div className="ending-grid">
          {meta.specialEndings?.includes('RETURN_TO_TITLE') && (
            <article className="ending">
              <span>特殊結局</span>
              <h3>回主畫面</h3>
              <small>已記錄的片刻</small>
            </article>
          )}
          {[...story.endings]
            .sort((a, b) =>
              a.orientation === b.orientation
                ? a.id.localeCompare(b.id)
                : a.orientation === 'UPRIGHT'
                  ? -1
                  : 1
            )
            .map((r) => {
              const unlocked = meta.endings.includes(r.id) && r.status === 'APPROVED';
              return (
                <article className={`ending${unlocked ? '' : ' locked'}`} key={r.id}>
                  <span>
                    {r.orientation === 'UPRIGHT' ? `正位 · ${r.id.replace('ARCANA_', '')}` : '逆位'}
                  </span>
                  <h3>{unlocked ? r.title : '尚未解鎖'}</h3>
                  <small>
                    {unlocked
                      ? '已記錄的歷史'
                      : r.status === 'APPROVED'
                        ? '等待你的選擇'
                        : '尚未解鎖'}
                  </small>
                </article>
              );
            })}
        </div>
      </>
    );
  return (
    <>
      <p className="muted">
        閱讀中欣賞過的插圖會收錄於此。收藏會隨你的旅程累積，並保留在不同存檔之間。
      </p>
      <div className="gallery-filters" role="group" aria-label="CG 分類選單">
        <label>
          章節
          <select
            aria-label="章節"
            value={chapter}
            onChange={(e) => {
              setChapter(e.target.value);
              setAct('ALL');
              setPage(0);
            }}
          >
            <option value="ALL">全部章節</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.id === 'PROLOGUE' ? ch.title : `${ch.id} · ${ch.title}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          幕
          <select
            aria-label="幕"
            value={act}
            disabled={chapter === 'ALL'}
            onChange={(e) => {
              setAct(e.target.value);
              setPage(0);
            }}
          >
            <option value="ALL">全部幕</option>
            {acts.map((id) => (
              <option key={id} value={id}>
                {galleryActTitle(
                  chapter,
                  id,
                  route,
                  Object.values(story.scenes).some(
                    (s) => s.chapter === chapter && s.act === id && s.interlude
                  )
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          路線
          <select
            aria-label="路線"
            value={route}
            onChange={(e) => {
              setRoute(e.target.value as GalleryRoute | 'ALL');
              setPage(0);
            }}
          >
            <option value="ALL">全部路線</option>
            <option value="COMMON">共同篇章</option>
            <option value="SACRED">神聖線</option>
            <option value="WORLD">世界線</option>
          </select>
        </label>
        <label>
          收藏狀態
          <select
            aria-label="收藏狀態"
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value);
              setPage(0);
            }}
          >
            <option value="ALL">全部圖片</option>
            <option value="UNLOCKED">已解鎖</option>
            <option value="LOCKED">未解鎖</option>
          </select>
        </label>
        <button onClick={reset}>重設分類</button>
      </div>
      <p className="muted" role="status">
        共 {filtered.length} 張 · 已解鎖 {filtered.filter((e) => unlocked.has(e.asset.id)).length}{' '}
        張
      </p>
      {filtered.length === 0 && <p className="gallery-empty">此分類目前沒有符合條件的 CG。</p>}
      <div className="gallery-grid">
        {filtered.slice(currentPage * 24, (currentPage + 1) * 24).map(({ asset: a }) => (
          <article key={a.id}>
            {unlocked.has(a.id) ? (
              <a href={assetUrl(a.src)} target="_blank" rel="noreferrer">
                <img src={assetUrl(a.src)} alt={a.label} loading="lazy" />
              </a>
            ) : (
              <div className="locked-image">
                ◇<span>尚未解鎖</span>
              </div>
            )}
            <h3>{unlocked.has(a.id) ? a.label : '未知的場景'}</h3>
          </article>
        ))}
      </div>
      {pageCount > 1 && (
        <nav className="gallery-pagination" aria-label="CG 分頁">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            上一頁
          </button>
          <span aria-live="polite">
            第 {currentPage + 1} / {pageCount} 頁
          </span>
          <button disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            下一頁
          </button>
        </nav>
      )}
    </>
  );
}
