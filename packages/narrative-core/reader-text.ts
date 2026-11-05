import review from '../../content/reader/immersive-text-v1.json' with { type: 'json' };
import type { Scene, Story } from './schema';

export const readerTextEdits = review.edits;
export const readerContentVersion = (version: string) =>
  version.endsWith('.' + review.revision) ? version : version + '.' + review.revision;

export function readerNames(text: string): string {
  return text
    .replaceAll('奧莉薇雅', '奧莉維亞')
    .replaceAll('莎莉雅', '莎莉亞')
    .replaceAll('塔瑪拉', '塔馬拉')
    .replaceAll('米椰爾', '米耶爾');
}

export function readerSpeakerLabel(speaker: string | undefined, label: string): string {
  if (speaker === 'PALACE_CLERK' && label === '承辦人') return '內廷承辦人';
  if (speaker === 'NORTH_WING_STEWARD' && ['主管', '內廷主管'].includes(label)) return '北翼主管';
  if (speaker === 'RUENNE_EXILE_DELEGATE' && label === '路恩代表') return '流亡貴族代表';
  if (speaker === 'OLIVIA' && label === '奧莉維亞低聲自語') return '奧莉維亞（低聲自語）';
  return readerNames(label).replace('・心聲', '（心聲）').replace('（內心）', '（心聲）');
}

// Exact editorial replacements, rather than deleting words such as "故事" or
// "演戲" that also have ordinary meanings inside the story.
export function readerText(sceneId: string, id: string, text: string, choice = false): string {
  const edit = readerTextEdits.find(
    (e) => e.sceneId === sceneId && (choice ? e.choiceId === id : e.segmentId === id)
  );
  if (!edit) return readerNames(text);
  const reviewed = readerNames(edit.to);
  if (text === edit.to || text === reviewed) return reviewed;
  if (text !== edit.from) throw Error(`Reader text needs source review: ${sceneId}/${id}`);
  return reviewed;
}

export function readerScene(scene: Scene): Scene {
  if (scene.status === 'DEMO_ONLY') return scene;
  return {
    ...scene,
    segments: scene.segments.map((p) => ({
      ...p,
      text: readerText(scene.id, p.id, p.text),
      ...(p.speakerLabel ? { speakerLabel: readerSpeakerLabel(p.speaker, p.speakerLabel) } : {}),
    })),
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
    characters: Object.fromEntries(
      Object.entries(story.characters).map(([id, name]) => [id, readerSpeakerLabel(id, name)])
    ),
    scenes: Object.fromEntries(
      Object.entries(story.scenes).map(([id, scene]) => [id, readerScene(scene)])
    ),
  };
}

// Only migrate history whose exact original wording is in the reviewed list.
// Unrelated or user-modified historical text remains untouched.
export function reviewedHistoryText(sceneId: string, segmentId: string, text: string): string {
  return readerNames(
    readerTextEdits.find(
      (e) => e.sceneId === sceneId && e.segmentId === segmentId && e.from === text
    )?.to ?? text
  );
}
