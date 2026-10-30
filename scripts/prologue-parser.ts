import type { Scene } from '../packages/narrative-core/schema';
export const prologueSpeakers: Record<string, string> = {
  艾琳達: 'ALINDA',
  奧莉維亞: 'OLIVIA',
  莎莉雅: 'SHALIA',
  卡拉: 'KARA',
  隨行騎士: 'PRO_ESCORT',
  孩子: 'PRO_CHILD',
  父親: 'PRO_FATHER',
  禮儀官: 'PRO_PROTOCOL',
  儀式官: 'PRO_CEREMONY',
  儀仗官: 'PRO_HERALD',
  貴族甲: 'PRO_NOBLE_A',
  貴族乙: 'PRO_NOBLE_B',
  侍從: 'PRO_ATTENDANT',
};
export function parsePrologue(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const narrative = markdown.slice(markdown.indexOf('# 第一部分'), markdown.indexOf('# 第二部分'));
  const headings = [...narrative.matchAll(/^## (PRO-SC\d{2})｜〈([^〉]+)〉\s*$/gm)];
  if (headings.length !== 8) throw Error('Expected exactly PRO-SC01–08 in narrative section');
  const roles: Record<string, string> = {},
    scenes: Scene[] = [];
  headings.forEach((heading, i) => {
    if (heading[1] !== `PRO-SC${String(i + 1).padStart(2, '0')}`)
      throw Error('Unexpected prologue scene sequence');
    const block = narrative.slice(heading.index! + heading[0].length, headings[i + 1]?.index);
    const segments: Scene['segments'] = [],
      directions: NonNullable<Scene['directions']> = [];
    let label = '',
      buffer: string[] = [],
      black = false;
    const flush = () => {
      const text = buffer.join('\n').trim();
      buffer = [];
      if (!text) return;
      if (!label) return; // Markdown production metadata is not dialogue.
      const direction =
        (label.startsWith('轉場') && label !== '轉場字幕') ||
        label === '音效' ||
        label === '畫面漸黑' ||
        label.startsWith('轉入');
      if (direction) {
        directions.push({ beforeSegment: segments.length, cue: label, text });
        return;
      }
      const kind =
        label === '旁白'
          ? 'narration'
          : label === '轉場字幕'
            ? 'caption'
            : label.includes('心聲')
              ? 'thought'
              : 'dialogue';
      const name = label.replace('・心聲', ''),
        speaker = kind === 'narration' || kind === 'caption' ? undefined : prologueSpeakers[name];
      if (kind !== 'narration' && kind !== 'caption' && !speaker)
        throw Error(`Unknown speaker: ${label}`);
      if (speaker) roles[speaker] = name;
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text: kind === 'caption' ? text.replace(/^\*(.*)\*$/s, '$1') : text,
        ...(speaker ? { speaker } : {}),
        speakerLabel: label,
        kind,
        visual: black ? 'BLACK' : 'SCENE',
      });
    };
    for (const line of block.split(/\r?\n/)) {
      const marker = line.trim().match(/^【([^】]+)】$/);
      if (marker) {
        flush();
        label = marker[1];
        if (label === '畫面漸黑') {
          black = true;
          directions.push({ beforeSegment: segments.length, cue: label, text: '' });
        }
        continue;
      }
      if (!line.trim()) {
        flush();
        continue;
      }
      if (line.trim() === '---' || line.startsWith('**')) continue;
      buffer.push(line.trim());
    }
    flush();
    if (!segments.length) throw Error(`Empty prologue scene ${heading[1]}`);
    const cast = [
      ...new Set(['ALINDA', ...segments.flatMap((s) => (s.speaker ? [s.speaker] : []))]),
    ];
    scenes.push({
      id: heading[1],
      chapter: 'PROLOGUE',
      act: 'ACT01',
      planNodeId: 'PROLOGUE_ACT01',
      title: heading[2],
      pov: 'ALINDA',
      cast,
      kind: i === 7 ? 'end' : 'narrative',
      status: 'DRAFT',
      playback: 'CUTSCENE',
      scoring: 'NONE',
      source: `sources/prologue/source-v0.6.md #${heading[1]}`,
      version: '0.6.0',
      knowledge: {
        knows: ['以艾琳達在現場的觀察與原稿所載回憶為限'],
        withheld: ['未曾接觸的秘密及 EP11 路線回收尚未確認'],
      },
      segments,
      choices: [],
      cg: `PRO-CG${String(i + 1).padStart(2, '0')}`,
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 900 },
      directions,
      ...(i < 7
        ? { next: headings[i + 1][1] }
        : {
            completion: {
              title: '序幕完',
              nextChapterId: 'EP01',
              nextSceneId: 'EP01_ACT01_SC01',
              policy: 'NO_SCORING',
            },
          }),
    });
  });
  return { scenes, roles };
}
