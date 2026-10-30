import { useState } from 'react';
import type { SaveRecord } from '../storage/saves';
export function SaveSlots({
  records,
  onSave,
  onLoad,
  onExport,
  onImport,
}: {
  records: SaveRecord[];
  onSave: (id: string) => Promise<void>;
  onLoad: (r: SaveRecord) => void;
  onExport: (r: SaveRecord) => void;
  onImport: (file: File) => void;
}) {
  const [overwrite, setOverwrite] = useState('');
  return (
    <>
      <div className="save-intro">
        <p className="muted">存檔保存在這個瀏覽器。更換裝置前可匯出備份。</p>
        <label className="file-button">
          匯入存檔
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <div className="save-grid">
        {['auto', '1', '2', '3', '4', '5', '6'].map((id) => {
          const r = records.find((r) => r.slot === id);
          return (
            <article className="save-card" key={id}>
              {r?.thumbnail ? (
                <img src={r.thumbnail} alt="存檔場景縮圖" />
              ) : (
                <div className="save-placeholder">◇</div>
              )}
              <h3>{id === 'auto' ? '自動存檔' : `存檔 ${id.padStart(2, '0')}`}</h3>
              <p>{r?.title ?? '尚無記錄'}</p>
              <small>{r ? new Date(r.savedAt).toLocaleString('zh-TW') : '—'}</small>
              <div className="button-row">
                {id !== 'auto' && (
                  <button
                    onClick={() => {
                      if (r) setOverwrite(id);
                      else void onSave(id);
                    }}
                  >
                    儲存
                  </button>
                )}
                <button disabled={!r} onClick={() => r && onLoad(r)}>
                  讀取
                </button>
                <button disabled={!r} onClick={() => r && onExport(r)}>
                  匯出
                </button>
              </div>
              {overwrite === id && (
                <div className="confirmation">
                  <p>以目前進度覆寫這個存檔？</p>
                  <button
                    onClick={() => {
                      void onSave(id);
                      setOverwrite('');
                    }}
                  >
                    確認覆寫
                  </button>
                  <button onClick={() => setOverwrite('')}>取消</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {records.some((r) => r.slot.startsWith('backup-')) && (
        <div className="backup-list">
          <h3>切換與遷移前的備份</h3>
          {records
            .filter((r) => r.slot.startsWith('backup-'))
            .map((r) => (
              <p key={r.slot}>
                {r.title} <button onClick={() => onLoad(r)}>讀取</button>{' '}
                <button onClick={() => onExport(r)}>匯出原始資料</button>
              </p>
            ))}
        </div>
      )}
    </>
  );
}
