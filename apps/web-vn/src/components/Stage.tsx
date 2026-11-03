import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Story, GameState } from '../../../../packages/narrative-core/schema';
import {
  currentCg,
  visibleChoices,
  visibleSegments,
  nextSceneId,
} from '../../../../packages/narrative-core/engine';
import { assetUrl } from '../engine/load';
export function Stage({
  story,
  state,
  onLoaded,
  active = true,
}: {
  story: Story;
  state: GameState;
  onLoaded: (id: string) => void;
  active?: boolean;
}) {
  const scene = story.scenes[state.currentSceneId],
    id = currentCg(story, state),
    asset = story.assets.find((a) => a.id === id),
    [failed, setFailed] = useState('');
  const loaded = useRef<{ id: string; src: string } | null>(null),
    [outgoing, setOutgoing] = useState<{ id: string; src: string } | null>(null);
  useEffect(() => {
    if (!outgoing) return;
    const t = setTimeout(() => setOutgoing(null), scene.presentation?.fadeMs ?? 600);
    return () => clearTimeout(t);
  }, [outgoing, scene.presentation?.fadeMs]);
  useEffect(() => {
    const next = [
      nextSceneId(story, state),
      ...visibleChoices(story, state).map((c) => c.next),
    ].filter(Boolean) as string[];
    const nextSegmentCg = visibleSegments(story, state)
      .slice(state.currentSegmentIndex + 1)
      .find((segment) => segment.cg)?.cg;
    const upcoming = new Set([nextSegmentCg, ...next.map((n) => story.scenes[n]?.cg)]);
    for (const cg of upcoming) {
      const a = story.assets.find((x) => x.id === cg);
      if (a) {
        const img = new Image();
        img.src = assetUrl(a.src);
      }
    }
  }, [scene.id, state.currentSegmentIndex, story]);
  const p = scene.presentation;
  const black = visibleSegments(story, state)[state.currentSegmentIndex]?.visual === 'BLACK';
  useEffect(() => {
    if (black && !id) {
      loaded.current = null;
      setOutgoing(null);
    }
  }, [black, id]);
  useEffect(() => {
    if (active && !black && loaded.current?.id === id && id) onLoaded(id);
  }, [active, black, id, onLoaded]);
  return (
    <div
      className={`stage${black ? ' stage-black' : ''}`}
      aria-label="場景 CG"
      style={
        {
          '--fade': `${p?.fadeMs ?? 600}ms`,
          '--zoom': p?.zoom ?? 1,
          '--pan': `${p?.panX ?? 0}%`,
        } as CSSProperties
      }
    >
      {outgoing && outgoing.id !== id && (
        <img className="outgoing-cg" src={assetUrl(outgoing.src)} alt="" aria-hidden="true" />
      )}
      {asset && (asset.status === 'APPROVED' || scene.status === 'DEMO_ONLY') && failed !== id ? (
        <img
          key={id}
          data-testid="scene-cg"
          src={assetUrl(asset.src)}
          alt={asset.label}
          onLoad={() => {
            if (loaded.current?.id !== asset.id) {
              setOutgoing(loaded.current);
              loaded.current = { id: asset.id, src: asset.src };
            }
            if (active && !black) onLoaded(asset.id);
          }}
          onError={() => {
            setFailed(id ?? '');
            setOutgoing(null);
            loaded.current = null;
          }}
          style={{
            objectFit: p?.fit ?? 'cover',
            objectPosition: `${p?.focusX ?? 50}% ${p?.focusY ?? 50}%`,
          }}
        />
      ) : black ? null : (
        <div className="missing">
          {asset?.status === 'PLACEHOLDER'
            ? '此張插圖待補'
            : id
              ? '素材尚未就緒 · ' + id
              : '這一幕尚未配置 CG'}
          <small>你仍然可以繼續閱讀</small>
        </div>
      )}
      <div className="stage-shade" />
      <div className="stage-blackout" />
    </div>
  );
}
