import type { Story, Condition, GameState } from '../packages/narrative-core/schema';
// Keep only values that can still affect executable story flow. Saved player state stays intact.
export function explorationKey(story: Story) {
  const live = new Map<string, Set<string>>(),
    reachable = new Map<string, Set<string>>(),
    resources = new Map<string, Set<string>>(),
    chapters = new Map<string, Set<string>>();
  const refs = (c: Condition, set: Set<string>) => {
    if ('all' in c) c.all.forEach((x) => refs(x, set));
    else if ('any' in c) c.any.forEach((x) => refs(x, set));
    else if ('not' in c) refs(c.not, set);
    else set.add(c.path);
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
    if (scene.kind === 'end' && !scene.completion) {
      set.add('ending');
      for (const rule of story.endings) if (rule.when) refs(rule.when, set);
    }
    live.set(scene.id, set);
    chapters.set(scene.id, new Set([scene.chapter]));
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
    if (effects.some((e) => e.type === 'political' || e.type === 'reinforce'))
      set.add('politicalRoute');
    if (effects.some((e) => e.type === 'reinforce')) set.add('tarotRoute');
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
        for (const map of [live, reachable, resources, chapters]) {
          const a = map.get(id)!,
            b = map.get(to);
          for (const key of b ?? [])
            if (!a.has(key)) {
              a.add(key);
              changed = true;
            }
        }
  }
  // A balance above every remaining possible debit cannot change affordability.
  // Keep exact low balances; use a conservative bound that ignores all future gains.
  // Cycles retain exact balances rather than making a finite-budget assumption.
  const debitBounds = new Map<string, number>();
  const maxUpkeep = Math.max(0, ...(story.plan?.rules.resource.bands.map((b) => b.cost) ?? []));
  const debit = (effects: { type: string; delta?: number }[]) =>
    effects.reduce((sum, e) => sum + (e.type === 'points' ? Math.max(0, -(e.delta ?? 0)) : 0), 0);
  const bound = (id: string, visiting = new Set<string>()): number => {
    if (debitBounds.has(id)) return debitBounds.get(id)!;
    if (visiting.has(id)) return Infinity;
    const scene = story.scenes[id];
    if (!scene) return 0;
    const chain = new Set(visiting).add(id);
    const own =
      debit(scene.settlements?.flatMap((s) => s.effects) ?? []) +
      debit(scene.completionEffects?.effects ?? []) +
      Math.max(
        0,
        ...scene.choices.map(
          (c) => debit(c.effects) + debit(c.previewEffects?.flatMap((p) => p.effects) ?? [])
        )
      );
    const future = Math.max(
      0,
      ...(edges.get(id) ?? []).map(
        (to) =>
          bound(to, chain) +
          (scene.completion?.nextSceneId === to && scene.completion.nextChapterId !== scene.chapter
            ? maxUpkeep
            : 0)
      )
    );
    const value = own + future;
    debitBounds.set(id, value);
    return value;
  };
  for (const id of edges.keys()) bound(id);
  return (s: GameState) =>
    JSON.stringify([
      s.currentSceneId,
      s.currentSegmentIndex,
      [...live.get(s.currentSceneId)!]
        .sort()
        .map((k) => [
          k,
          k.startsWith('flags.')
            ? s.flags[k.slice(6)]
            : k.startsWith('clear.')
              ? s.clear[k.slice(6) as keyof typeof s.clear]
              : k === 'politicalScore'
                ? s.politicalScore
                : null,
        ]),
      live.get(s.currentSceneId)!.has('ending') ? s.clear : null,
      s.politicalRoute,
      s.tarotRoute,
      live.get(s.currentSceneId)!.has('ending') ? s.politicalScore : null,
      s.campaign && [
        s.campaign.mode,
        s.campaign.chapter,
        s.campaign.act,
        resources.get(s.currentSceneId)!.has('points')
          ? s.campaign.politicalPoints === null
            ? null
            : Math.min(s.campaign.politicalPoints, debitBounds.get(s.currentSceneId)!)
          : null,
        resources.get(s.currentSceneId)!.has('unrest') ? s.campaign.unrest : null,
        s.campaign.sealed,
        s.campaign.upkeep
          .filter(
            (r) =>
              r.chapter !== story.scenes[s.currentSceneId].chapter &&
              chapters.get(s.currentSceneId)!.has(r.chapter)
          )
          .map((r) => r.chapter),
      ],
      s.decisionLog.filter((e) =>
        reachable.get(s.currentSceneId)!.has(e.slice(0, e.lastIndexOf(':')))
      ),
    ]);
}
