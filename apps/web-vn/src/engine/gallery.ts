import type { Condition, Story } from '../../../../packages/narrative-core/schema';
import { actName } from '../../../../packages/narrative-core/directory';
import actTitles from '../../../../packages/narrative-core/act-titles.json';

export type GalleryRoute = 'COMMON' | 'SACRED' | 'WORLD';
const routes = ['SACRED', 'WORLD'] as const;

// Other flags describe variants within a route, not separate gallery categories.
function possibleRoutes(condition?: Condition): Set<string> {
  if (!condition) return new Set(routes);
  if ('all' in condition) {
    return condition.all.reduce((result, c) => {
      const next = possibleRoutes(c);
      return new Set([...result].filter((r) => next.has(r)));
    }, new Set<string>(routes));
  }
  if ('any' in condition) return new Set(condition.any.flatMap((c) => [...possibleRoutes(c)]));
  if ('not' in condition) {
    if ('path' in condition.not && condition.not.path === 'politicalRoute')
      return new Set(routes.filter((r) => !possibleRoutes(condition.not).has(r)));
    return new Set(routes);
  }
  if (condition.path !== 'politicalRoute') return new Set(routes);
  if (condition.op === 'eq') return new Set(routes.filter((r) => r === condition.value));
  if (condition.op === 'ne') return new Set(routes.filter((r) => r !== condition.value));
  return new Set(routes);
}

export function galleryEntries(story: Story) {
  const locations = new Map<string, { chapter: string; act: string; route: GalleryRoute }[]>();
  for (const scene of Object.values(story.scenes)) {
    if (scene.status === 'DEMO_ONLY') continue;
    const permitted = possibleRoutes(scene.availableWhen);
    const route: GalleryRoute =
      permitted.size === 1 ? ([...permitted][0] as GalleryRoute) : 'COMMON';
    const ids = new Set([
      scene.cg,
      ...scene.segments.map((s) => s.cg),
      ...(scene.cgWhen ?? []).map((c) => c.cg),
    ]);
    for (const id of ids) {
      if (!id) continue;
      const tags = locations.get(id) ?? [];
      if (
        !tags.some((l) => l.chapter === scene.chapter && l.act === scene.act && l.route === route)
      )
        tags.push({ chapter: scene.chapter, act: scene.act, route });
      locations.set(id, tags);
    }
  }
  return story.assets
    .filter((a) => a.type === 'cg' && locations.has(a.id))
    .map((asset) => ({ asset, locations: locations.get(asset.id)! }));
}

export function galleryActTitle(
  chapter: string,
  act: string,
  route: GalleryRoute | 'ALL',
  interlude = false
) {
  const titles = actTitles as Record<string, string>;
  const title = titles[`${chapter}_${act}_${route}`] ?? titles[`${chapter}_${act}`];
  const number = Number(act.replace('ACT', ''));
  return `${interlude ? '幕間' : actName(number)}${title ? ` · ${title}` : ''}`;
}
