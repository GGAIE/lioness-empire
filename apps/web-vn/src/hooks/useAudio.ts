import { useEffect, useRef, useState } from 'react';
import type { Story } from '../../../../packages/narrative-core/schema';
import { assetUrl } from '../engine/load';
import { musicGain } from '../engine/music';
export type MusicStatus = 'stopped' | 'loading' | 'playing' | 'paused' | 'error';
export function useAudio(
  story: Story,
  bgm: string | undefined,
  sfx: string | undefined,
  segment: string,
  musicVolume: number,
  sfxVolume: number,
  selected: string,
  onError: (m: string) => void,
  suspended = false
) {
  const music = useRef<HTMLAudioElement | null>(null),
    effect = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false),
    wanted = useRef(false),
    generation = useRef(0),
    loadedTrack = useRef<string | undefined>(undefined),
    loopBoundary = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState<MusicStatus>('stopped'),
    [error, setError] = useState('');
  const track = suspended ? undefined : selected === 'story' ? bgm : selected;
  function fail(message: string) {
    wanted.current = false;
    music.current?.pause();
    setStatus('error');
    setError(message);
    onError(message);
  }
  function playTrack(id: string | undefined) {
    const a = music.current,
      request = ++generation.current;
    if (!a) return;
    const asset = suspended ? undefined : story.assets.find((x) => x.id === id && x.type === 'bgm');
    if (error) onError('');
    setError('');
    if (!asset) {
      a.pause();
      a.removeAttribute('src');
      a.load();
      loadedTrack.current = undefined;
      setStatus('stopped');
      return;
    }
    if (loadedTrack.current !== id) {
      loopBoundary.current = null;
      a.pause();
      a.src = assetUrl(asset.src);
      loadedTrack.current = id;
    }
    a.volume = Math.max(0, Math.min(1, musicVolume * musicGain(id)));
    setStatus('loading');
    // Called synchronously by the player's gesture, including on mobile browsers.
    void a
      .play()
      .then(() => {
        if (request === generation.current && wanted.current && enabledRef.current)
          setStatus('playing');
      })
      .catch((e: unknown) => {
        if (request !== generation.current) return;
        const denied = e instanceof DOMException && e.name === 'NotAllowedError';
        fail(
          denied
            ? '瀏覽器尚未允許播放，請按「播放背景音樂」重試。'
            : '背景音樂無法播放，請重新選曲或稍後重試。'
        );
      });
  }
  function play() {
    enabledRef.current = true;
    wanted.current = true;
    setEnabled(true);
    playTrack(track);
  }
  function select(id: string) {
    enabledRef.current = true;
    wanted.current = true;
    setEnabled(true);
    playTrack(id === 'story' ? bgm : id);
  }
  function pause() {
    wanted.current = false;
    loopBoundary.current = null;
    generation.current++;
    music.current?.pause();
    setStatus(loadedTrack.current ? 'paused' : 'stopped');
  }
  function stop() {
    pause();
    if (music.current) music.current.currentTime = 0;
    setStatus('stopped');
    setError('');
    if (error) onError('');
  }
  function toggle() {
    if (!enabledRef.current) {
      play();
      return;
    }
    enabledRef.current = false;
    setEnabled(false);
    pause();
    effect.current?.pause();
  }
  useEffect(() => {
    effect.current = new Audio();
    const a = music.current,
      fx = effect.current;
    return () => {
      generation.current++;
      a?.pause();
      fx.pause();
    };
  }, []);
  useEffect(() => {
    if (music.current)
      music.current.volume = Math.max(0, Math.min(1, musicVolume * musicGain(loadedTrack.current)));
  }, [musicVolume]);
  useEffect(() => {
    if (enabledRef.current && wanted.current && loadedTrack.current !== track) playTrack(track);
    // Playback intent is controlled by explicit gestures; paragraph changes never restart music.
  }, [track, story]);
  useEffect(() => {
    const a = effect.current,
      asset = story.assets.find((x) => x.id === sfx && x.type === 'sfx');
    if (!a || !asset || !enabled) return;
    a.src = assetUrl(asset.src);
    a.volume = sfxVolume;
    void a.play().catch(() => onError('音效無法播放，閱讀仍可繼續。'));
    return () => a.pause();
  }, [sfx, segment, enabled, story, sfxVolume, onError]);
  return {
    enabled,
    status,
    error,
    musicRef: music,
    play,
    pause,
    stop,
    select,
    toggle,
    mediaTimeUpdated: () => {
      const a = music.current;
      if (a?.loop && Number.isFinite(a.duration) && a.currentTime >= a.duration - 1.5)
        loopBoundary.current = performance.now();
    },
    mediaPaused: () => {
      const a = music.current;
      if (status === 'playing' && wanted.current && enabledRef.current && a?.paused && !a.error) {
        // WebKit can rewind a looping MP3 to exactly zero, then leave it paused.
        // Resume only that natural boundary; explicit controls clear wanted first.
        // Native pauses during ordinary playback remain pauses.
        if (
          a.loop &&
          a.currentTime === 0 &&
          loopBoundary.current !== null &&
          performance.now() - loopBoundary.current < 2000
        ) {
          loopBoundary.current = null;
          playTrack(loadedTrack.current);
          return;
        }
        wanted.current = false;
        generation.current++;
        setStatus('paused');
      }
    },
    mediaError: () => {
      if (!wanted.current || !enabledRef.current || !music.current?.error) return;
      generation.current++;
      fail('背景音樂載入失敗，請重新選曲或稍後重試。');
    },
  };
}
