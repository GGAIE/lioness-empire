import type { Scene } from '../packages/narrative-core/schema';
import voices from '../content/sources/ep02/act01-speakers-v0.9.json' with { type: 'json' };
export const ep02Roles: Record<string, string> = {
  OLIVIA: '奧莉維亞',
  FINLEY: '芬利',
  ELVIR: '艾爾維爾',
  AIVIS: '艾維斯',
  ALINDA: '艾琳達',
  SHALIA: '莎莉亞',
  TAMARA: '塔瑪拉',
  COURT_HERALD: '號令官',
  PRO_PROTOCOL: '禮儀官',
  MILITARY_LIAISON: '軍務聯絡官',
  COURT_SCRIBE: '書記',
  MILITARY_OFFICER: '軍政官',
  LOCAL_DELEGATE: '地方代表',
  LOCAL_CLERK: '地方承辦官',
  ROAD_OFFICER: '道路官',
  COURT_OFFICER: '宮廷承辦官',
};
const names: Record<string, string> = Object.fromEntries(
  Object.entries(ep02Roles).map(([id, name]) => [name, id])
);
Object.assign(names, {
  國王: 'ELVIR',
  聯絡官: 'MILITARY_LIAISON',
  承辦官: 'LOCAL_CLERK',
  國王身旁的書記: 'COURT_SCRIBE',
});
const cast = [
  ['OLIVIA', 'FINLEY'],
  [
    'OLIVIA',
    'FINLEY',
    'ELVIR',
    'AIVIS',
    'SHALIA',
    'TAMARA',
    'COURT_HERALD',
    'PRO_PROTOCOL',
    'MILITARY_LIAISON',
  ],
  ['OLIVIA', 'ALINDA', 'ELVIR', 'COURT_HERALD', 'COURT_SCRIBE'],
  [
    'OLIVIA',
    'AIVIS',
    'ELVIR',
    'MILITARY_OFFICER',
    'LOCAL_DELEGATE',
    'COURT_SCRIBE',
    'MILITARY_LIAISON',
    'LOCAL_CLERK',
    'ROAD_OFFICER',
  ],
  ['OLIVIA', 'ELVIR', 'AIVIS', 'COURT_SCRIBE', 'FINLEY', 'COURT_OFFICER'],
];
const cgId = (num: string, img: string) => `EP02-ACT01-CG${num}-${img}`;
export function parseEp02Act01(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# 第一部分｜正式劇情文字'),
    end = markdown.indexOf('# 第二部分｜20 張 CG');
  if (start < 0 || end <= start) throw Error('Missing EP02 narrative bounds');
  const prose = markdown.slice(start, end),
    headings = [...prose.matchAll(/^## SC(0[1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five EP02 source scenes');
  const scenes: Scene[] = [];
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
      kind: 'dialogue' | 'narration' | 'thought' | 'caption',
      speaker?: string
    ) {
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text,
        kind,
        visual: kind === 'caption' ? 'BLACK' : 'SCENE',
        ...(speaker
          ? { speaker, speakerLabel: ep02Roles[speaker] + (kind === 'thought' ? '（內心）' : '') }
          : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
    }
    if (answer) push(answer, 'dialogue', 'OLIVIA');
    for (const raw of body.split(/\r?\n/)) {
      const p = raw.trim();
      if (!p || p === '---') continue;
      const cg = p.match(/^### \[CG(\d{2})\] (.+)$/);
      if (cg) {
        if (pending) throw Error('Unattached EP02 CG');
        pending = cgId(num, cg[1]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pending}｜${cg[2]}`,
        });
        continue;
      }
      if (/^#{3,4} 【CHOICE /.test(p)) continue;
      if (/^\*\*(?:場景結束狀態|轉入 ACT)/.test(p)) {
        directions.push({
          beforeSegment: segments.length,
          cue: '製作註記',
          text: p.replace(/\*\*/g, ''),
        });
        continue;
      }
      const text = p.replace(/\*\*/g, '');
      if (text === 'ACT I〈重新升起的王旗〉結束。') {
        push(text, 'caption');
        continue;
      }
      if (text.startsWith('#')) throw Error(`Unexpected EP02 heading ${text}`);
      const prefix = text.match(/^([^：]+)：(「[\s\S]+」)$/)?.[1],
        name =
          prefix &&
          Object.keys(names)
            .sort((a, b) => b.length - a.length)
            .find((n) => prefix.startsWith(n));
      // Unlabelled paragraphs are assigned below by an exact-text editorial map.
      if (name)
        push(
          prefix === name ? text.slice(prefix.length + 1) : text,
          prefix?.includes('心想') ? 'thought' : 'dialogue',
          names[name]
        );
      else push(text, 'narration');
    }
    if (question) push(question, 'narration');
    if (pending || !segments.length) throw Error(`Empty EP02 text/CG ${num}${suffix}`);
    return {
      id: `EP02_ACT01_SC${num}${suffix}`,
      chapter: 'EP02',
      act: 'ACT01',
      sceneNumber: Number(num),
      planNodeId: 'EP02_ACT01',
      title,
      pov: 'OLIVIA',
      cast: cast[Number(num) - 1],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: '0.9.0',
      source: `sources/ep02/source-act01-v0.9.md #SC${num}${suffix}`,
      knowledge: {
        knows: ['僅本幕已呈報內容與公開行程；不等於全知'],
        withheld: ['未核實的戰死領主清單、病因、回憶原稿與軍議時序；不擅自授予攝政'],
      },
      segments,
      choices: [],
      directions,
      cg: baseCg,
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
  }
  headings.forEach((h, i) => {
    const num = String(i + 1).padStart(2, '0');
    if (h[1] !== num) throw Error('Unexpected EP02 scene order');
    const block = prose.slice(h.index! + h[0].length, headings[i + 1]?.index),
      first = block.indexOf('### [CG01]');
    if (first < 0) throw Error('Missing EP02 first CG');
    const body = block.slice(first),
      options = [...body.matchAll(/^\*\*([ABC])｜(「[^\r\n]+」)\*\*\s*\r?$/gm)],
      commonAt = body.indexOf(`#### 【COMMON A01-SC${num}】`),
      question = body.match(/^### 【CHOICE A01-SC\d{2}｜([^】]+)】/m)?.[1];
    if (options.length !== 3 || commonAt < options[2].index! || !question)
      throw Error(`Invalid EP02 choice ${num}`);
    const choice = make(
      num,
      h[2],
      body.slice(0, options[0].index),
      '',
      cgId(num, '01'),
      undefined,
      question.endsWith('？') ? question : question + '？'
    );
    choice.kind = 'choice';
    choice.choiceMode = 'DIALOGUE_FLAVOR';
    choice.choices = options.map((o, j) => {
      if (o[1] !== ['A', 'B', 'C'][j]) throw Error('Invalid EP02 option order');
      return { id: o[1], text: o[2], next: `${choice.id}_${o[1]}`, effects: [] };
    });
    scenes.push(choice);
    const held = choice.segments.filter((s) => s.cg).at(-1)!.cg!;
    options.forEach((o, j) => {
      const branch = make(
        num,
        h[2],
        body.slice(o.index! + o[0].length, options[j + 1]?.index ?? commonAt),
        '_' + o[1],
        held,
        o[2]
      );
      branch.next = `${choice.id}_COMMON`;
      scenes.push(branch);
    });
    const common = make(
      num,
      h[2],
      body.slice(commonAt + `#### 【COMMON A01-SC${num}】`.length),
      '_COMMON',
      held
    );
    if (num === '05') {
      common.kind = 'end';
      common.completion = {
        title: '第一幕完 · 重新升起的王旗',
        nextChapterId: 'EP02',
        scope: 'ACT',
        nextSceneId: 'EP02_ACT02_SC01',
        nextLabel: 'EP02〈留下來的人〉· ACT II〈王冠之外的責任〉',
        continueLabel: '進入 EP02 第二幕',
        policy: 'NO_SCORING',
      };
    } else common.next = `EP02_ACT01_SC${String(i + 2).padStart(2, '0')}`;
    scenes.push(common);
  });
  for (const row of voices.annotations) {
    const scene = scenes.find((s) => s.id === row.sceneId),
      segment = scene?.segments.find((s) => s.id === row.segmentId);
    if (!segment || segment.text !== row.text || !scene?.cast.includes(row.speaker))
      throw Error(`EP02 speaker annotation needs review: ${row.sceneId}/${row.segmentId}`);
    segment.kind = row.kind as 'dialogue' | 'thought';
    segment.speaker = row.speaker;
    segment.speakerLabel = ep02Roles[row.speaker] + (row.kind === 'thought' ? '（內心）' : '');
  }
  return { scenes, roles: ep02Roles };
}
