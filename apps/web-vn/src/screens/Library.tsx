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
        <p className="muted">二十二個正位、八個逆位，記錄不同歷史的終點。測試結局獨立收藏。</p>
        {meta.endings.includes('DEMO_COMPLETE') && (
          <article className="ending">
            <span>DEMO ONLY</span>
            <h3>測試的終點</h3>
            <p>分支流程測試完成</p>
          </article>
        )}
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
                        : '尚待正式開放'}
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
        成功顯示過的 CG 會加入收藏；收藏與個別存檔分開保存。序幕 8 張、EP01 第一幕 11 張、第二幕 20
        張，皆使用提供的原圖，另保留引擎測試素材。
      </p>
      <div className="gallery-grid">
        {story.assets
          .filter((a) => a.type === 'cg')
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
