import type { Story, Scene, Condition, Effect } from '../packages/narrative-core/schema';
import {
  initialState,
  visibleSegments,
  markRead,
  continueChapter,
  enterPlayerChapter,
} from '../packages/narrative-core/engine';
import { openingCost } from '../packages/narrative-core/campaign';

const effectsOf = (s: Scene): Effect[] => [
  ...s.choices.flatMap((c) => [
    ...c.effects,
    ...(c.previewEffects ?? []).flatMap((p) => p.effects),
  ]),
  ...(s.settlements ?? []).flatMap((p) => p.effects),
  ...(s.completionEffects?.effects ?? []),
  ...Object.entries(s.completionFlags ?? {}).map(([key, value]) => ({
    type: 'flag' as const,
    key,
    value,
  })),
];

// Terminal chapters can be checked separately when all decisions depend only on
// their own newly introduced flags, the locked route, and exhaustively seeded
// resources. Incoming historical flags, character progress and route changes
// remain part of the ordinary cross-chapter graph.
export function independentChapters(story: Story): Set<string> {
  const eligible = new Set<string>();
  for (const chapter of story.manifest.chapters) {
    const scenes = Object.values(story.scenes).filter((s) => s.chapter === chapter.id);
    if (
      !scenes.length ||
      chapter.status === 'DEMO_ONLY' ||
      !Object.values(story.scenes).some(
        (s) =>
          s.chapter !== chapter.id &&
          s.completion?.nextChapterId === chapter.id &&
          s.completion.nextSceneId
      )
    )
      continue;
    const local = (id?: string) => !id || story.scenes[id]?.chapter === chapter.id;
    if (
      independentEntryScenes(story, chapter.id).some(
        (s) =>
          s.availableWhen &&
          !(
            'path' in s.availableWhen &&
            s.availableWhen.path === 'politicalRoute' &&
            s.availableWhen.op === 'eq' &&
            ['SACRED', 'WORLD'].includes(String(s.availableWhen.value))
          )
      )
    )
      continue;
    const ownFlag = (key: string) =>
      key.startsWith(chapter.id + '_') && !!story.manifest.flags[key];
    const ownCondition = (c?: Condition): boolean =>
      !c ||
      ('all' in c
        ? c.all.every(ownCondition)
        : 'any' in c
          ? c.any.every(ownCondition)
          : 'not' in c
            ? ownCondition(c.not)
            : c.path === 'politicalRoute' ||
              (c.path.startsWith('flags.') && ownFlag(c.path.slice(6))));
    const ownWrite = (e: Effect) => e.type === 'flag' && ownFlag(e.key);
    if (
      Object.values(story.scenes).some(
        (s) =>
          s.chapter !== chapter.id && effectsOf(s).some((e) => e.type === 'flag' && ownFlag(e.key))
      )
    )
      continue;
    const visited = new Set<string>(),
      active = new Set<string>();
    const acyclic = (id: string): boolean => {
      if (active.has(id)) return false;
      if (visited.has(id)) return true;
      visited.add(id);
      active.add(id);
      const s = story.scenes[id];
      const next = [
        s.next,
        s.conditionalNext?.next,
        s.completion?.nextSceneId,
        ...s.choices.map((c) => c.next),
      ].filter((x): x is string => !!x && local(x));
      if (!next.every(acyclic)) return false;
      active.delete(id);
      return true;
    };
    if (!scenes.every((s) => acyclic(s.id))) continue;
    if (
      Object.values(story.scenes).some(
        (s) =>
          s.chapter !== chapter.id &&
          [s.next, s.conditionalNext?.next, ...s.choices.map((c) => c.next)].some(
            (id) => id && story.scenes[id]?.chapter === chapter.id
          )
      )
    )
      continue;
    if (
      scenes.every(
        (s) =>
          !s.specialEnding &&
          Object.keys(s.completionFlags ?? {}).every(ownFlag) &&
          (!s.completionEffects ||
            (ownCondition(s.completionEffects.when) &&
              s.completionEffects.effects.every(ownWrite))) &&
          (s.settlements ?? []).every((p) => ownCondition(p.when) && p.effects.every(ownWrite)) &&
          ownCondition(s.conditionalNext?.when) &&
          local(s.conditionalNext?.next) &&
          ownCondition(s.imageWhen) &&
          (s.cgWhen ?? []).every((p) => ownCondition(p.when)) &&
          ownCondition(s.availableWhen) &&
          s.segments.every((p) => ownCondition(p.when)) &&
          local(s.next) &&
          local(s.completion?.nextSceneId) &&
          (s.kind !== 'end' || s.completion?.scope === 'ACT') &&
          s.choices.every(
            (c) =>
              c.effects.every((e) => e.type === 'points' || e.type === 'unrest' || ownWrite(e)) &&
              !c.previewEffects?.length &&
              ownCondition(c.when) &&
              local(c.next)
          )
      )
    )
      eligible.add(chapter.id);
  }
  return eligible;
}

