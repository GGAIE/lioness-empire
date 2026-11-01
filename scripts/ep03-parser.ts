import type { Scene } from '../packages/narrative-core/schema';

export const ep03Titles = ['平靜之下', '交接之日', '獅王的印戒', '消失的議會', '東北塔的議員們'];
const names: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  奧莉薇雅: 'OLIVIA',
  芬利: 'FINLEY',
  艾爾維爾: 'ELVIR',
  塔馬拉: 'TAMARA',
  魔法守衛: 'MAGIC_GUARD',
  內廷總管: 'COURT_STEWARD',
  太醫: 'ROYAL_PHYSICIAN',
  法務官: 'LEGAL_OFFICER',
  禮官: 'CEREMONIAL_OFFICER',
  內務署職員: 'HOUSEHOLD_CLERK',
  軍需署職員: 'SUPPLY_CLERK',
  職員: 'CLERK',
  主管: 'HOUSEHOLD_SUPERVISOR',
  守衛: 'PALACE_GUARD',
  行政官: 'ADMINISTRATOR',
  工務官: 'WORKS_OFFICER',
  工務人員: 'WORKS_STAFF',
  傳令官: 'PALACE_MESSENGER',
  塔馬拉父親: 'TAMARA_FATHER',
  年長親族: 'ELDER_RELATIVE',
  親族代表: 'FAMILY_DELEGATE',
  管事: 'ESTATE_STEWARD',
  雷蒙: 'RAYMOND',
  瑪蒂爾德: 'MATILDE',
  維克托: 'VICTOR',
  伊莎貝爾: 'ISABELLE',
  奧斯瓦爾德: 'OSWALD',
  法伊德: 'FAID',
  米椰爾: 'MIYER',
  艾拉: 'AYLA',
  卡拉: 'KARLA',
};
export const ep03Roles = Object.fromEntries(Object.entries(names).map(([n, id]) => [id, n]));
type Row = { text: string; line: number; file: string };
type Branch = { label: string; rows: Row[]; cg?: string };
type Item = Row | { question: string; branches: Branch[]; line: number; file: string };
export type SourceUse = {
  file: string;
  line: number;
  text: string;
  sceneId: string;
  segmentId: string;
};
const clean = (s: string) =>
  s
    .trim()
    .replace(/^>\s?/, '')
    .replace(/\*\*/g, '')
    .replace(/^\*([^*]+)\*$/, '$1');
const cg = (act: number, scene: number, image: number) =>
  `EP03-ACT${String(act).padStart(2, '0')}-CG${String(scene).padStart(2, '0')}-${String(image).padStart(2, '0')}`;
const number = (n: number) => String(n).padStart(2, '0');
const rowsOf = (text: string, file: string) =>
  text.split(/\r?\n/).map((text, i) => ({ text, line: i + 1, file }));
function insertBefore(rows: Row[], phrase: string, value: string | Item) {
  const hits = rows.flatMap((r, i) => (clean(r.text) === phrase ? [i] : []));
  if (hits.length !== 1) throw Error(`Anchor needs review (${hits.length}): ${phrase}`);
  const i = hits[0],
    ref = rows[i];
  if (typeof value !== 'string') throw Error('Use choice insertion separately');
  rows.splice(i, 0, { ...ref, text: value });
}

