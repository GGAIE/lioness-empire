import type { Story, Condition, GameState } from '../packages/narrative-core/schema';
// Keep only values that can still affect executable story flow. Saved player state stays intact.
export function explorationKey(story: Story) {
  const live = new Map<string, Set<string>>(),
    reachable = new Map<string, Set<string>>(),
    resources = new Map<string, Set<string>>();
  const refs = (c: Condition, set: Set<string>) => {
    if ('all' in c) c.all.forEach((x) => refs(x, set));
    else if ('any' in c) c.any.forEach((x) => refs(x, set));
    else if ('not' in c) refs(c.not, set);
    else if (c.path.startsWith('flags.')) set.add(c.path.slice(6));
  };
  const edges = new Map<string, string[]>();
  for (const scene of Object.values(story.scenes)) {
    const set = new Set<string>();
    for (const c of [
      scene.availableWhen,
      scene.imageWhen,
      scene.conditionalNext?.when,
      scene.completionEffects?.when,
      ...scene.segments.map((s) => s.when),
      ...scene.choices.map((c) => c.when),
      ...(scene.cgWhen ?? []).map((c) => c.when),
      ...(scene.settlements ?? []).map((s) => s.when),
      ...scene.choices.flatMap((c) => c.previewEffects?.map((p) => p.when) ?? []),
    ])
      if (c) refs(c, set);
    if (scene.kind === 'end' && !scene.completion)
      for (const rule of story.endings) if (rule.when) refs(rule.when, set);
    live.set(scene.id, set);
    reachable.set(scene.id, new Set(scene.kind === 'choice' ? [scene.id] : []));
    const effects = [
      ...scene.choices.flatMap((c) => [
        ...c.effects,
        ...(c.previewEffects ?? []).flatMap((p) => p.effects),
      ]),
      ...(scene.completionEffects?.effects ?? []),
      ...(scene.settlements ?? []).flatMap((s) => s.effects),
    ];
    const reads = new Set<string>();
    if (effects.some((e) => e.type === 'points' && e.delta < 0)) reads.add('points');
    if (effects.some((e) => e.type === 'unrest' && !e.clamp)) reads.add('unrest');
    if (scene.completion?.nextSceneId && scene.completion.nextChapterId !== scene.chapter) {
      reads.add('points');
      reads.add('unrest');
    }
    resources.set(scene.id, reads);
    edges.set(
      scene.id,
      [
        scene.next,
        scene.conditionalNext?.next,
        scene.completion?.nextSceneId,
        ...scene.choices.map((c) => c.next),
      ].filter(Boolean) as string[]
    );
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, next] of edges)
      for (const to of next)
        for (const map of [live, reachable, resources]) {
          const a = map.get(id)!,
            b = map.get(to);
          for (const key of b ?? [])
            if (!a.has(key)) {
              a.add(key);
              changed = true;
            }
        }
  }
  return (s: GameState) =>
    JSON.stringify([
      s.currentSceneId,
      s.currentSegmentIndex,
      [...live.get(s.currentSceneId)!].sort().map((k) => [k, s.flags[k]]),
      s.clear,
      s.politicalRoute,
      s.tarotRoute,
      s.politicalScore,
      s.campaign && [
        s.campaign.mode,
        s.campaign.chapter,
        s.campaign.act,
        resources.get(s.currentSceneId)!.has('points') ? s.campaign.politicalPoints : null,
        resources.get(s.currentSceneId)!.has('unrest') ? s.campaign.unrest : null,
        s.campaign.sealed,
        s.campaign.upkeep.map((r) => r.chapter),
      ],
      s.decisionLog.filter((e) =>
        reachable.get(s.currentSceneId)!.has(e.slice(0, e.lastIndexOf(':')))
      ),
    ]);
}
