import type { Scene } from '../packages/narrative-core/schema';

export const act04CompletionFlags = {
  OLIVIA_REGENCY_AUTHORITY: false,
  FINLEY_AT_CAPITAL_AS_ACADEMY_LIAISON: true,
  ROYAL_DOCUMENT_ROLES_CLARIFIED: true,
  AIVIS_EASTERN_DUTY_CONFIRMED: true,
  FATHER_AUDIENCE_REQUESTED: true,
  FATHER_AUDIENCE_GRANTED: false,
};
const speakers: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  艾維斯: 'AIVIS',
  內廷承辦人: 'PALACE_CLERK',
  承辦人: 'PALACE_CLERK',
};
const questions = [
  '被叫醒如何回話？',
  '如何回應承辦人？',
  '如何處理待決案件？',
  '如何把工作交給艾維斯？',
  '如何詢問父王會面？',
];
const cgId = (scene: string, image: string) => `EP01-ACT04-CG${scene}-${image}`;
export function parseEp01Act04(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# 第一部分｜完整劇情正文'),
    end = markdown.indexOf('# 第二部分｜CG 英文提示詞');
  if (start < 0 || end <= start) throw Error('Missing ACT IV prose boundaries');
  const narrative = markdown.slice(start, end),
    headings = [...narrative.matchAll(/^## SC(0[1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT IV source scenes');
  const scenes: Scene[] = [],
    roles: Record<string, string> = {};
  function make(
    num: string,
    title: string,
    body: string,
    suffix: string,
    baseCg: string | undefined,
    answer?: string,
    question?: string
  ): Scene {
    const segments: Scene['segments'] = [],
      directions: NonNullable<Scene['directions']> = [];
    let pendingCg: string | undefined,
      black = num === '01' && !suffix;
    const push = (
      text: string,
      kind: 'narration' | 'dialogue' | 'thought' | 'caption',
      speaker?: string,
      label?: string
    ) => {
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text,
        kind,
        visual: black ? 'BLACK' : 'SCENE',
        ...(speaker ? { speaker } : {}),
        ...(label ? { speakerLabel: label } : {}),
        ...(pendingCg ? { cg: pendingCg } : {}),
      });
      pendingCg = undefined;
    };
    if (answer) push(answer, 'dialogue', 'OLIVIA', '奧莉維亞');
    for (const raw of body.trim().split(/\r?\n\s*\r?\n/)) {
      const paragraph = raw.trim();
      if (
        !paragraph ||
        paragraph === '---' ||
        /^### 黑畫面/.test(paragraph) ||
        /^\*\*【選項/.test(paragraph)
      )
        continue;
      const cg = paragraph.match(/^### 【CG 04-(\d{2})-(\d{2})｜([^】]+)】$/);
      if (cg) {
        if (cg[1] !== num || pendingCg) throw Error(`Invalid ACT IV CG sequence ${num}`);
        black = false;
        pendingCg = cgId(num, cg[2]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pendingCg}｜${cg[3]}`,
        });
        continue;
      }
      if (paragraph.startsWith('[') && paragraph.endsWith(']')) {
        directions.push({
          beforeSegment: segments.length,
          cue: '演出',
          text: paragraph.slice(1, -1),
        });
        continue;
      }
      if (paragraph.startsWith('**ACT IV 結束')) {
        directions.push({ beforeSegment: segments.length, cue: '幕末銜接', text: paragraph });
        continue;
      }
      let text = paragraph;
      const aside = text.match(/\*\*ACT IV[^*]*\*\*/);
      if (aside) {
        directions.push({ beforeSegment: segments.length, cue: '製作註記', text: aside[0] });
        text = text.replace(aside[0], '').trim();
      }
      if (text.startsWith('奧莉維亞睜開眼。畫面是')) {
        directions.push({
          beforeSegment: segments.length,
          cue: '第一人稱構圖',
          text: text.slice('奧莉維亞睜開眼。'.length).replace(/\*\*/g, ''),
        });
        text = '奧莉維亞睜開眼。';
      }
      text = text.replace(/\*\*/g, '');
      if (!text) continue;
      const dialogue = text.match(/^([^：\n]+)：(「[\s\S]*」)$/);
      if (dialogue) {
        const prefix = dialogue[1],
          name = Object.keys(speakers).find((name) => prefix.startsWith(name));
        if (!name) throw Error(`Unknown ACT IV speaker: ${prefix}`);
        const id = speakers[name],
          simple = new RegExp(`^${name}(?:（([^）]+)）)?$`).exec(prefix);
        roles[id] = name === '承辦人' ? '內廷承辦人' : name;
        push(
          simple ? dialogue[2] : text,
          simple?.[1] === '內心' ? 'thought' : 'dialogue',
          id,
          simple ? prefix : name
        );
      } else push(text, 'narration');
    }
    if (question) push(question, 'narration', undefined, '選擇');
    if (pendingCg || !segments.length) throw Error(`Empty ACT IV text/CG ${num}${suffix}`);
    return {
      id: `EP01_ACT04_SC${num}${suffix}`,
      chapter: 'EP01',
      act: 'ACT04',
      sceneNumber: Number(num),
      planNodeId: 'EP01_ACT04',
      title,
      pov: 'OLIVIA',
      cast: [...new Set(['OLIVIA', ...segments.flatMap((s) => (s.speaker ? [s.speaker] : []))])],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: '0.4.0',
      source: `sources/ep01/source-act04-v0.4.md #SC${num}${suffix}`,
      knowledge: {
        knows: ['限本幕已核對資料及現有授權；接見請求尚待內廷答覆'],
        withheld: ['尚未取得接見許可或攝政權；正式父女會面留ACT V'],
      },
      segments,
      choices: [],
      directions,
      ...(baseCg ? { cg: baseCg } : {}),
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
  }
  headings.forEach((heading, index) => {
    const num = String(index + 1).padStart(2, '0');
    if (heading[1] !== num) throw Error('Unexpected ACT IV scene order');
    const block = narrative.slice(heading.index! + heading[0].length, headings[index + 1]?.index);
    const bodyStart =
      num === '01' ? block.indexOf('### 黑畫面') : block.indexOf(`### 【CG 04-${num}-01`);
    if (bodyStart < 0) throw Error(`Missing ACT IV opening ${num}`);
    const body = block.slice(bodyStart),
      options = [...body.matchAll(/^\*\*([ABC])｜(「[^\r\n]+」)\*\*\r?$/gm)],
      merge = body.indexOf(`**【匯流 A04-SC${num}-COMMON】**`);
    if (options.length !== 3 || merge < options[2].index!)
      throw Error(`Invalid ACT IV source choices ${num}`);
    const choice = make(
      num,
      heading[2],
      body.slice(0, options[0].index),
      '',
      num === '01' ? undefined : cgId(num, '01'),
      undefined,
      questions[index]
    );
    choice.kind = 'choice';
    choice.choiceMode = 'DIALOGUE_FLAVOR';
    choice.choices = options.map((option, i) => {
      if (option[1] !== ['A', 'B', 'C'][i]) throw Error('Unexpected ACT IV answer order');
      return { id: option[1], text: option[2], next: `${choice.id}_${option[1]}`, effects: [] };
    });
    scenes.push(choice);
    const heldCg = choice.segments.filter((s) => s.cg).at(-1)!.cg!;
    options.forEach((option, i) => {
      const response = make(
        num,
        heading[2],
        body.slice(option.index! + option[0].length, options[i + 1]?.index ?? merge),
        `_${option[1]}`,
        heldCg,
        option[2]
      );
      response.next = `${choice.id}_COMMON`;
      scenes.push(response);
    });
    const common = make(
      num,
      heading[2],
      body.slice(merge + `**【匯流 A04-SC${num}-COMMON】**`.length),
      '_COMMON',
      heldCg
    );
    if (num === '05') {
      common.kind = 'end';
      common.completionFlags = act04CompletionFlags;
      common.segments.push({
        id: `L${String(common.segments.length + 1).padStart(3, '0')}`,
        text: 'ACT IV〈王女的職責〉 完',
        kind: 'caption',
        visual: 'BLACK',
      });
      common.completion = {
        title: '第四幕完 · 王女的職責',
        nextChapterId: 'EP01',
        scope: 'ACT',
        nextSceneId: 'EP01_ACT05_SC01',
        nextLabel: 'EP01〈王冠之前〉· ACT V〈暫時留下的人〉',
        continueLabel: '進入 EP01 第五幕',
        policy: 'NO_SCORING',
      };
    } else common.next = `EP01_ACT04_SC${String(index + 2).padStart(2, '0')}`;
    scenes.push(common);
  });
  return { scenes, roles };
}
