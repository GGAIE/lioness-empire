import type { Scene } from '../packages/narrative-core/schema';

export const ACT02_PRIORITY = 'EP01_ACT02_PRIORITY';
export const act02Options = [
  { id: 'A', value: 'ROYAL_AUTHORITY', text: '先確認父王病況與王室正式授權。' },
  { id: 'B', value: 'EASTERN_FRONT', text: '先確認艾維斯的東線軍情與軍需調度。' },
  { id: 'C', value: 'TECHNICAL_INTERFACE', text: '先確認學院現有技術資料與王都通訊條件。' },
] as const;
const roles = { OLIVIA: '奧莉維亞', FINLEY: '芬利', FAID: '法伊德' };
// Source prose has no speaker headings. These ordered assignments follow its
// explicit attribution and exchanges; text (including inline narration) stays intact.
const voices: Record<string, string[]> = {
  '01': 'F O O F O F O O F F O F O F O F O'.split(' '),
  '02': 'F O F O F O F F O F O F O F O F'.split(' '),
  '03': 'F O F O F F O F'.split(' '),
  A: 'O O F O'.split(' '),
  B: 'O O F O F'.split(' '),
  C: 'O O F O'.split(' '),
  COMMON: 'F O F'.split(' '),
  '04': 'D F D F O O D D'.split(' '),
  '05': 'F O F O F O F O F O'.split(' '),
};
const speakerIds: Record<string, keyof typeof roles> = { O: 'OLIVIA', F: 'FINLEY', D: 'FAID' };
const cgId = (scene: string, image: number) =>
  `EP01-ACT02-CG${scene}-${String(image).padStart(2, '0')}`;
