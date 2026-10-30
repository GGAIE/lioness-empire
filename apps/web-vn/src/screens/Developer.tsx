import { useState } from 'react';
import {
  StateSchema,
  type GameState,
  type Story,
} from '../../../../packages/narrative-core/schema';
import { resolveEnding } from '../../../../packages/narrative-core/engine';
export default function Developer({
  story,
  state,
  jump,
}: {
  story: Story;
  state: GameState;
  jump: (id: string) => void;
}) {
  const [sandbox, setSandbox] = useState(JSON.stringify(state, null, 2)),
    [result, setResult] = useState('');
  return (
    <div className="developer">
      <p>僅開發模式提供。正式結局仍為草案；下方測試不改變玩家狀態。</p>
      <label>
        場景跳轉
        <select
          aria-label="開發場景跳轉"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) jump(e.target.value);
          }}
        >
          <option value="" disabled>
            選擇場景
          </option>
          {Object.values(story.scenes).map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.title}
            </option>
          ))}
        </select>
      </label>
      <h3>目前旗標與完成度</h3>
      <pre>
        {JSON.stringify(
          {
            politicalRoute: state.politicalRoute,
            tarotRoute: state.tarotRoute,
            politicalScore: state.politicalScore,
            clear: state.clear,
            flags: state.flags,
            decisionLog: state.decisionLog,
          },
          null,
          2
        )}
      </pre>
      <h3>結局規則沙盒</h3>
      <button onClick={() => setSandbox(JSON.stringify(state, null, 2))}>複製目前狀態至沙盒</button>
      <textarea
        aria-label="結局測試狀態"
        value={sandbox}
        onChange={(e) => setSandbox(e.target.value)}
        rows={12}
      />
      <button
        onClick={() => {
          try {
            setResult(
              JSON.stringify(
                resolveEnding(StateSchema.parse(JSON.parse(sandbox)), story.endings),
                null,
                2
              )
            );
          } catch (e) {
            setResult(String(e));
          }
        }}
      >
        測試 Canon 草案判定
      </button>
      <pre>{result || '可修改沙盒中的路線、CLEAR 與旗標，再測試。'}</pre>
    </div>
  );
}