// ACT III / IV provide storyboard descriptions, rather than inline CG cues.
// Each image is anchored to an exact authored paragraph; no evenly spaced or guessed timing.
const act3Anchors: string[][] = [
  [
    '深夜的王都逐漸安靜下來。一輛帶有王室徽記的馬車沿著石板道路疾行。街道兩側的魔法燈在窗上留下一道道短暫的光影。',
    '奧莉維亞坐在車廂內，掌心懸浮著淡淡發光的通訊術式。',
    '奧莉維亞：「現在有很多人需要幫助。如果我能替他們解決問題，以後需要協助時，也比較容易找到願意幫忙的人。」',
    '芬利：「不過，奧莉維亞。」',
    '馬車駛過王宮外圍的石橋，厚重宮門緩緩開啟。',
  ],
  [
    '長廊裡的燈火比平常明亮。奧莉維亞沿著熟悉的道路走向父王寢宮。侍從與禁衛行禮，她只是輕輕點頭。',
    '房門打開。淡淡藥草氣味、調暗的魔法燈、安靜的醫療器具。太醫與侍從退到一旁。',
    '奧莉維亞沒有說話。她看見父親躺在床上，比記憶中蒼老，也更加疲憊。她走到床邊，坐下，輕輕握住父親的手。',
    '艾爾維爾：「怎麼了？平常話不是很多嗎？」',
    '艾爾維爾：「那就再陪我坐一會兒吧。」',
  ],
  [
    '艾爾維爾靠在枕上，望著坐在床邊的女兒。',
    '艾爾維爾：「艾維斯還在東線。我不打算讓他為了這件事回來。」',
    '她不急著追問能得到什麼權限；父王既然主動提出安排，自然會說明打算。不必自己提出多餘問題。',
    '艾爾維爾：「奧莉維亞，我能交給妳裁決的權力，但真正要讓事情辦成，還得靠妳自己。有些人會因為妳是公主而向妳行禮，但願意替妳做事，和願意向妳行禮，是兩回事。」',
    '艾爾維爾：「那麼，請總管進來吧。」',
  ],
  [
    '房門打開。內廷總管率法務官、兩名見證官員和書記入內，向病榻上的國王行禮。',
    '法務官：「奉安度因國王艾爾維爾陛下之命，因陛下健康狀況暫時無法持續親理國政，特授權王女奧莉維亞於緊急代理期間，代行依法應由國王處理之必要行政裁決。」',
    '奧莉維亞：「我願意。」',
    '艾爾維爾摘下多年佩戴的王之印戒，奧莉維亞扶住他的手，雙手接過。',
    '艾爾維爾：「其實啊……其實，我一直比較看好妳，奧莉維亞。」',
    '奧莉維亞：「那您可得好好休息，才能親眼看看。」',
  ],
  [
    '王宮內廷休息室仍亮著燈。奧莉維亞坐在桌旁，桌上放著授權文書副本。她啟動魔法通訊術式。',
    '芬利：「我正在思考，這到底算不算好消息。」',
    '芬利：「等等，我什麼時候變成皇親國戚了？」',
    '奧莉維亞：「以前研究學院的事情，不也是我們一起討論的？」',
    '芬利：「對，有得幹了。」',
  ],
];
const act4Anchors: [number, number, string][] = [
  [1, 1, '清晨的光落進王宮書房。'],
  [1, 2, '芬利：「大公主，睜開你的眼睛。」'],
  [1, 3, '兩人離開書房，沿著走廊往內庭走去。'],
  [2, 4, '內庭的噴泉緩緩流動，雷蒙與瑪蒂爾德已經等候多時。'],
  [2, 5, '奧莉維亞再翻一頁。'],
  [2, 6, '她把文件放回桌上，轉頭看向芬利。'],
  [2, 7, '雷蒙領命離開。內廷人員開始著手整理要裁撤的單位，內庭暫時安靜下來。'],
  [3, 8, '午後，維克托、伊莎貝爾與塔馬拉陸續抵達王宮。'],
  [3, 9, '塔馬拉一坐下就先看了奧莉維亞兩眼。'],
  [
    3,
    10,
    '維克托表示，國庫仍在運作，既有預算與稅收並未中斷；塔馬拉則說明，地方各領地自己的事大多還能處理，真正卡住的是跨領地的道路、維修、共同出資與動員責任。',
  ],
  [3, 11, '伊莎貝爾：「目前沒有正式召開。」'],
  [3, 12, '奧莉維亞先是沉默，接著把手上的文件慢慢放下。'],
  [3, 13, '塔馬拉：「有件事妳得先知道。不是所有議員都還活著。」'],
  [4, 14, '沒多久，年邁的議事書記長奧斯瓦爾德抱著厚重名冊趕到。'],
  [4, 15, '她盯著那本名冊，接著抬頭看向老人。'],
  [4, 16, '奧莉維亞：「聽清楚。」'],
  [5, 17, '一路上，奧莉維亞還在氣。'],
  [5, 18, '她走進大廳，環顧四周。'],
  [
    5,
    19,
    '兩人一邊拌嘴，一邊用魔法整理大廳。原本堆在邊角的舊桌椅和器具被重新分類，中央很快清出一塊足以擺放議事長桌的空間。',
  ],
  [5, 20, '傍晚時，一樓大廳與二樓小廳已經完成初步清理。'],
];

