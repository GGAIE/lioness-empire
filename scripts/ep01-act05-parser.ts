import type { Scene } from '../packages/narrative-core/schema';
import { annotateSpeakers } from './speaker-annotations';

export const act05CompletionFlags = {
  FATHER_AUDIENCE_GRANTED: true,
  FATHER_AUDIENCE_COMPLETED: true,
  KING_INTENDS_RETURN_TO_GOVERNMENT: true,
  OLIVIA_TEMPORARY_CAPITAL_STAY: true,
  OLIVIA_ADMINISTRATIVE_ROLE_GRANTED: false,
  OLIVIA_REGENCY_AUTHORITY: false,
  ACADEMY_RESEARCH_CONTINUES: true,
};
const names: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  艾爾維爾: 'ELVIR',
  主管: 'NORTH_WING_STEWARD',
  內廷主管: 'NORTH_WING_STEWARD',
  內廷承辦人: 'PALACE_CLERK',
};
const casts = [
  ['OLIVIA', 'FINLEY', 'PALACE_CLERK'],
  ['OLIVIA', 'NORTH_WING_STEWARD', 'ROYAL_PHYSICIAN'],
  ['OLIVIA', 'ELVIR'],
  ['OLIVIA', 'ELVIR'],
  ['OLIVIA', 'FINLEY'],
];
const cgId = (num: string, img: string) => `EP01-ACT05-CG${num}-${img}`;
export function parseEp01Act05(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# 第一部分｜正式劇情文字'),
    end = markdown.indexOf('# 第二部分｜20 張 CG');
  if (start < 0 || end <= start) throw Error('Missing ACT V prose boundaries');
  const narrative = markdown.slice(start, end),
    headings = [...narrative.matchAll(/^## SC(0[1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT V source scenes');
  const scenes: Scene[] = [],
    roles = {
      OLIVIA: '奧莉維亞',
      FINLEY: '芬利',
      ELVIR: '艾爾維爾',
      NORTH_WING_STEWARD: '北翼主管',
      ROYAL_PHYSICIAN: '王室醫師',
      PALACE_CLERK: '內廷承辦人',
    };
  function make(
    num: string,
    title: string,
    body: string,
    suffix: string,
    baseCg: string,
    answer?: string,
    question?: string
  ): Scene {
    const segments: Scene['segments'] = [],
      directions: NonNullable<Scene['directions']> = [];
    let pending: string | undefined;
    function push(
      text: string,
      kind: 'narration' | 'dialogue' | 'caption',
      speaker?: string,
      label?: string
    ) {
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text,
        kind,
        visual: kind === 'caption' ? 'BLACK' : 'SCENE',
        ...(speaker ? { speaker, speakerLabel: label } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
    }
    if (answer) push(answer, 'dialogue', 'OLIVIA', '奧莉維亞');
    for (const raw of body.split(/\r?\n/)) {
      const paragraph = raw.trim();
      if (!paragraph || paragraph === '---' || paragraph.startsWith('#### ')) continue;
      const cg = paragraph.match(/^### \[CG(\d{2})\] (.+)$/);
      if (cg) {
        if (pending) throw Error(`Unattached ACT V CG ${num}`);
        pending = cgId(num, cg[1]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pending}｜${cg[2]}`,
        });
        continue;
      }
      if (paragraph.startsWith('**場景結束狀態：**')) {
        directions.push({
          beforeSegment: segments.length,
          cue: '製作註記',
          text: paragraph.replace(/\*\*/g, ''),
        });
        continue;
      }
      const text = paragraph.replace(/\*\*/g, '');
      if (text === 'EP01〈王冠之前〉結束。') {
        push(text, 'caption');
        continue;
      }
      if (text.startsWith('#')) throw Error(`Unexpected ACT V heading ${text}`);
      const line = text.match(/^([^：]+)：(「[\s\S]+」)$/),
        name = line && Object.keys(names).find((n) => line[1].startsWith(n));
      if (line && name) push(line[1] === name ? line[2] : text, 'dialogue', names[name], name);
      else push(text, 'narration');
    }
    if (question) push(question, 'narration');
    if (pending || !segments.length) throw Error(`Empty ACT V text/CG ${num}${suffix}`);
    return {
      id: `EP01_ACT05_SC${num}${suffix}`,
      chapter: 'EP01',
      act: 'ACT05',
      sceneNumber: Number(num),
      planNodeId: 'EP01_ACT05',
      title,
      pov: 'OLIVIA',
      cast: casts[Number(num) - 1],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: '0.4.0',
      source: `sources/ep01/source-act05-v0.4.md #SC${num}${suffix}`,
      knowledge: {
        knows: ['限本幕已發生情節與正式確認內容'],
        withheld: ['父王病因與延誤原因未定；正式行政職責留待EP02'],
      },
      segments,
      choices: [],
      directions,
      cg: baseCg,
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
  }
  headings.forEach((heading, index) => {
    const num = String(index + 1).padStart(2, '0');
    if (heading[1] !== num) throw Error('Unexpected ACT V scene order');
    const block = narrative.slice(heading.index! + heading[0].length, headings[index + 1]?.index),
      first = block.indexOf('### [CG01]');
    if (first < 0) throw Error(`Missing ACT V first CG ${num}`);
    const body = block.slice(first),
      options = [...body.matchAll(/^\*\*([ABC])｜(「[^\r\n]+」)\*\*\s*\r?$/gm)],
      commonAt = body.indexOf(`#### 【COMMON A05-SC${num}】`),
      question = body.match(/^#### 【CHOICE A05-SC\d{2}｜([^】]+)】/m)?.[1];
    if (options.length !== 3 || commonAt < options[2].index! || !question)
      throw Error(`Invalid ACT V choice ${num}`);
    const choice = make(
      num,
      heading[2],
      body.slice(0, options[0].index),
      '',
      cgId(num, '01'),
      undefined,
      question.endsWith('？') ? question : `${question}？`
    );
    choice.kind = 'choice';
    choice.choiceMode = 'DIALOGUE_FLAVOR';
    choice.choices = options.map((o, i) => {
      if (o[1] !== ['A', 'B', 'C'][i]) throw Error('Unexpected answer order');
      return { id: o[1], text: o[2], next: `${choice.id}_${o[1]}`, effects: [] };
    });
    scenes.push(choice);
    const held = choice.segments.filter((s) => s.cg).at(-1)!.cg!;
    options.forEach((o, i) => {
      const response = make(
        num,
        heading[2],
        body.slice(o.index! + o[0].length, options[i + 1]?.index ?? commonAt),
        `_${o[1]}`,
        held,
        o[2]
      );
      response.next = `${choice.id}_COMMON`;
      scenes.push(response);
    });
    const common = make(
      num,
      heading[2],
      body.slice(commonAt + `#### 【COMMON A05-SC${num}】`.length),
      '_COMMON',
      held
    );
    if (num === '05') {
      common.kind = 'end';
      common.completionFlags = act05CompletionFlags;
      common.completion = {
        title: '第一章完 · 王冠之前',
        nextChapterId: 'EP02',
        scope: 'CHAPTER',
        pendingLabel: 'EP02 · 劇本尚未提供',
        policy: 'NO_SCORING',
      };
    } else common.next = `EP01_ACT05_SC${String(index + 2).padStart(2, '0')}`;
    scenes.push(common);
  });
  if (scenes.flatMap((s) => s.segments.filter((p) => p.cg)).length !== 20)
    throw Error('Expected twenty ACT V CG cues');
  annotateSpeakers(scenes);
  return { scenes, roles };
}
