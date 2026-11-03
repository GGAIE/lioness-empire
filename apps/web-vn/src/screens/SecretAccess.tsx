import { useState } from 'react';

export function SecretAccess({
  unlocked,
  onUnlock,
  onLock,
}: {
  unlocked: boolean;
  onUnlock: (password: string) => boolean;
  onLock: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="story-access secret-access">
      {unlocked ? (
        <>
          <p role="status">自由閱讀已開啟，可直接選讀目前已提供的小節。切換章節不扣點。</p>
          <button onClick={onLock}>恢復順序閱讀</button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const ok = onUnlock(password);
            setPassword('');
            setError(ok ? '' : '密碼不正確，請重新輸入。');
          }}
        >
          <label htmlFor="story-access-password">劇情密碼</label>
          <input
            autoFocus
            id="story-access-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
          <button type="submit">解鎖劇情</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
