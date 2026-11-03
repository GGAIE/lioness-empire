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
  if (mode === 'endings')
    return (
      <>
        <p className="muted">二十二個正位、八個逆位，記錄你走過的不同歷史。</p>
        <div className="ending-grid">
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
      <div className="gallery-grid">
        {story.assets
          .filter(
            (a) =>
              a.type === 'cg' &&
              Object.values(story.scenes).some(
                (s) =>
                  s.status !== 'DEMO_ONLY' &&
                  (s.cg === a.id || s.segments.some((p) => p.cg === a.id))
              )
          )
          .map((a) => (
            <article key={a.id}>
              {meta.cg.includes(a.id) ? (
                <a href={assetUrl(a.src)} target="_blank" rel="noreferrer">
                  <img src={assetUrl(a.src)} alt={a.label} />
                </a>
              ) : (
                <div className="locked-image">
                  ◇<span>尚未解鎖</span>
                </div>
              )}
              <h3>{meta.cg.includes(a.id) ? a.label : '未知的場景'}</h3>
            </article>
          ))}
      </div>
    </>
  );
}
