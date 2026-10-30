import type { Scene } from '../packages/narrative-core/schema';

const speakers: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  法伊德: 'FAID',
  研究助理: 'ACADEMY_ASSISTANT',
  行政承辦人: 'ACADEMY_ADMIN',
};
export function parseEp01Act01(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# ACT I 劇情正文');
  const end = markdown.indexOf('# CG 製作規範與英文提示詞');
  if (start < 0 || end <= start) throw Error('Missing ACT I narrative boundaries');
  const narrative = markdown.slice(start, end);
  const headings = [...narrative.matchAll(/^## SC(\d{2})〈([^〉]+)〉\s*$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT I scenes');
  const roles: Record<string, string> = {};
  const scenes = headings.map((heading, index): Scene => {
    const num = String(index + 1).padStart(2, '0');
    if (heading[1] !== num) throw Error('Unexpected ACT I scene order');
    const id = `EP01_ACT01_SC${num}`;
    const block = narrative.slice(heading.index! + heading[0].length, headings[index + 1]?.index);
    if (!block.includes(`\`${id}\``)) throw Error(`Source scene ID mismatch: ${id}`);
    const segments: Scene['segments'] = [];
    const directions: NonNullable<Scene['directions']> = [];
    let pendingCg: string | undefined;
    let currentCg: string | undefined;
    for (const raw of block.replace(/^>[ \t]*\r?$/gm, '').split(/\r?\n\s*\r?\n/)) {
      const paragraph = raw.trim();
      if (!paragraph || paragraph === '---') continue;
      const cg = paragraph.match(/^\*\*\[CG (\d{2})-(\d{2})｜([^\]]+)\]\*\*$/);
      if (cg) {
        if (cg[1] !== num) throw Error(`Unexpected CG in ${id}`);
        pendingCg = `EP01-ACT01-CG${cg[1]}-${cg[2]}`;
        currentCg = pendingCg;
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pendingCg}｜${cg[3]}`,
        });
        continue;
      }
      if (paragraph.startsWith('**')) {
        directions.push({ beforeSegment: segments.length, cue: '製作註記', text: paragraph });
        continue;
      }
      // The letter heading contains an editorial disclaimer; keep it in directions,
      // while the actual letter (including its salutation and signature) is playable text.
      if (/^>\s*\*\*/.test(paragraph)) {
        directions.push({ beforeSegment: segments.length, cue: '信函製作註記', text: paragraph });
        continue;
      }
      if (!currentCg) throw Error(`Text without a CG: ${id}`);
      const text = paragraph.replace(/^> ?/gm, '').trim();
      if (!text) continue;
      const dialogue = text.match(/^([^：\n]+)：(「[\s\S]*」)$/);
      const label = dialogue?.[1];
      const name = label?.replace(/低聲自語$/, '');
      const speaker = name ? speakers[name] : undefined;
      if (dialogue && !speaker) throw Error(`Unknown ACT I speaker: ${label}`);
      if (speaker && name) roles[speaker] = name;
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text: dialogue ? dialogue[2] : text,
        kind: speaker ? 'dialogue' : 'narration',
        visual: 'SCENE',
        ...(speaker ? { speaker, speakerLabel: label } : {}),
        ...(pendingCg ? { cg: pendingCg } : {}),
      });
      pendingCg = undefined;
    }
    if (!segments.length || pendingCg) throw Error(`Empty scene/CG: ${id}`);
    const cgCount = directions.filter((d) => d.cue === 'CG').length;
    if (cgCount !== (index === 3 ? 3 : 2)) throw Error(`Unexpected CG count: ${id}`);
    return {
      id,
      chapter: 'EP01',
      act: 'ACT01',
      planNodeId: 'EP01_ACT01',
      title: heading[2],
      pov: 'OLIVIA',
      cast: [...new Set(['OLIVIA', ...segments.flatMap((s) => (s.speaker ? [s.speaker] : []))])],
      kind: index === 4 ? 'end' : 'narrative',
      status: 'DRAFT',
      playback: 'CUTSCENE',
      scoring: 'NONE',
      source: `sources/ep01/source-act01-v0.3.md #${id}`,
      version: '0.3.0',
      knowledge: {
        knows: ['依本幕正文所見與王室公函內容；召回不是攝政任命'],
        withheld: ['父王病況細節、返都後職責及尚未提供的後續劇情'],
      },
      segments,
      choices: [],
      cg: segments[0].cg,
      directions,
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
      ...(index < 4
        ? { next: `EP01_ACT01_SC${String(index + 2).padStart(2, '0')}` }
        : {
            completion: {
              title: '第一幕完 · 平靜被打破',
              nextChapterId: 'EP01',
              scope: 'ACT',
              nextSceneId: 'EP01_ACT02_SC01',
              nextLabel: 'EP01〈王冠之前〉· ACT II〈離開學院〉',
              continueLabel: '進入 EP01 第二幕',
              policy: 'NO_SCORING',
            },
          }),
    };
  });
  return { scenes, roles };
}
