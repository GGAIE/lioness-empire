import { musicDuration, musicTracks } from '../engine/music';
import type { useAudio } from '../hooks/useAudio';
export function Music({
  selected,
  volume,
  onSelect,
  onVolume,
  audio,
  storyTitle,
}: {
  selected: string;
  volume: number;
  onSelect: (id: string) => void;
  onVolume: (value: number) => void;
  audio: ReturnType<typeof useAudio>;
  storyTitle?: string;
}) {
  const track = musicTracks.find((t) => t.id === selected);
  const title = selected === 'story' ? storyTitle : track?.title;
  const statuses = {
    stopped: '已停止',
    loading: '載入中',
    playing: '播放中',
    paused: '已暫停',
    error: '無法播放',
  };
  return (
    <section className="music-player" aria-label="背景音樂播放器">
      <p>選一首陪伴閱讀。每首循環播放，手動選曲會持續到你更換或停止。</p>
      <label className="music-select">
        選擇背景音樂
        <select value={track ? selected : 'story'} onChange={(e) => onSelect(e.target.value)}>
          <option value="story">依劇情配樂</option>
          {musicTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {musicDuration(t.durationSeconds)}
            </option>
          ))}
        </select>
      </label>
      <div className="music-now">
        <span>目前曲目</span>
        <h3>{title ?? (selected === 'story' ? '此場景尚無指定配樂' : '請重新選擇曲目')}</h3>
        <p role="status" aria-label="背景音樂播放狀態">
          {audio.error || statuses[audio.status]}
        </p>
        {track && (
          <small>
            {musicDuration(track.durationSeconds)} ·{' '}
            {track.loudnessRangeLu >= 8 ? '音量起伏較多' : '音量較平穩'} · 循環播放
          </small>
        )}
      </div>
      <div className="music-actions">
        <button
          onClick={audio.play}
          disabled={!title || audio.status === 'playing' || audio.status === 'loading'}
        >
          播放背景音樂
        </button>
        <button
          onClick={audio.pause}
          disabled={audio.status !== 'playing' && audio.status !== 'loading'}
        >
          暫停背景音樂
        </button>
        <button onClick={audio.stop} disabled={!title}>
          停止背景音樂
        </button>
      </div>
      <label className="music-volume" htmlFor="music-volume">
        背景音樂音量 <output>{Math.round(volume * 100)}%</output>
        <input
          id="music-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </label>
      <p className="music-note">
        各曲播放音量已平衡。曲目與音量會記住；重新開啟遊戲後，按播放才會出聲。
      </p>
    </section>
  );
}