export function parseEp03Act(markdown: string, act: number, choicesMarkdown?: string) {
  const file = `sources/ep03/act${number(act)}/${act === 4 ? '05' : '00'}.md`;
  let rows = rowsOf(markdown, file);
  if (act === 1)
    rows = rows.slice(
      0,
      rows.findIndex((r) => r.text.startsWith('# 選項對照'))
    );
  if (act === 5)
    rows = rows.slice(
      0,
      rows.findIndex((r) => r.text.startsWith('# 第二部分'))
    );
  const headings = rows.flatMap((r, index) => {
    const m = r.text.match(/^#{1,2} SC(0[1-5])｜(.+)$/);
    return m ? [{ index, num: Number(m[1]), title: m[2] }] : [];
  });
  if (headings.length !== 5) throw Error('Expected five EP03 scenes');
  const scenes: Scene[] = [],
    uses: SourceUse[] = [];
  const choiceRows = choicesMarkdown ? rowsOf(choicesMarkdown, 'sources/ep03/act04/06.md') : [];
  for (let si = 0; si < 5; si++) {
    const h = headings[si],
      num = h.num;
    let body = rows.slice(h.index + 1, headings[si + 1]?.index);
    if (act === 3) {
      const first = body.findIndex((r) => r.text === '## 完整 VN 劇情');
      const last = body.findIndex((r) => r.text.startsWith('## CG 提示詞'));
      if (first < 0 || last < 0) throw Error('Missing ACT III prose boundary');
      body = body.slice(first + 1, last);
      act3Anchors[si].forEach((phrase, i) =>
        insertBefore(body, phrase, `@CG ${cg(act, num, i + 1)}`)
      );
    }
    if (act === 4) {
      act4Anchors
        .filter((a) => a[0] === num)
        .forEach(([, image, phrase]) =>
          insertBefore(body, phrase, `@CG EP03-ACT04-CG${number(image)}`)
        );
    }
    if (act === 5) {
      // Body numbering has 25 cues, while the actual storyboard has 26 main images.
      // CG23/24/25 resolve by scene/local IDs, not by subtracting five per scene.
      body = body.map((r) => {
        const m = r.text.match(/^【CG-(\d{2})｜/);
        if (!m) return r;
        const global = Number(m[1]);
        const local = num < 5 ? global - (num - 1) * 5 : { 22: 1, 23: 2, 24: 4, 25: 5 }[global];
        if (!local) throw Error('Unknown fifth act CG');
        return { ...r, text: `@CG ${cg(act, num, local)}` };
      });
      // Markers in this manuscript follow the described action. Put the cue on that paragraph.
      for (let i = 1; i < body.length; i++) {
        if (!body[i].text.startsWith('@CG')) continue;
        let j = i - 1;
        while (j >= 0 && !body[j].text.trim()) j--;
        if (j >= 0 && !/^(?:#|【|@)/.test(body[j].text)) {
          const cue = body.splice(i, 1)[0];
          body.splice(j, 0, cue);
        }
      }
      if (num === 5)
        insertBefore(
          body,
          '奧莉薇雅把話題轉向臨時議場的合法使用。東北塔只提供場所，還得由有權機構確認召集程序、名冊、書記紀錄與安全要求；舊議事大廳重建須另案處理。',
          `@CG ${cg(5, 5, 3)}`
        );
    }
    let items: Item[] = body;
    if (act === 4) {
      if (!choicesMarkdown) throw Error('Missing ACT IV choices');
      const insertion: [number, number, string][] = [
        [2, 1, '奧莉維亞再翻一頁。'],
        [2, 2, '奧莉維亞慢慢抬起頭。'],
        [3, 3, '奧莉維亞先是沉默，接著把手上的文件慢慢放下。'],
        [3, 4, '奧莉維亞聽完，當場爆炸。'],
        [4, 5, '奧莉維亞：「……」'],
      ];
      for (const [, ch, phrase] of insertion.filter((a) => a[0] === num)) {
        const start = choiceRows.findIndex((r) => r.text.startsWith(`## CH${number(ch)}｜`));
        const end = choiceRows.findIndex((r, i) => i > start && r.text.startsWith('## CH'));
        const block = choiceRows.slice(start, end < 0 ? undefined : end);
        const labels = block
          .filter((r) => /^\d\. \*\*/.test(r.text))
          .map((r) => clean(r.text).replace(/^\d\. /, ''));
        const branchHeads = block.flatMap((r, i) => (/^#### [123]\.$/.test(r.text) ? [i] : []));
        const common = block.findIndex((r) => r.text === '### 共通收束');
        if (labels.length !== 3 || branchHeads.length !== 3 || common < 0)
          throw Error('Bad ACT IV choice');
        const branches = branchHeads.map((index, i) => ({
          label: labels[i],
          rows: block.slice(index + 1, branchHeads[i + 1] ?? common),
        }));
        const hits = items.flatMap((r, i) => ('text' in r && clean(r.text) === phrase ? [i] : []));
        if (hits.length !== 1) throw Error('Choice insertion needs review ' + phrase);
        items.splice(hits[0], 0, {
          question: clean(block[0].text).replace(/^## CH\d+｜SC\d+：/, ''),
          branches,
          line: block[0].line,
          file: block[0].file,
        });
      }
    } else if (act !== 3) {
      const result: Item[] = [];
      for (let i = 0; i < body.length; i++) {
        const row = body[i];
        const choice = row.text.match(
          /^### (?:\[CHOICE SC\d{2}(?:｜(.+)\]|\] (.+))|CH(\d{2})｜(.+))$/
        );
        if (!choice) {
          result.push(row);
          continue;
        }
        const question = choice[1] ?? choice[2] ?? choice[4];
        const ch = Number(choice[3]);
        const optionHeads: { index: number; letter: string; label: string }[] = [];
        let end = i + 1;
        for (; end < body.length; end++) {
          if (/^(?:\[MERGE SC\d{2}\]|### CH\d{2} 共通)$/.test(body[end].text)) break;
          const option = body[end].text.match(/^\*\*([ABC])(?:｜(.+)|\.(.+))\*\*$/);
          if (option)
            optionHeads.push({ index: end, letter: option[1], label: option[2] ?? option[3] });
        }
        if (end === body.length || optionHeads.map((o) => o.letter).join('') !== 'ABC')
          throw Error('Invalid choice ' + row.text);
        result.push({
          question,
          line: row.line,
          file: row.file,
          branches: optionHeads.map((o, j) => ({
            label: o.label,
            rows: body.slice(o.index + 1, optionHeads[j + 1]?.index ?? end),
            ...(act === 5 && ch >= 2 && ch <= 4
              ? { cg: `EP03-ACT05-ALT_CH${number(ch)}_${o.letter}` }
              : {}),
          })),
        });
        i = end;
      }
      items = result;
    }
    const id = `EP03_ACT${number(act)}_SC${number(num)}`;
    let counter = 0,
      current = make(
        id,
        act === 4
          ? `EP03-ACT04-CG${number(act4Anchors.find((a) => a[0] === num)![1])}`
          : cg(act, num, 1)
      );
    let held = current.cg!,
      pending: string | undefined;
    function make(sceneId: string, baseCg: string): Scene {
      return {
        id: sceneId,
        chapter: 'EP03',
        act: `ACT${number(act)}`,
        sceneNumber: num,
        title: h.title,
        pov: 'OLIVIA',
        cast: ['OLIVIA'],
        kind: 'narrative',
        status: 'DRAFT',
        playback: 'READER',
        scoring: 'NONE',
        version: '1.0.0',
        source: `${file} #SC${number(num)}`,
        planNodeId: `EP03_ACT${number(act)}`,
        knowledge: {
          knows: ['僅本幕已呈現資訊；王室見證、緊急代行與正式攝政依劇本分開。'],
          withheld: ['未提供後續章節；不將準備性諮詢當作正式全體議會決議。'],
        },
        segments: [],
        choices: [],
        directions: [],
        cg: baseCg,
        presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
      };
    }
    function push(row: Row) {
      const raw = row.text.trim(),
        text = clean(raw);
      if (!text || text === '---') return;
      const anchor =
        text.match(/^@CG (.+)$/) ??
        text.match(/^(?:### )?\[CG_INSERT: EP03_ACT02_SC\d{2}_CG(\d{2})\]/) ??
        text.match(/^\[CG \d{2}-(\d{2})｜/);
      if (anchor) {
        if (pending) throw Error('CG without paragraph ' + pending);
        pending = held = text.startsWith('@CG') ? anchor[1] : cg(act, num, Number(anchor[1]));
        current.directions!.push({ beforeSegment: current.segments.length, cue: 'CG', text: held });
        return;
      }
      if (
        /^(?:#|\[|【(?:BG|SFX|SC\d)|ID |Scene ID|時間／地點|POV|CG 插入|`|ACT I|EP03 ACT|NEXT：|SC\d{2} END|【道具文本|文件文字由 VN)/.test(
          text
        ) ||
        raw.startsWith('- ')
      ) {
        current.directions!.push({
          beforeSegment: current.segments.length,
          cue: '來源演出註記',
          text,
        });
        return;
      }
      let value = text,
        speaker: string | undefined,
        speakerLabel: string | undefined;
      let kind: 'narration' | 'dialogue' | 'thought' = 'narration';
      const tag = text.match(/^【([^】]+)】(.*)$/);
      const colon = text.match(/^([^：]{1,25})：(「.*)$/);
      if (tag && tag[1] === '旁白') value = tag[2];
      else if (tag || colon) {
        const prefix = (tag ?? colon)![1];
        value = (tag ?? colon)![2];
        speaker = names[prefix.replace(/（.*）$/, '')];
        if (!speaker || !value)
          throw Error('Unknown speaker/text ' + row.file + ':' + row.line + ' ' + text);
        speakerLabel = prefix;
        kind = /心聲|內心/.test(prefix) ? 'thought' : 'dialogue';
        if (!current.cast.includes(speaker)) current.cast.push(speaker);
      } else if (value.startsWith('「'))
        throw Error('Missing speaker ' + row.file + ':' + row.line);
      if (!value) throw Error('Empty prose ' + row.line);
      const segmentId = 'L' + String(current.segments.length + 1).padStart(3, '0');
      current.segments.push({
        id: segmentId,
        text: value,
        kind,
        visual: 'SCENE',
        ...(speaker ? { speaker, speakerLabel } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
      uses.push({ file: row.file, line: row.line, text: row.text, sceneId: current.id, segmentId });
    }
    for (const item of items) {
      if ('text' in item) {
        push(item);
        continue;
      }
      counter++;
      current.kind = 'choice';
      current.choiceMode = 'DIALOGUE_FLAVOR';
      current.segments.push({
        id: 'L' + String(current.segments.length + 1).padStart(3, '0'),
        text: item.question,
        kind: 'narration',
        speakerLabel: '選擇',
        visual: 'SCENE',
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
      const base = current.id,
        common = id + `_CH${number(counter)}_COMMON`;
      current.choices = item.branches.map((b, j) => ({
        id: 'ABC'[j],
        text: b.label,
        next: base + '_' + 'ABC'[j],
        effects: [],
      }));
      scenes.push(current);
      const commonCg = held;
      item.branches.forEach((b, j) => {
        current = make(base + '_' + 'ABC'[j], b.cg ?? commonCg);
        pending = b.cg;
        held = b.cg ?? commonCg;
        b.rows.forEach(push);
        if (!current.segments.length || pending) throw Error('Empty branch');
        current.next = common;
        scenes.push(current);
      });
      current = make(common, commonCg);
      held = commonCg;
    }
    if (pending) {
      // A closing cue displays on the final authored paragraph, before the separate end card.
      if (!current.segments.length || current.segments.at(-1)!.cg)
        throw Error('Unbound final CG ' + pending);
      current.segments.at(-1)!.cg = pending;
      pending = undefined;
    }
    if (!current.segments.length) throw Error('Empty common scene ' + id);
    if (num < 5) current.next = `EP03_ACT${number(act)}_SC${number(num + 1)}`;
    else {
      current.kind = 'end';
      current.segments.push({
        id: 'L' + String(current.segments.length + 1).padStart(3, '0'),
        text: `ACT ${['I', 'II', 'III', 'IV', 'V'][act - 1]} END。`,
        kind: 'caption',
        visual: 'BLACK',
      });
      current.completion = {
        title: `${act === 5 ? '第三章' : '第' + ['一', '二', '三', '四', '五'][act - 1] + '幕'}完 · ${ep03Titles[act - 1]}`,
        scope: act === 5 ? 'CHAPTER' : 'ACT',
        nextChapterId: act === 5 ? 'EP04' : 'EP03',
        policy: 'NO_SCORING',
        ...(act === 5
          ? { pendingLabel: 'EP04〈不得已攝政〉· 劇本尚未提供' }
          : {
              nextSceneId: `EP03_ACT${number(act + 1)}_SC01`,
              nextLabel: `ACT ${['I', 'II', 'III', 'IV', 'V'][act]}〈${ep03Titles[act]}〉`,
              continueLabel: `進入 EP03 第${['一', '二', '三', '四', '五'][act]}幕`,
            }),
      };
    }
    scenes.push(current);
  }
  return { scenes, roles: ep03Roles, uses };
}
