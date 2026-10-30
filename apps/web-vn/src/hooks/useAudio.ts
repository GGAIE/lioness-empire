import { useEffect, useRef, useState } from 'react';
import type { Story } from '../../../../packages/narrative-core/schema';
import { assetUrl } from '../engine/load';
export function useAudio(
  story: Story,
  bgm: string | undefined,
  sfx: string | undefined,
  segment: string,
  musicVolume: number,
  sfxVolume: number,
  onError: (m: string) => void
) {
  const music = useRef<HTMLAudioElement | null>(null),
    effect = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    music.current = new Audio();
    music.current.loop = true;
    effect.current = new Audio();
    return () => {
      music.current?.pause();
      effect.current?.pause();
    };
  }, []);
  useEffect(() => {
    const a = music.current;
    if (!a) return;
    a.volume = musicVolume;
  }, [musicVolume]);
  useEffect(() => {
    const a = music.current;
    if (!a) return;
    const asset = story.assets.find((x) => x.id === bgm && x.type === 'bgm');
    a.pause();
    if (!asset || !enabled) return;
    a.src = assetUrl(asset.src);
    a.volume = musicVolume;
    void a.play().catch(() => {
      setEnabled(false);
      onError('配樂未能播放，請點擊「開啟聲音」重試。');
    });
    return () => a.pause();
  }, [bgm, enabled, story]);
  useEffect(() => {
    const a = effect.current,
      asset = story.assets.find((x) => x.id === sfx && x.type === 'sfx');
    if (!a || !asset || !enabled) return;
    a.src = assetUrl(asset.src);
    a.volume = sfxVolume;
    void a.play().catch(() => onError('測試音效無法播放，閱讀仍可繼續。'));
    return () => a.pause();
  }, [sfx, segment, enabled, story]);
  return { enabled, toggle: () => setEnabled((v) => !v) };
}