const anchors: Record<string, string[]> = {
  '01': ['清晨的研究室', '房門被推開', '奧莉維亞把那封已拆開', '芬利把外地帶回來'],
  '02': ['研究一旦被攤開', '芬利把這次出差', '很快，新的問題', '「我可以接這一段。'],
  '03': ['研究不可能', '「如果妳回去之後', '奧莉維亞看著眼前'],
  '04': ['午後的行政會談室', '法伊德沒有立刻反對', '法伊德又問', '芬利接過那份核准文件時'],
  '05': ['傍晚時', '從研究室離開時', '次日一早', '片刻後，車輪'],
};
function paragraphs(text: string) {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '---' && !p.startsWith('**'));
}
export function parseEp01Act02(markdown: string): { scenes: Scene[]; roles: typeof roles } {
  const start = markdown.indexOf('# ACT II 正文');
  const end = markdown.indexOf('# 五、CG 提示詞總表');
  if (start < 0 || end <= start) throw Error('Missing ACT II narrative boundaries');
  const narrative = markdown.slice(start, end);
  const headings = [...narrative.matchAll(/^## SC-020([1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT II source scenes');
  const scenes: Scene[] = [];
  function make(num: string, title: string, text: string, key = num, suffix = ''): Scene {
    let dialogue = 0;
    const segments: Scene['segments'] = paragraphs(text).map((text, i) => {
      const voice = text.startsWith('「') ? voices[key][dialogue++] : undefined;
      const speaker = voice ? speakerIds[voice] : undefined;
      if (text.startsWith('「') && !speaker) throw Error(`Missing speaker in ${key}: ${text}`);
      return {
        id: `L${String(i + 1).padStart(3, '0')}`,
        text,
        kind: speaker ? 'dialogue' : 'narration',
        visual: 'SCENE',
        ...(speaker ? { speaker, speakerLabel: roles[speaker] } : {}),
      };
    });
    if (!segments.length || dialogue !== voices[key].length)
      throw Error(`Source/speaker count mismatch: ${key}`);
    const scene: Scene = {
      id: `EP01_ACT02_SC${num}${suffix}`,
      chapter: 'EP01',
      act: 'ACT02',
      sceneNumber: Number(num),
      planNodeId: 'EP01_ACT02',
      title,
      pov: 'OLIVIA',
      cast: ['OLIVIA', 'FINLEY', ...(num === '04' ? ['FAID'] : [])],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      source: `sources/ep01/source-act02-v0.2.md #SC-020${Number(num)}${suffix}`,
      version: '0.2.0',
      knowledge: {
        knows: ['限於本幕正文、召回令與已選的返都工作優先方向'],
        withheld: ['尚未交付的王都後續、攝政與芬利深層秘密'],
      },
      segments,
      choices: [],
      cg: cgId(num, num === '03' && suffix ? (key === 'COMMON' ? 4 : 3) : 1),
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
    if (!suffix) {
      const cues = anchors[num];
      let previous = -1;
      scene.directions = cues.map((prefix, i) => {
        const at = segments.findIndex((s) => s.text.startsWith(prefix));
        if (at < 0 || at <= previous) throw Error(`Missing/out-of-order CG anchor ${num}-${i + 1}`);
        previous = at;
        segments[at].cg = cgId(num, i + 1);
        return {
          beforeSegment: at,
          cue: 'CG',
          text: `${cgId(num, i + 1)}｜依原稿插入位置配對正文`,
        };
      });
    }
    return scene;
  }
  headings.forEach((h, index) => {
    const num = String(index + 1).padStart(2, '0');
    if (Number(h[1]) !== index + 1) throw Error('Unexpected ACT II scene order');
    const block = narrative.slice(h.index! + h[0].length, headings[index + 1]?.index);
    const proseStart = block.indexOf('### 正文');
    const cgStart = block.indexOf('### CG 插入位置');
    if (proseStart < 0 || cgStart <= proseStart) throw Error(`Missing prose/CG bounds ${num}`);
    const prose = block.slice(proseStart + '### 正文'.length, cgStart);
    if (num !== '03') {
      const s = make(num, h[2], prose);
      if (num === '05') {
        s.kind = 'end';
        s.completion = {
          title: '第二幕完 · 離開學院',
          nextChapterId: 'EP01',
          scope: 'ACT',
          nextSceneId: 'EP01_ACT03_SC01',
          nextLabel: 'EP01〈王冠之前〉· ACT III〈重返王都〉',
          continueLabel: '進入 EP01 第三幕',
          policy: 'NO_SCORING',
        };
      } else s.next = `EP01_ACT02_SC${String(index + 2).padStart(2, '0')}`;
      scenes.push(s);
      return;
    }
    const choiceAt = prose.indexOf('### 玩家選項（Visible Choice）');
    const branches = [...prose.matchAll(/^### 分支 ([ABC])｜([^\r\n]+)\r?$/gm)];
    const commonAt = prose.indexOf('### 分支匯流（Common）');
    if (choiceAt < 0 || branches.length !== 3 || commonAt < 0)
      throw Error('Missing priority choice branches');
    const scene = make(num, h[2], prose.slice(0, choiceAt));
    scene.segments.push({
      id: `L${String(scene.segments.length + 1).padStart(3, '0')}`,
      text: '返都之後，奧莉維亞應優先確認什麼？',
      kind: 'narration',
      speakerLabel: '選擇',
    });
    scene.kind = 'choice';
    scene.choices = act02Options.map((option) => {
      if (!prose.includes(option.text) || !markdown.includes(option.value))
        throw Error(`Choice source mismatch ${option.id}`);
      return {
        id: option.id,
        text: option.text,
        next: `${scene.id}_${option.id}`,
        effects: [{ type: 'flag', key: ACT02_PRIORITY, value: option.value }],
      };
    });
    scenes.push(scene);
    branches.forEach((branch, i) => {
      if (branch[1] !== act02Options[i].id) throw Error('Unexpected branch order');
      const s = make(
        num,
        h[2],
        prose.slice(branch.index! + branch[0].length, branches[i + 1]?.index ?? commonAt),
        branch[1],
        `_${branch[1]}`
      );
      s.next = `${scene.id}_COMMON`;
      scenes.push(s);
    });
    const common = make(
      num,
      h[2],
      prose.slice(commonAt + '### 分支匯流（Common）'.length),
      'COMMON',
      '_COMMON'
    );
    common.segments[0].cg = cgId('03', 4);
    common.directions = [
      { beforeSegment: 0, cue: 'CG', text: `${cgId('03', 4)}｜選擇確立後的共同工作計畫` },
    ];
    common.next = 'EP01_ACT02_SC04';
    scenes.push(common);
  });
  return { scenes, roles };
}
