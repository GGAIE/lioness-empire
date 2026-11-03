import { z } from 'zod';
import library from '../../../../content/covers/library.json' with { type: 'json' };
import type { GameState, Story } from '../../../../packages/narrative-core/schema';
import { resolveEnding, visibleSegments } from '../../../../packages/narrative-core/engine';
import type { Meta } from '../storage/saves';

export const CoverIdSchema = z.enum([
  'palace',
  'star-character',
  'star-abstract',
  'tower-character',
  'tower-abstract',
  'chariot-character',
  'chariot-abstract',
]);
export const covers = library;
export const CoverRouteSchema = z.enum(['STAR', 'TOWER', 'CHARIOT']);
export type CoverRoute = z.infer<typeof CoverRouteSchema>;
export const routeLabels = { STAR: '星星', TOWER: '高塔', CHARIOT: '戰車' };
export function coverRoute(id: string): CoverRoute | undefined {
  return ({ star: 'STAR', tower: 'TOWER', chariot: 'CHARIOT' } as const)[
    id.split('-')[0] as 'star' | 'tower' | 'chariot'
  ];
}
export function coverAvailable(id: string, meta: Meta) {
  if (!covers.some((c) => c.id === id)) return false;
  const route = coverRoute(id);
  return !route || !!meta.completedRoutes?.includes(route);
}
export function availableCover(id: string, meta: Meta) {
  return coverAvailable(id, meta) ? id : 'palace';
}
// Only the final caption of an awarded, official ending proves route completion.
// Chapter settlements, route selection, drafts and free reading do not count.
export function recordRouteCompletion(meta: Meta, state: GameState, story: Story): Meta {
  const scene = story.scenes[state.currentSceneId];
  if (
    !scene ||
    scene.kind !== 'end' ||
    scene.completion ||
    scene.status === 'DEMO_ONLY' ||
    state.currentSegmentIndex !== visibleSegments(story, state).length - 1 ||
    resolveEnding(state, story.endings).status !== 'RESOLVED'
  )
    return meta;
  const route = CoverRouteSchema.safeParse(state.tarotRoute);
  if (!route.success || meta.completedRoutes?.includes(route.data)) return meta;
  return { ...meta, completedRoutes: [...(meta.completedRoutes ?? []), route.data] };
}
export function coverFor(id: string) {
  return covers.find((cover) => cover.id === id) ?? covers[0];
}
