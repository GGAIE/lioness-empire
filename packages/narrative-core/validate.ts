import { type Condition, type Story } from './schema';
import { validatePlan } from './campaign-schema';
export function validateStory(story: Story) {
  const errors: string[] = story.plan ? validatePlan(story.plan) : [],
    warnings: string[] = [],
    ids = new Set<string>(),
    assets = new Map(story.assets.map((a) => [a.id, a]));
  if (assets.size !== story.assets.length) errors.push('Duplicate asset ID');
  const ref = (id: string | undefined, kind: string) => {
    if (id && (!assets.has(id) || !kind.split('|').includes(assets.get(id)!.type)))
      errors.push(`Unknown/wrong-type ${kind}: ${id}`);
  };
  const check = (c: Condition, where: string) => {
    if ('all' in c) return c.all.forEach((x) => check(x, where));
    if ('any' in c) return c.any.forEach((x) => check(x, where));
    if ('not' in c) return check(c.not, where);
    const flag = c.path.startsWith('flags.') ? story.manifest.flags[c.path.slice(6)] : undefined;
    if (c.path.startsWith('flags.') && !flag) errors.push(`${where}: undeclared flag ${c.path}`);
    const type = flag ? typeof flag.initial : c.path.includes('Route') ? 'string' : 'number';
    if (c.op !== 'exists' && typeof c.value !== type)
      errors.push(`${where}: condition type mismatch ${c.path}`);
    if (['gt', 'gte', 'lt', 'lte'].includes(c.op) && type !== 'number')
      errors.push(`${where}: numeric comparison required`);
    if (
      c.path === 'politicalRoute' &&
      c.value !== undefined &&
      !['NONE', 'SACRED', 'WORLD'].includes(String(c.value))
    )
      errors.push(`${where}: invalid political route`);
    if (
      c.path === 'tarotRoute' &&
      c.value !== undefined &&
      !['NONE', 'STAR', 'CHARIOT', 'TOWER'].includes(String(c.value))
    )
      errors.push(`${where}: invalid tarot route`);
  };
  for (const scene of Object.values(story.scenes)) {
    for (const item of [
      ...(scene.settlements ?? []),
      ...scene.choices.flatMap((c) => c.previewEffects ?? []),
    ]) {
      check(item.when, scene.id);
      for (const e of item.effects)
        if (
          e.type === 'flag' &&
          (!story.manifest.flags[e.key] ||
            typeof story.manifest.flags[e.key].initial !== typeof e.value)
        )
          errors.push(`${scene.id}: invalid settlement/preview flag ${e.key}`);
    }
    for (const item of scene.cgWhen ?? []) {
      check(item.when, scene.id);
      ref(item.cg, 'cg|background');
    }
    if (scene.availableWhen) check(scene.availableWhen, scene.id);
    if (scene.conditionalNext) {
      check(scene.conditionalNext.when, scene.id);
      if (!story.scenes[scene.conditionalNext.next])
        errors.push(`${scene.id}: missing conditional next`);
    }
    if (scene.completionEffects) {
      check(scene.completionEffects.when, scene.id);
      for (const e of scene.completionEffects.effects) {
        if (
          e.type === 'flag' &&
          (!story.manifest.flags[e.key] ||
            typeof story.manifest.flags[e.key].initial !== typeof e.value)
        )
          errors.push(`${scene.id}: invalid completion effect flag ${e.key}`);
      }
    }
    if (scene.choiceMode === 'DIALOGUE_FLAVOR') {
      const seen = new Set<string>();
      const returns = (id: string): boolean => {
        if (id === scene.id) return true;
        if (seen.has(id) || !story.scenes[id]) return false;
        seen.add(id);
        const target = story.scenes[id];
        return [
          target.next,
          target.completion?.nextSceneId,
          ...target.choices.map((c) => c.next),
        ].some((next) => !!next && returns(next));
      };
      if (scene.choices.some((c) => returns(c.next)))
        errors.push(`${scene.id}: flavor choices must not be revisited by story flow`);
    }
    for (const [key, value] of Object.entries(scene.completionFlags ?? {}))
      if (!story.manifest.flags[key] || typeof story.manifest.flags[key].initial !== typeof value)
        errors.push(`${scene.id}: invalid completion flag ${key}`);
    if (story.plan && (scene.status === 'CANON' || scene.status === 'DRAFT') && !scene.planNodeId)
      errors.push(`${scene.id}: Canon scene requires a planning node`);
    if (scene.planNodeId) {
      const chapter = story.plan?.chapters.find((c) => c.id === scene.chapter);
      const act = chapter?.acts.find((a) => a.id === scene.planNodeId);
      if (!act) errors.push(`${scene.id}: unknown planning node ${scene.planNodeId}`);
      else {
        if (scene.act !== `ACT${String(act.number).padStart(2, '0')}`)
          errors.push(`${scene.id}: planning act mismatch`);
        if (
          scene.kind === 'choice' &&
          act.decision === 'NONE' &&
          !scene.planDecisionOverride &&
          (scene.choiceMode !== 'DIALOGUE_FLAVOR' || scene.choices.some((c) => c.effects.length))
        )
          errors.push(`${scene.id}: opening/result plan node forbids effective choices`);
        if (
          scene.planDecisionOverride &&
          (scene.chapter === 'PROLOGUE' ||
            scene.chapter === 'EP12' ||
            scene.planDecisionOverride.source !== scene.source)
        )
          errors.push(`${scene.id}: invalid authored decision override`);
      }
    }
    const local = new Set<string>();
    for (const s of scene.segments) {
      if (local.has(s.id)) errors.push(`${scene.id}: duplicate segment ${s.id}`);
      local.add(s.id);
      if (s.when) check(s.when, scene.id);
      ref(s.cg, 'cg|background');
      ref(s.sfx, 'sfx');
      if (s.speaker && !story.characters[s.speaker]) errors.push(`Unknown speaker ${s.speaker}`);
    }
    if (!scene.segments.some((s) => !s.when))
      errors.push(`${scene.id}: must contain an unconditional segment for save position safety`);
    if (!story.characters[scene.pov]) errors.push(`Unknown POV ${scene.pov}`);
    for (const p of scene.cast) if (!story.characters[p]) errors.push(`Unknown cast ${p}`);
    ref(scene.cg, 'cg|background');
    ref(scene.bgm, 'bgm');
    if (scene.imageWhen) check(scene.imageWhen, scene.id);
    if (scene.next && !story.scenes[scene.next])
      errors.push(`${scene.id}: missing target ${scene.next}`);
    if (
      scene.completion &&
      !story.manifest.chapters.some((c) => c.id === scene.completion!.nextChapterId)
    )
      errors.push(`${scene.id}: missing next chapter`);
    if (scene.completion?.nextSceneId) {
      const target = story.scenes[scene.completion.nextSceneId];
      if (
        !target ||
        target.chapter !== scene.completion.nextChapterId ||
        (target.status === 'DEMO_ONLY') !== (scene.status === 'DEMO_ONLY')
      )
        errors.push(`${scene.id}: invalid completion target`);
    }
    const choices = new Set<string>();
    for (const c of scene.choices) {
      if (choices.has(c.id)) errors.push(`${scene.id}: duplicate choice ${c.id}`);
      choices.add(c.id);
      if (!story.scenes[c.next]) errors.push(`${scene.id}: missing choice target ${c.next}`);
      if (c.when) check(c.when, scene.id);
      for (const e of c.effects)
        if (
          e.type === 'flag' &&
          (!story.manifest.flags[e.key] ||
            typeof story.manifest.flags[e.key].initial !== typeof e.value)
        )
          errors.push(`${scene.id}: invalid effect flag ${e.key}`);
    }
    if (scene.kind === 'choice' && !scene.choices.some((c) => !c.when)) {
      const availability = scene.availableWhen;
      // A choice is guaranteed if each declared entry condition also enables an answer.
      const covered =
        availability &&
        'any' in availability &&
        availability.any.every((when) =>
          scene.choices.some((c) => JSON.stringify(c.when) === JSON.stringify(when))
        );
      if (!covered) errors.push(`${scene.id}: requires unconditional fallback choice`);
    }
    if (scene.status === 'DEMO_ONLY' && scene.chapter !== 'DEMO')
      errors.push(`${scene.id}: demo may not be assigned to a Canon chapter`);
    for (const target of [
      scene.next,
      scene.conditionalNext?.next,
      ...scene.choices.map((c) => c.next),
    ].filter(Boolean) as string[])
      if (
        story.scenes[target] &&
        (story.scenes[target].status === 'DEMO_ONLY') !== (scene.status === 'DEMO_ONLY')
      )
        errors.push(`${scene.id}: cross-boundary DEMO/Canon link`);
  }
  const priorities = new Set<number>();
  for (const r of story.endings) {
    if (ids.has(r.id) || priorities.has(r.priority))
      errors.push(`Duplicate ending ID/priority ${r.id}`);
    ids.add(r.id);
    priorities.add(r.priority);
    if (r.when) check(r.when, r.id);
    if (r.status === 'APPROVED' && !r.when) errors.push(`${r.id}: approved rule needs a condition`);
    if (r.status !== 'DEMO_ONLY' && r.status !== 'APPROVED')
      warnings.push(`${r.id}: ${r.status} — Canon draft, no production award`);
  }
  if (!story.scenes[story.manifest.start]) errors.push('Missing start scene');
  const chapters = new Set<string>();
  for (const c of story.manifest.chapters) {
    if (chapters.has(c.id)) errors.push(`Duplicate chapter ${c.id}`);
    chapters.add(c.id);
    if (c.status === 'NOT_YET_AVAILABLE' && (c.file || c.entry))
      errors.push(`${c.id}: unavailable chapter may not load content`);
    if (c.file && !story.scenes[c.entry ?? '']) errors.push(`${c.id}: missing chapter entry`);
    if (c.entry && story.scenes[c.entry]?.chapter !== c.id)
      errors.push(`${c.id}: entry chapter mismatch`);
  }
  for (const s of Object.values(story.scenes))
    if (!chapters.has(s.chapter)) errors.push(`${s.id}: undeclared chapter ${s.chapter}`);
  for (const [old, to] of Object.entries(story.manifest.migrations))
    if (!story.scenes[to]) errors.push(`Invalid migration ${old} -> ${to}`);
  const reached = new Set<string>();
  const visit = (id: string) => {
    if (reached.has(id) || !story.scenes[id]) return;
    reached.add(id);
    const s = story.scenes[id];
    if (s.next) visit(s.next);
    if (s.conditionalNext) visit(s.conditionalNext.next);
    if (s.completion?.nextSceneId) visit(s.completion.nextSceneId);
    s.choices.forEach((c) => visit(c.next));
  };
  story.manifest.chapters.forEach((c) => {
    if (c.entry) visit(c.entry);
  });
  for (const id of Object.keys(story.scenes))
    if (!reached.has(id)) warnings.push(`Unreachable scene ${id}`);
  // Detect scenes with no structural path to an end. Conditional feasibility is checked separately by exploration.
  const canEnd = new Set(
    Object.values(story.scenes)
      .filter((s) => s.kind === 'end')
      .map((s) => s.id)
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of Object.values(story.scenes)) {
      if (
        !canEnd.has(s.id) &&
        [s.next, s.conditionalNext?.next, ...s.choices.map((c) => c.next)].some(
          (t) => t && canEnd.has(t)
        )
      ) {
        canEnd.add(s.id);
        changed = true;
      }
    }
  }
  for (const id of reached) if (!canEnd.has(id)) errors.push(`${id}: no path to end`);
  return { errors, warnings, scenes: Object.keys(story.scenes).length };
}