export function independentEntryStates(story: Story, chapter: string) {
  // Every debit is committed at most once in the certified acyclic chapter.
  // Above their sum, all starting balances are affordable-equivalent; exact
  // balances below it are seeded, including both sides of every cost boundary.
  const budget = Object.values(story.scenes)
    .filter((s) => s.chapter === chapter)
    .flatMap((s) => s.choices.flatMap((c) => c.effects))
    .reduce((total, e) => total + (e.type === 'points' ? Math.max(0, -e.delta) : 0), 0);
  return independentEntryScenes(story, chapter).flatMap((scene) => {
    const condition = scene.availableWhen;
    const route =
      condition && 'value' in condition ? (condition.value as 'SACRED' | 'WORLD') : 'NONE';
    const states = [];
    const routes: Array<'NONE' | 'SACRED' | 'WORLD'> = condition
      ? [route]
      : ['NONE', 'SACRED', 'WORLD'];
    for (const entryRoute of routes)
      for (let points = 0; points <= budget; points++)
        for (let unrest = 0; unrest <= 100; unrest++) {
          const state = initialState({
            ...story,
            manifest: { ...story.manifest, start: scene.id },
          });
          state.politicalRoute = entryRoute;
          state.campaign!.politicalRoute = entryRoute;
          state.campaign!.politicalPoints = points;
          state.campaign!.unrest = unrest;
          states.push(state);
        }
    return states;
  });
}

export function verifyChapterBoundaries(story: Story, chapters: Set<string>) {
  const errors: string[] = [];
  let checks = 0;
  for (const from of Object.values(story.scenes)) {
    const end = from.completion;
    if (!end?.nextSceneId || from.chapter === end.nextChapterId || !chapters.has(end.nextChapterId))
      continue;
    const target = story.scenes[end.nextSceneId];
    const condition = target.availableWhen;
    const route = condition && 'value' in condition ? condition.value : 'NONE';
    if (!['SACRED', 'WORLD', 'NONE'].includes(String(route)))
      throw Error('Unsupported independent entry');
    for (let unrest = 0; unrest <= 100; unrest++) {
      const cost = openingCost(story.plan!, end.nextChapterId, unrest);
      if (cost === null) {
        errors.push(`Unresolved independent entry fee: ${from.id}`);
        continue;
      }
      for (const points of new Set([0, Math.max(0, cost - 1), cost, cost + 1, 50])) {
        const state = initialState({ ...story, manifest: { ...story.manifest, start: from.id } });
        state.politicalRoute = route as 'SACRED' | 'WORLD' | 'NONE';
        state.campaign!.politicalRoute = state.politicalRoute;
        state.campaign!.politicalPoints = points;
        state.campaign!.unrest = unrest;
        state.currentSegmentIndex = visibleSegments(story, state).length - 1;
        const read = markRead(story, state);
        checks++;
        try {
          const next = continueChapter(story, read);
          if (points < cost) throw Error('Entry allowed with insufficient points');
          const receipts = next.campaign!.upkeep.filter((r) => r.chapter === end.nextChapterId);
          if (
            next.currentSceneId !== target.id ||
            next.campaign!.politicalPoints !== points - cost ||
            next.campaign!.unrest !== unrest ||
            receipts.length !== 1 ||
            receipts[0].cost !== cost ||
            enterPlayerChapter(story, next, end.nextChapterId).campaign!.politicalPoints !==
              points - cost ||
            JSON.stringify(next.flags) !== JSON.stringify(read.flags) ||
            JSON.stringify(next.clear) !== JSON.stringify(read.clear)
          )
            throw Error('Entry changed progress or applied the wrong fee');
        } catch (e) {
          if (!(points < cost && String(e).includes('點數不足處理尚未定案')))
            errors.push(`${from.id}: unrest=${unrest}, points=${points}: ${String(e)}`);
        }
      }
    }
  }
  return { chapters: [...chapters], checks, errors };
}

export function independentEntryScenes(story: Story, chapter: string): Scene[] {
  const incoming = new Set(
    Object.values(story.scenes)
      .filter((s) => s.chapter !== chapter && s.completion?.nextChapterId === chapter)
      .map((s) => s.completion?.nextSceneId)
  );
  return Object.values(story.scenes).filter((s) => s.chapter === chapter && incoming.has(s.id));
}
