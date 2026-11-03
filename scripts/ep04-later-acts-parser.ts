import type { Scene, Condition, Effect } from '../packages/narrative-core/schema';
import review from '../content/sources/ep04/later-act-anchors.json' with { type: 'json' };

export const ep04LaterRoles: Record<string, string> = {
  OLIVIA: '奧莉維亞',
  FINLEY: '芬利',
  FAID: '法伊德',
  ELLA: '艾拉',
  ALINDA: '艾琳達',
  ELVIR: '艾爾維爾',
  TAMARA: '塔馬拉',
  SHALIA: '莎莉雅',
  MARKET_VENDOR: '攤主',
  JUNIOR_CLERK: '年輕官員',
  CARTER: '車夫',
  RELIEF_WORKER: '救濟工作者',
  COMMERCE_CLERK: '櫃台職員',
  MERCHANT_DELEGATE: '商會代表',
  SENIOR_MERCHANT: '年長商人',
  LOCAL_MEDIATOR: '地方人士',
  GUILD_LEADER: '行會領袖',
  LOCAL_GENTRY: '地方士紳',
  RECORDS_CLERK: '承辦官員',
  LIBRARY_CLERK: '圖書館職員',
  GORM: '剛姆',
  COURT_SENIOR_OFFICIAL: '高級官員',
};
const voices: Record<string, string> = {
  奧莉薇雅: 'OLIVIA',
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  塔馬拉: 'TAMARA',
  莎莉雅: 'SHALIA',
  櫃台職員: 'COMMERCE_CLERK',
  職員: 'COMMERCE_CLERK',
  商會代表: 'MERCHANT_DELEGATE',
  代表遲疑: 'MERCHANT_DELEGATE',
  年長商人: 'SENIOR_MERCHANT',
  地方人士: 'LOCAL_MEDIATOR',
  行會領袖: 'GUILD_LEADER',
  地方士紳: 'LOCAL_GENTRY',
  承辦官員: 'RECORDS_CLERK',
  圖書館職員: 'LIBRARY_CLERK',
  剛姆: 'GORM',
  高級官員: 'COURT_SENIOR_OFFICIAL',
};
export const f1State = (value: string): Condition => ({
  path: 'flags.FINLEY_RESEARCH_F1_STATE',
  op: 'eq',
  value,
});
export const f1Started: Condition = {
  any: ['ACTIVE', 'MATERIAL_OBTAINED', 'CLEARED'].map(f1State),
};
export const f1Available: Condition = { any: ['MATERIAL_OBTAINED', 'CLEARED'].map(f1State) };
const clean = (s: string) => s.trim().replace(/\*\*/g, '');
const titles = { 3: '各自的難題', 4: '空缺的十五席', 5: '誰讓他們坐在那裡' };
const starts = { 3: [1, 5, 10, 15, 21], 4: [1, 3, 5, 7, 9, 12], 5: [1, 6, 11, 16, 21] };
export const laterCg = (act: number, n: number) =>
  `EP04-ACT0${act}-CG${String(n).padStart(2, '0')}`;
type Row = { text: string; line: number };

export function connectEp04LaterActs(scenes: Scene[]) {
  for (const act of [2, 3, 4]) {
    const next = `EP04_ACT0${act + 1}_SC01`;
    if (!scenes.some((s) => s.id === next)) continue;
    const end = scenes.find((s) => s.chapter === 'EP04' && s.act === `ACT0${act}` && s.completion);
    if (!end?.completion) throw Error('Missing prior act completion');
    delete end.completion.pendingLabel;
    Object.assign(end.completion, {
      nextSceneId: next,
      nextLabel: `${['', '', '', '第三幕', '第四幕', '第五幕'][act + 1]}〈${titles[(act + 1) as 3 | 4 | 5]}〉`,
      continueLabel: `進入${['', '', '', '第三幕', '第四幕', '第五幕'][act + 1]}`,
    });
  }
}

