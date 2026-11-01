import type { GameState, Scene, Story } from './schema';
import { clone, initialState, markRead, visibleSegments, enterPlayerChapter } from './engine';

export const actName = (number: number) =>
  ['第一幕', '第二幕', '第三幕', '第四幕', '第五幕'][number - 1] ?? `第${number}幕`;
export interface DirectorySection {
  id: string;
  number: number;
  title: string;
  sceneIds: string[];
  read: boolean;
}
export interface DirectoryAct {
  id: string;
  number: number;
  label: string;
  title: string;
  sections: DirectorySection[];
}
export interface DirectoryChapter {
  id: string;
  number: string;
  title: string;
  acts: DirectoryAct[];
}
export function chapterDirectory(story: Story, readKeys: string[] = []): DirectoryChapter[] {
  const read = new Set(readKeys);
  return story.manifest.chapters
    .filter((ch) => ch.status !== 'DEMO_ONLY')
    .map((ch, i) => {
      const plan = story.plan?.chapters.find((p) => p.id === ch.id);
      const scenes = Object.values(story.scenes).filter((s) => s.chapter === ch.id);
      const actIds = [
        ...new Set([
          ...(plan?.acts.map((a) => `ACT${String(a.number).padStart(2, '0')}`) ?? []),
          ...scenes.map((s) => s.act),
        ]),
      ];
      const acts = actIds.map((id): DirectoryAct => {
        const number = Number(id.replace('ACT', ''));
        const authored = scenes.filter((s) => s.act === id);
        const title =
          authored
            .find((s) => s.completion)
            ?.completion?.title.split(' · ')
            .slice(1)
            .join(' · ') ||
          (ch.id === 'PROLOGUE'
            ? ch.title
            : `${plan?.acts.find((a) => a.number === number)?.label ?? '劇本待續'}（規劃）`);
        const groups = new Map<number, Scene[]>();
        for (const [index, scene] of authored.entries()) {
          const n = scene.sceneNumber ?? index + 1;
          groups.set(n, [...(groups.get(n) ?? []), scene]);
        }
        return {
          id,
          number,
          label: actName(number),
          title,
          sections: [...groups.entries()].map(([number, group]) => {
            const entry = group[0];
            const branchIds = new Set(group.flatMap((s) => s.choices.map((c) => c.next)));
            const complete = (s: Scene) => s.segments.every((p) => read.has(`${s.id}:${p.id}`));
            const ordinary = group.filter((s) => !branchIds.has(s.id));
            const decisions = group.filter((s) => s.kind === 'choice');
            return {
              id: entry.id,
              number,
              title: entry.title,
              sceneIds: group.map((s) => s.id),
              read:
                ordinary.every(complete) &&
                decisions.every((s) =>
                  s.choices.some((c) => complete(group.find((b) => b.id === c.next)!))
                ),
            };
          }),
        };
      });
      return {
        id: ch.id,
        number: ch.id === 'PROLOGUE' ? '序' : String(i).padStart(2, '0'),
        title: ch.id === 'EP01' ? ch.title.split(' · ')[0] : ch.title,
        acts,
      };
    });
}
// Unread prose can be opened directly, but an unresolved decision is a gate.
// Only the committed branch is traversed; other branch responses stay out of the menu.
export function navigableScenes(story: Story, state: GameState): Set<string> {
  const reached = new Set<string>();
  const visit = (id: string) => {
    const scene = story.scenes[id];
    if (!scene || scene.status === 'DEMO_ONLY' || reached.has(id)) return;
    reached.add(id);
    if (scene.kind === 'choice') {
      const chosen = scene.choices.find((c) => state.decisionLog.includes(`${id}:${c.id}`));
      if (chosen) visit(chosen.next);
    } else {
      if (scene.next) visit(scene.next);
      if (
        scene.completion?.nextSceneId &&
        (story.scenes[scene.completion.nextSceneId]?.chapter === scene.chapter ||
          state.readChapters.includes(scene.chapter))
      )
        visit(scene.completion.nextSceneId);
    }
  };
  story.manifest.chapters
    .filter((c) => c.status !== 'DEMO_ONLY')
    .forEach((c) => {
      if (!c.entry) return;
      const planned = story.plan?.chapters.find((p) => p.id === c.id);
      const previous = story.plan?.chapters.find((p) => p.order === (planned?.order ?? 0) - 1);
      if (
        !planned ||
        planned.order <= 1 ||
        state.campaign?.chapter === c.id ||
        state.campaign?.upkeep.some((r) => r.chapter === c.id) ||
        (previous && state.readChapters.includes(previous.id))
      )
        visit(c.entry);
    });
  return reached;
}
export function openDirectorySection(story: Story, state: GameState, id: string): GameState {
  if (!navigableScenes(story, state).has(id)) throw Error('請先完成前一小節的選擇。');
  let n =
    story.scenes[state.currentSceneId].status === 'DEMO_ONLY' ? initialState(story) : clone(state);
  n = enterPlayerChapter(story, n, story.scenes[id].chapter);
  n.currentSceneId = id;
  n.currentSegmentIndex = 0;
  if (n.campaign) {
    const chapter = story.plan?.chapters.find((c) => c.id === story.scenes[id].chapter);
    if (!chapter) throw Error('找不到章節資料。');
    n.campaign.chapter = chapter.id;
    n.campaign.act = Number(story.scenes[id].act.replace('ACT', ''));
  }
  return n;
}
export function continueCommittedChoice(story: Story, state: GameState): GameState {
  const scene = story.scenes[state.currentSceneId];
  const chosen = scene.choices.find((c) => state.decisionLog.includes(`${scene.id}:${c.id}`));
  if (
    scene.kind !== 'choice' ||
    !chosen ||
    state.currentSegmentIndex !== visibleSegments(story, state).length - 1
  )
    throw Error('尚未讀完已選路線的小節。');
  const n = markRead(story, state);
  n.currentSceneId = chosen.next;
  n.currentSegmentIndex = 0;
  return n;
}
