import review from '../../content/reader/immersive-text-v1.json' with { type: 'json' };
import type { Scene, Story } from './schema';

export const readerTextEdits = review.edits;
export const readerContentVersion = (version: string) =>
  version.endsWith('.' + review.revision) ? version : version + '.' + review.revision;

// Exact editorial replacements, rather than deleting words such as "故事" or
// "演戲" that also have ordinary meanings inside the story.
export function readerText(sceneId: string, id: string, text: string, choice = false): string {
  const edit = readerTextEdits.find(
    (e) => e.sceneId === sceneId && (choice ? e.choiceId === id : e.segmentId === id)
  );
  if (!edit || text === edit.to) return text;
  if (text !== edit.from) throw Error(`Reader text needs source review: ${sceneId}/${id}`);
  return edit.to;
}

export function readerScene(scene: Scene): Scene {
  if (scene.status === 'DEMO_ONLY') return scene;
  return {
    ...scene,
    segments: scene.segments.map((p) => ({ ...p, text: readerText(scene.id, p.id, p.text) })),
    choices: scene.choices.map((c) => ({ ...c, text: readerText(scene.id, c.id, c.text, true) })),
  };
}

export function prepareReaderStory(story: Story): Story {
  for (const edit of readerTextEdits) {
    const scene = story.scenes[edit.sceneId];
    const item = edit.choiceId
      ? scene?.choices.find((c) => c.id === edit.choiceId)
      : scene?.segments.find((p) => p.id === edit.segmentId);
    if (!item) throw Error(`Missing reviewed reader text: ${edit.sceneId}`);
  }
  return {
    ...story,
    manifest: { ...story.manifest, version: readerContentVersion(story.manifest.version) },
    scenes: Object.fromEntries(
      Object.entries(story.scenes).map(([id, scene]) => [id, readerScene(scene)])
    ),
  };
}

// Only migrate history whose exact original wording is in the reviewed list.
// Unrelated or user-modified historical text remains untouched.
export function reviewedHistoryText(sceneId: string, segmentId: string, text: string): string {
  return (
    readerTextEdits.find(
      (e) => e.sceneId === sceneId && e.segmentId === segmentId && e.from === text
    )?.to ?? text
  );
}
