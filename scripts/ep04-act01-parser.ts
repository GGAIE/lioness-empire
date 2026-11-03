import type { Scene } from '../packages/narrative-core/schema';

const names: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  塔馬拉: 'TAMARA',
  芬利: 'FINLEY',
  禮官: 'CEREMONIAL_OFFICER',
  王室文書官: 'ROYAL_SCRIBE',
  聖光會見證者: 'FAITH_WITNESS',
  路德維克: 'LUDOVIC',
  馬提厄: 'MATHIEU',
  赫爾曼: 'HERMANN',
};
export const ep04Act01Roles = Object.fromEntries(
  Object.entries(names).map(([name, id]) => [id, name])
);
const cg = (n: number) =>
  `EP04-ACT01-CG${String(Math.ceil(n / 5)).padStart(2, '0')}-${String(((n - 1) % 5) + 1).padStart(2, '0')}`;
type Row = { text: string; line: number };
const clean = (s: string) => s.trim().replace(/\*\*/g, '');

// Supplementary storyboard cues are tied to exact authored prose. Three inline
// cues are repositioned to the action/character actually depicted in the selected image.
const anchors: [number, number, string][] = [
  [
    1,
    4,
    '王座仍然空著。王座側方，擺放著代表暫時攝政的次席。那張椅子沒有王冠，也沒有繼承王位的象徵。',
  ],
  [1, 5, '奧莉維亞／心聲：「至少今天，我還不需要坐在父王的位置上。」'],
  [2, 8, '王室文書官將攝政印信交到奧莉維亞面前。她伸手接過。印信比她想像中沉。'],
  [2, 9, '鐘聲再次響起。大廳裡響起整齊的掌聲。奧莉維亞微微低頭。'],
  [
    2,
    10,
    '奧莉維亞抬起頭。大廳裡仍有許多人望著她。有些人顯然鬆了一口氣；有人低聲交談；還有人在禮官宣布儀式結束之前，便朝她的方向挪動腳步。',
  ],
  [3, 13, '馬提厄：「恭喜殿下。說起來，前些日子的行政改革，商人們可是相當關注。」'],
  [3, 14, '第三位上前的是一名年紀較長的高級宮廷官員。他先行一個十分標準的禮。'],
  [
    3,
    15,
    '祝賀持續進行。奧莉維亞覺得自己今天聽見的稱讚，恐怕比過去幾個月加起來還多。她甚至開始懷疑，王宮是不是為了攝政儀式，特別準備了一份適用於所有場合的讚美詞彙。',
  ],
  [
    4,
    19,
    '奧莉維亞／心聲：「一個懂舊程序的人。一個熟悉商會的人。還有一個知道每項職務應該向誰報告的人。如果我想讓王國繼續運作，似乎還真的少不了他們。」',
  ],
  [4, 20, '塔馬拉：「妳在看什麼？」'],
  [5, 23, '芬利推門而入，手裡帶著幾份整理過的資料。'],
  [5, 24, '奧莉維亞：「你還記得我們以前在學院研究過的薩克敵嗎？」'],
  [
    5,
    25,
    '她沒有把話說完。芬利也沒有立刻接下去。燈火輕輕搖晃。鏡頭停留在桌面上兩份相隔久遠的研究材料。一份來自已經滅亡的古代帝國；另一份來自仍然繁榮的安度因王國。',
  ],
];
export function parseEp04Act01(markdown: string) {
  const boundary = markdown.indexOf('## 7｜25 張 CG');
  if (boundary < 0) throw Error('Missing EP04 screenplay boundary');
  const rows = markdown
    .slice(0, boundary)
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }));
  const headings = rows.flatMap((r, i) => {
    const m = r.text.match(/^## [2-6]｜完整劇本 SC(0[1-5])〈(.+)〉$/);
    return m ? [{ index: i, number: Number(m[1]), title: m[2] }] : [];
  });
  if (headings.length !== 5) throw Error('Expected five EP04 scenes');
  const scenes: Scene[] = [],
    uses: {
      sceneId: string;
      segmentId: string;
      line: number;
      text: string;
      origin: 'BODY' | 'OPTION';
    }[] = [];
  for (const [hi, h] of headings.entries()) {
    if (h.number !== hi + 1) throw Error('Scene order mismatch');
    const num = h.number,
      id = `EP04_ACT01_SC0${num}`;
    let body = rows.slice(h.index + 1, headings[hi + 1]?.index);
    body = body.filter((row) => {
      const marker = clean(row.text).match(/^【CG(\d{2})｜/);
      return !marker || ![8, 13, 23].includes(Number(marker[1]));
    });
    for (const [, image, phrase] of anchors.filter((a) => a[0] === num)) {
      const hits = body.flatMap((r, i) => (clean(r.text) === phrase ? [i] : []));
      if (hits.length !== 1) throw Error('Storyboard anchor needs review ' + phrase);
      body.splice(hits[0], 0, { text: `@CG ${image}`, line: body[hits[0]].line });
    }
    const question = body.findIndex((r) => /^### CH0[1-5]｜/.test(r.text));
    const options = body.flatMap((r, i) => {
      const m = r.text.match(/^\*\*([ABC])｜(「.+」)\*\*$/);
      return m ? [{ index: i, letter: m[1], text: m[2], line: r.line }] : [];
    });
    const common = body.findIndex((r) => clean(r.text).startsWith('【共同匯合：'));
    if (question < 0 || options.map((o) => o.letter).join('') !== 'ABC' || common < 0)
      throw Error('Invalid EP04 option layout');
    const make = (suffix: string, baseCg: string): Scene => ({
      id: id + suffix,
      chapter: 'EP04',
      act: 'ACT01',
      sceneNumber: num,
      title: h.title,
      pov: 'OLIVIA',
      cast: ['OLIVIA'],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      source: `sources/ep04/source-act01-v1.0.md #SC0${num}${suffix}`,
      version: '1.0.0',
      planNodeId: 'EP04_ACT01',
      knowledge: {
        knows: ['僅本幕已呈現之正式攝政宣告與公開祝賀、文書線索。'],
        withheld: [
          '未定王命條款保留泛述；官員暫名維持DRAFT；不將任職重疊視為罪證，不提前揭露後續調查。',
        ],
      },
      cg: baseCg,
      segments: [],
      choices: [],
      directions: [],
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    });
    let current = make('', cg((num - 1) * 5 + 1)),
      held = current.cg!,
      pending: string | undefined;
    function push(row: Row, origin: 'BODY' | 'OPTION' = 'BODY') {
      const text = clean(row.text);
      if (!text || text === '---') return;
      const marker = text.match(/^【CG(\d{2})｜/) ?? text.match(/^@CG (\d+)$/);
      if (marker) {
        if (pending) throw Error('CG has no prose ' + pending);
        pending = held = cg(Number(marker[1]));
        current.directions!.push({ beforeSegment: current.segments.length, cue: 'CG', text: held });
        return;
      }
      if (
        text.startsWith('Scene ID：') ||
        text.startsWith('本 Scene') ||
        text.startsWith('【ACT01 END') ||
        text === '畫面漸暗。'
      ) {
        current.directions!.push({
          beforeSegment: current.segments.length,
          cue: '來源製作註記',
          text,
        });
        return;
      }
      if (text.startsWith('#') || text.startsWith('【'))
        throw Error('Unexpected production marker ' + text);
      let value = text,
        speaker: string | undefined,
        label: string | undefined,
        kind: 'narration' | 'dialogue' | 'thought' = 'narration';
      const voice = text.match(/^([^：]+)：(「.+」)$/);
      if (text === '路德維克短暫停頓，隨即笑道：「有效率的改革，誰會反對呢？」') {
        speaker = 'LUDOVIC';
        label = '路德維克';
        kind = 'dialogue';
      } else if (voice) {
        const name = voice[1].replace('／心聲', '');
        speaker = names[name];
        if (!speaker) throw Error('Unknown voice ' + text);
        kind = voice[1].includes('／心聲') ? 'thought' : 'dialogue';
        label = name + (kind === 'thought' ? '（心聲）' : '');
        value = voice[2];
      } else if (text.startsWith('「')) {
        if (origin !== 'OPTION') throw Error('Unassigned quotation ' + text);
        speaker = 'OLIVIA';
        label = '奧莉維亞';
        kind = 'dialogue';
      }
      if (speaker && !current.cast.includes(speaker)) current.cast.push(speaker);
      const sid = 'L' + String(current.segments.length + 1).padStart(3, '0');
      current.segments.push({
        id: sid,
        text: value,
        kind,
        visual: 'SCENE',
        ...(speaker ? { speaker, speakerLabel: label } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
      uses.push({ sceneId: current.id, segmentId: sid, line: row.line, text: row.text, origin });
    }
    body.slice(0, question).forEach((r) => push(r));
    current.kind = 'choice';
    current.choiceMode = 'DIALOGUE_FLAVOR';
    current.choices = options.map((o) => ({
      id: o.letter,
      text: o.text,
      next: id + '_' + o.letter,
      effects: [],
    }));
    if (!current.segments.length || pending) throw Error('Empty choice');
    scenes.push(current);
    const branchCg = held;
    options.forEach((o, i) => {
      current = make('_' + o.letter, branchCg);
      push({ text: o.text, line: o.line }, 'OPTION');
      body.slice(o.index + 1, options[i + 1]?.index ?? common).forEach((r) => push(r));
      current.next = id + '_COMMON';
      scenes.push(current);
    });
    current = make('_COMMON', branchCg);
    body.slice(common + 1).forEach((r) => push(r));
    if (pending || !current.segments.length) throw Error('Empty common');
    if (num < 5) current.next = `EP04_ACT01_SC0${num + 1}`;
    else {
      current.kind = 'end';
      current.segments.push({
        id: 'L' + String(current.segments.length + 1).padStart(3, '0'),
        text: '＊　＊　＊',
        kind: 'caption',
        visual: 'BLACK',
      });
      current.completion = {
        title: '第一幕完 · 攝政之日',
        scope: 'ACT',
        nextChapterId: 'EP04',
        policy: 'NO_SCORING',
        pendingLabel: '第二幕〈薩克敵之亡〉· 劇本尚未提供',
      };
    }
    scenes.push(current);
  }
  const allCg = scenes.flatMap((s) => s.segments).flatMap((p) => (p.cg ? [p.cg] : []));
  if (allCg.length !== 25 || new Set(allCg).size !== 25) throw Error('Expected 25 unique CG cues');
  return { scenes, roles: ep04Act01Roles, uses };
}
