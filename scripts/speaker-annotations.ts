import type { Scene, Story } from '../packages/narrative-core/schema';
import review from '../content/sources/ep01/speaker-annotations-v1.json' with { type: 'json' };

// These are editorial assignments, checked against the exact original text.
// Do not alternate speakers or assign every quoted phrase to a character.
export function annotateSpeakers(scenes: Scene[]): void {
  const prefixes = new Set(scenes.map((s) => `${s.chapter}_${s.act}_`));
  for (const row of review.annotations) {
    if (![...prefixes].some((prefix) => row.sceneId.startsWith(prefix))) continue;
    const scene = scenes.find((s) => s.id === row.sceneId);
    const segment = scene?.segments.find((s) => s.id === row.segmentId);
    if (!scene || !segment || segment.text !== row.text || !scene.cast.includes(row.speaker))
      throw Error(`Speaker annotation needs source review: ${row.sceneId}/${row.segmentId}`);
    if (segment.speaker && segment.speaker !== row.speaker)
      throw Error(`Conflicting speaker annotation: ${row.sceneId}/${row.segmentId}`);
    segment.kind = 'dialogue';
    segment.speaker = row.speaker;
    segment.speakerLabel = row.speakerLabel;
  }
}

export function auditSpeakers(story: Story) {
  const errors: string[] = [];
  const retainedQuotes: { sceneId: string; segmentId: string; text: string; reason: string }[] = [];
  let dialogue = 0,
    thoughts = 0,
    narration = 0;
  for (const scene of Object.values(story.scenes)) {
    if (scene.status === 'DEMO_ONLY') continue;
    for (const segment of scene.segments) {
      const ref = `${scene.id}/${segment.id}`;
      if (segment.kind === 'dialogue' || segment.kind === 'thought') {
        if (segment.kind === 'dialogue') dialogue++;
        else thoughts++;
        if (
          !segment.speaker ||
          segment.speaker === 'NARRATOR' ||
          !story.characters[segment.speaker] ||
          !scene.cast.includes(segment.speaker)
        )
          errors.push(`${ref}: missing or invalid character header`);
      } else if (segment.kind === 'narration') {
        narration++;
        if (segment.speaker && segment.speaker !== 'NARRATOR')
          errors.push(`${ref}: narration has a character header`);
        if (!segment.text.includes('「')) continue;
        const exception = review.nonDialogueExceptions.find(
          (r) => r.sceneId === scene.id && r.segmentId === segment.id && r.text === segment.text
        );
        const prompt =
          scene.kind === 'choice' &&
          segment.speakerLabel === '選擇' &&
          segment === scene.segments.at(-1);
        if (
          (segment.text.startsWith('「') || /：\s*「/.test(segment.text)) &&
          !exception &&
          !prompt
        )
          errors.push(
            `${ref}: spoken-looking prose requires an explicit speaker or reviewed exception`
          );
        retainedQuotes.push({
          sceneId: scene.id,
          segmentId: segment.id,
          text: segment.text,
          reason: exception?.reason ?? (prompt ? 'CHOICE_PROMPT' : 'NARRATIVE_REFERENCE'),
        });
      }
    }
  }
  for (const row of review.annotations) {
    const segment = story.scenes[row.sceneId]?.segments.find((p) => p.id === row.segmentId);
    if (
      !segment ||
      segment.text !== row.text ||
      segment.kind !== 'dialogue' ||
      segment.speaker !== row.speaker ||
      segment.speakerLabel !== row.speakerLabel
    )
      errors.push(`${row.sceneId}/${row.segmentId}: reviewed speaker assignment was lost`);
  }
  return {
    errors,
    counts: { dialogue, thoughts, narration, fixed: review.annotations.length },
    retainedQuotes,
  };
}