export function parseEp04LaterAct(markdown: string, act: 3 | 4 | 5) {
  const cutoff =
    act === 4
      ? markdown.indexOf('## Scene／CG 對應')
      : act === 5
        ? markdown.indexOf('# 製作附錄 A')
        : markdown.length;
  if (cutoff < 0) throw Error('Missing screenplay boundary');
  const rows = markdown
    .slice(0, cutoff)
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }));
  const headings = rows.flatMap((r, i) => {
    const m =
      act === 5
        ? r.text.match(/^## 第([一二三四五])場｜(.+)$/)
        : r.text.match(new RegExp(`^${act === 3 ? '#' : '##'} SC(0[1-6])｜(.+)$`));
    if (!m) return [];
    const number = act === 5 ? '一二三四五'.indexOf(m[1]) + 1 : Number(m[1]);
    return [{ index: i, number, title: m[2].replace(/【F1.*$/, '') }];
  });
  if (headings.length !== (act === 4 ? 6 : 5)) throw Error('Unexpected scene count');
  for (const row of review.anchors.filter((r) => r.act === act))
    if (rows[row.line - 1]?.text !== row.text) throw Error('CG anchor source changed ' + row.line);
  if (act === 3)
    for (const row of review.speakers)
      if (rows[row.line - 1]?.text !== row.text) throw Error('Speaker source changed ' + row.line);
  const scenes: Scene[] = [],
    uses: { sceneId: string; segmentId: string; line: number; text: string; origin: string }[] = [];
  for (const [hi, h] of headings.entries()) {
    if (h.number !== hi + 1) throw Error('Scene order changed');
    const id = `EP04_ACT0${act}_SC0${h.number}`;
    let body = rows.slice(h.index + 1, headings[hi + 1]?.index);
    if (act === 3) {
      const begin = body.findIndex(
        (r) =>
          r.text === (h.number === 5 ? '## A 路線｜若 ACT02 已同意幫助芬利研究' : '## 場景正文')
      );
      if (begin < 0) throw Error('Missing scene body');
      body = body.slice(begin + 1);
    }
    const make = (suffix: string, image: string): Scene => ({
      id: id + suffix,
      chapter: 'EP04',
      act: `ACT0${act}`,
      sceneNumber: h.number,
      title: h.title,
      pov: 'OLIVIA',
      cast: ['OLIVIA'],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      source: `sources/ep04/source-act0${act}-v${act === 4 ? '1.1' : '1.0'}.md #SC0${h.number}${suffix}`,
      version: act === 4 ? '1.1.0' : '1.0.0',
      planNodeId: `EP04_ACT0${act}`,
      knowledge: {
        knows: ['僅本幕已呈現的觀察、合法紀錄與當事人說法。'],
        withheld: ['不把關係索引當成犯罪定案，不提前重建議會或揭露芬利未表露的野心。'],
      },
      cg: image,
      segments: [],
      choices: [],
      directions: [],
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    });
    let current = make('', laterCg(act, starts[act][hi]));
    let held = current.cg!,
      pending: string | undefined;
    function push(row: Row, when?: Condition, origin = 'BODY') {
      const text = clean(row.text);
      if (!text || text === '---') return;
      const marker = text.match(/^【CG(\d{2})｜/);
      if (marker) {
        if (pending) throw Error('CG without prose');
        pending = held = laterCg(act, Number(marker[1]));
        current.directions!.push({ beforeSegment: current.segments.length, cue: 'CG', text: held });
        return;
      }
      if (/^(#|> |POV：|結果：|系統結算：|本幕結果：|ACT03 結束|第五幕終|畫面暗下)/.test(text)) {
        current.directions!.push({
          beforeSegment: current.segments.length,
          cue: '來源製作註記',
          text,
        });
        return;
      }
      const cue = review.anchors.find((r) => r.act === act && r.line === row.line);
      if (cue) {
        if (pending) throw Error('Conflicting CG');
        pending = held = laterCg(act, cue.image);
      }
      const voice = text.match(/^([^：]+)：(「.+」)$/);
      const thought = voice?.[1].includes('（心聲）');
      const name = voice?.[1].replace('（心聲）', '');
      const reviewed = act === 3 ? review.speakers.find((r) => r.line === row.line) : undefined;
      const inline = act === 4 && text.startsWith('離開時，一名商會秘書') ? 'OLIVIA' : undefined;
      const speaker = reviewed?.speaker ?? (name ? voices[name] : undefined) ?? inline;
      if ((voice || text.startsWith('「')) && !speaker)
        throw Error('Unassigned speech ' + row.line + ' ' + text);
      if (speaker && !current.cast.includes(speaker)) current.cast.push(speaker);
      const segmentId = 'L' + String(current.segments.length + 1).padStart(3, '0');
      current.segments.push({
        id: segmentId,
        text: voice && name && voices[name] ? voice[2] : text,
        kind: speaker ? (thought ? 'thought' : 'dialogue') : 'narration',
        visual: 'SCENE',
        ...(speaker
          ? { speaker, speakerLabel: ep04LaterRoles[speaker] + (thought ? '（心聲）' : '') }
          : {}),
        ...(pending ? { cg: pending } : {}),
        ...(when ? { when } : {}),
      });
      pending = undefined;
      uses.push({ sceneId: current.id, segmentId, line: row.line, text: row.text, origin });
    }
    if (act === 3 && h.number === 5) {
      const b = body.findIndex((r) => r.text.startsWith('## B 路線'));
      const common = body.findIndex((r) => r.text === '## 共通收束');
      if (b < 0 || common < b) throw Error('Missing F1 branches');
      body.slice(0, b).forEach((r) => push(r, f1Started));
      body.slice(b + 1, common).forEach((r) => push(r, { not: f1Started }));
      body.slice(common + 1).forEach((r) => push(r));
      current.completionEffects = {
        when: f1State('ACTIVE'),
        effects: [{ type: 'flag', key: 'FINLEY_RESEARCH_F1_STATE', value: 'MATERIAL_OBTAINED' }],
      };
    } else if ((act === 3 && h.number <= 3) || act === 5) {
      const question = body.findIndex((r) =>
        r.text.startsWith(act === 3 ? '### 選項' : '### 玩家選擇')
      );
      const common = body.findIndex(
        (r) => r.text === (act === 3 ? '### 選項後共通正文' : '### 共同後續')
      );
      const options = body.flatMap((r, i) => {
        const m =
          act === 3
            ? clean(r.text).match(/^([12])\. (「.+」)$/)
            : clean(r.text).match(/^選項([一二三四])：(「.+」)$/);
        return m
          ? [
              {
                index: i,
                id: act === 3 ? m[1] : String('一二三四'.indexOf(m[1]) + 1),
                text: m[2],
                line: r.line,
              },
            ]
          : [];
      });
      if (
        question < 0 ||
        common < question ||
        options.length !== (act === 3 ? 2 : h.number === 5 ? 4 : 3)
      )
        throw Error('Unexpected choice layout');
      body.slice(0, question).forEach((r) => push(r));
      current.kind = 'choice';
      current.choiceMode = act === 5 && h.number >= 4 ? 'STORY' : 'DIALOGUE_FLAVOR';
      current.scoring = current.choiceMode === 'STORY' ? 'STORY_EFFECTS' : 'NONE';
      current.choices = options.map((o, i) => {
        const delta =
          act === 5 && h.number === 4
            ? [10, 5, 0][i]
            : act === 5 && h.number === 5
              ? [15, 5, 0, -5][i]
              : 0;
        const effects: Effect[] = delta ? [{ type: 'points', delta }] : [];
        return { id: o.id, text: o.text, next: id + '_' + o.id, effects };
      });
      if (!current.segments.length || pending) throw Error('Empty choice');
      scenes.push(current);
      const branchCg = held;
      options.forEach((o, i) => {
        current = make('_' + o.id, branchCg);
        held = branchCg;
        if (act === 3) {
          push({ text: '奧莉薇雅：' + o.text, line: o.line }, undefined, 'OPTION');
          current.directions!.push({
            beforeSegment: 0,
            cue: '來源選項說明',
            text: body
              .slice(o.index + 1, options[i + 1]?.index ?? common)
              .map((r) => r.text)
              .join('\n'),
          });
        } else body.slice(o.index + 1, options[i + 1]?.index ?? common).forEach((r) => push(r));
        if (!current.segments.length || pending) throw Error('Empty response');
        current.next = id + '_COMMON';
        scenes.push(current);
      });
      current = make('_COMMON', branchCg);
      held = branchCg;
      body.slice(common + 1).forEach((r) => push(r));
    } else body.forEach((r) => push(r));
    if (pending || !current.segments.length) throw Error('Empty scene or unplaced CG');
    if (act === 4 && h.number === 4)
      current.conditionalNext = { when: f1Available, next: 'EP04_ACT04_SC05' };
    if (act === 4 && h.number === 5) {
      current.availableWhen = f1Available;
      current.scoring = 'STORY_EFFECTS';
      current.completionEffects = {
        when: f1State('MATERIAL_OBTAINED'),
        effects: [
          { type: 'points', delta: 20 },
          { type: 'flag', key: 'FINLEY_RESEARCH_F1_STATE', value: 'CLEARED' },
        ],
      };
    }
    if (hi < headings.length - 1)
      current.next =
        act === 4 && h.number === 4 ? 'EP04_ACT04_SC06' : `EP04_ACT0${act}_SC0${h.number + 1}`;
    else {
      current.kind = 'end';
      current.segments.push({
        id: 'L' + String(current.segments.length + 1).padStart(3, '0'),
        text: '＊　＊　＊',
        kind: 'caption',
        visual: 'BLACK',
      });
      current.completion = {
        title: `${act === 3 ? '第三幕完' : act === 4 ? '第四幕完' : '第四章完'} · ${titles[act]}`,
        scope: act === 5 ? 'CHAPTER' : 'ACT',
        nextChapterId: act === 5 ? 'EP05' : 'EP04',
        policy: 'NO_SCORING',
        pendingLabel: act === 5 ? '第五章〈攝政成為習慣〉· 劇本尚未提供' : '後續待接續',
      };
    }
    scenes.push(current);
  }
  return { scenes, uses, roles: ep04LaterRoles };
}
