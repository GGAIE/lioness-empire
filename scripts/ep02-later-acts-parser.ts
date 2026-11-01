import type { Scene } from '../packages/narrative-core/schema';
export const laterActTitles: Record<number, string> = {
  3: '久別重逢',
  4: '公主的客人們',
  5: '王冠之外的道路',
};
const names: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  艾爾維爾: 'ELVIR',
  艾維斯: 'AIVIS',
  塔馬拉: 'TAMARA',
  莎莉亞: 'SHALIA',
  莎莉雅: 'SHALIA',
  艾琳達: 'ALINDA',
  雅瑟: 'ARTHUR',
  雷昂德: 'LEONARD',
  諾雷拉: 'NORELA',
  軍需官: 'QUARTERMASTER',
  領主代表: 'LOCAL_DELEGATE',
  侍從: 'PRO_ATTENDANT',
  宮廷事務官: 'COURT_OFFICER',
  魔法守衛: 'MAGIC_GUARD',
};
export const laterActRoles = Object.fromEntries(Object.entries(names).map(([n, id]) => [id, n]));
export function parseEp02LaterAct(markdown: string, act: 3 | 4 | 5) {
  const cutoff = act === 3 ? '## 三、逐張 CG' : act === 4 ? '# 二、CG 英文' : '# CG 製作包';
  if (!markdown.includes(cutoff)) throw Error('Missing screenplay boundary');
  const prose = markdown.slice(0, markdown.indexOf(cutoff));
  const headings = [...prose.matchAll(/^#{2,3} SC(0[1-5])(?:〈([^\r\n]+)〉|｜([^\r\n]+))\s*$/gm)];
  if (headings.length !== 5) throw Error('Expected five source scenes');
  const actId = 'ACT' + String(act).padStart(2, '0'),
    scenes: Scene[] = [];
  const source = 'sources/ep02/update-1031/' + actId.toLowerCase() + '-source.md';
  const cgId = (scene: string, image: string) => 'EP02-' + actId + '-CG' + scene + '-' + image;
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
    let pending: string | undefined,
      currentImage = baseCg,
      storyVoice = false;
    const push = (
      text: string,
      kind: 'dialogue' | 'thought' | 'narration' | 'caption',
      speaker?: string,
      label?: string
    ) => {
      segments.push({
        id: 'L' + String(segments.length + 1).padStart(3, '0'),
        text,
        kind,
        visual: kind === 'caption' ? 'BLACK' : 'SCENE',
        ...(speaker ? { speaker, speakerLabel: label } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
    };
    // Observation/focus options in ACT V SC03-SC05 are not spoken aloud.
    if (answer && (act !== 5 || Number(num) <= 2)) push(answer, 'dialogue', 'OLIVIA', '奧莉維亞');
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line === '---') continue;
      const anchor =
        line.match(/^#{3,4} \[CG_INSERT: EP02_ACT0[34]_SC\d{2}_CG(\d{2})\] (.+)$/) ??
        line.match(/^### 【CG(\d{2})】(.+)$/);
      if (anchor) {
        if (pending) throw Error('CG without prose');
        pending = currentImage = cgId(num, anchor[1]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: currentImage + '｜' + anchor[2],
        });
        continue;
      }
      if (/^\*\*(?:\[RESULT|Scene End|ACT [IVX]+ END)/.test(line)) {
        directions.push({
          beforeSegment: segments.length,
          cue: '來源場景結果',
          text: line.replace(/\*\*/g, ''),
        });
        continue;
      }
      if (line.startsWith('### 《國王的影子》')) {
        directions.push({
          beforeSegment: segments.length,
          cue: '說書開始',
          text: '芬利連續講述完整童話；寓言角色引語仍由芬利說書。',
        });
        storyVoice = true;
        continue;
      }
      if (line.startsWith('#') || line.startsWith('**'))
        throw Error('Unexpected screenplay instruction: ' + line);
      const text = line.replace(/\*\*/g, '').replace(/^\*([^*]+)\*$/, '$1');
      const tag = text.match(/^【([^】]+)】(.*)$/);
      if (tag) {
        if (['旁白', '回憶旁白'].includes(tag[1])) {
          storyVoice = false;
          if (tag[2]) push(tag[2], 'narration');
          continue;
        }
        const id = names[tag[1].replace(/^年輕的/, '')];
        if (!id || !tag[2]) throw Error('Unrecognized source voice ' + text);
        push(
          tag[2],
          'dialogue',
          id,
          tag[1].startsWith('年輕的') ? tag[1].slice(3) + '（回憶）' : tag[1]
        );
        continue;
      }
      const spoken = text.match(/^([^：]+)：(「[\s\S]+」)$/);
      if (spoken) {
        const prefix = spoken[1],
          plain = prefix.replace(/^年少的/, '').replace(/（.*）$/, '');
        const id = names[plain];
        if (!id) throw Error('Unrecognized speaker ' + prefix);
        const remembered =
          act === 5 &&
          (currentImage.endsWith('-02') ||
            currentImage.endsWith('-18') ||
            currentImage.endsWith('-19'));
        const label = prefix.startsWith('年少的')
          ? '奧莉維亞（幼年回憶）'
          : prefix.includes('（')
            ? prefix
            : remembered
              ? plain + '（回憶）'
              : plain;
        push(spoken[2], prefix.includes('內心') ? 'thought' : 'dialogue', id, label);
      } else if (
        act === 5 &&
        (storyVoice || currentImage.endsWith('-23') || currentImage.endsWith('-24')) &&
        text.startsWith('「')
      ) {
        push(text, 'dialogue', 'FINLEY', '芬利（說書）');
      } else {
        if (text.startsWith('「')) throw Error('Unassigned dialogue ' + text);
        push(text, 'narration');
      }
    }
    if (question) {
      push(question, 'narration');
      segments.at(-1)!.speakerLabel = '選擇';
    }
    if (pending || !segments.length) throw Error('Missing prose at ' + num + suffix);
    return {
      id: 'EP02_' + actId + '_SC' + num + suffix,
      chapter: 'EP02',
      act: actId,
      sceneNumber: Number(num),
      planNodeId: 'EP02_' + actId,
      title,
      pov: 'OLIVIA',
      cast: [...new Set(['OLIVIA', ...segments.flatMap((p) => (p.speaker ? [p.speaker] : []))])],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: act === 5 ? '1.1.0' : '1.0.0',
      source: source + ' #SC' + num + suffix,
      knowledge: {
        knows: ['僅本幕對話、合法可閱資訊與回憶；寓言不是現實法術。'],
        withheld: ['未授攝政、軍權或政治派系；候選記憶旗標不提升為正式路線Gate；P2未解決。'],
      },
      segments,
      choices: [],
      directions,
      cg: baseCg,
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i],
      num = h[1],
      title = h[2] ?? h[3];
    if (Number(num) !== i + 1) throw Error('Incorrect scene order');
    const block = prose.slice(h.index! + h[0].length, headings[i + 1]?.index);
    const first = block.search(/^#{3,4} (?:\[CG_INSERT:|【CG)/m);
    if (first < 0) throw Error('Missing first CG');
    const body = block.slice(first);
    const marker =
      act === 5
        ? /^### 〈玩家選項 SC\d{2}〉([^\r\n]+)/m
        : /^\*\*\[CHOICE SC\d{2}_Q1：([^\]\r\n]+)\]\*\*/m;
    const question = body.match(marker);
    const options = [...body.matchAll(/^(?:- )?\*\*([ABC])｜([^\r\n]+?)\*\*(?:[^\r\n]*)$/gm)];
    const merge = body.match(
      act === 5 ? /^\*\*【分支合流】\*\*/m : /^\*\*\[MERGE SC\d{2}_Q1\]\*\*/m
    );
    const count = act === 3 && num === '01' ? 2 : 3;
    if (!question || !merge || options.length !== count)
      throw Error('Invalid choice layout ' + num);
    const base = body.match(
      /^#{3,4} (?:\[CG_INSERT: EP02_ACT0[34]_SC\d{2}_CG(\d{2})\]|【CG(\d{2})】)/m
    )!;
    const choice = make(
      num,
      title,
      body.slice(0, question.index),
      '',
      cgId(num, base[1] ?? base[2]),
      undefined,
      question[1]
    );
    choice.kind = 'choice';
    choice.choiceMode = 'DIALOGUE_FLAVOR';
    const held = choice.segments.filter((p) => p.cg).at(-1)!.cg!;
    choice.choices = options.map((o, j) => {
      if (o[1] !== 'ABC'[j]) throw Error('Option order');
      return { id: o[1], text: o[2], next: choice.id + '_' + o[1], effects: [] };
    });
    scenes.push(choice);
    options.forEach((o, j) => {
      const branch = make(
        num,
        title,
        body.slice(o.index! + o[0].length, options[j + 1]?.index ?? merge.index),
        '_' + o[1],
        held,
        o[2]
      );
      branch.next = choice.id + '_COMMON';
      scenes.push(branch);
    });
    const common = make(num, title, body.slice(merge.index! + merge[0].length), '_COMMON', held);
    if (act === 5 && num === '03') common.completionFlags = { AIVIS_DEPARTED_EASTERN_FRONT: true };
    if (num === '05') {
      common.kind = 'end';
      common.segments.push({
        id: 'L' + String(common.segments.length + 1).padStart(3, '0'),
        kind: 'caption',
        visual: 'BLACK',
        text: 'ACT ' + { 3: 'III', 4: 'IV', 5: 'V' }[act] + ' END。',
      });
      common.completion = {
        title:
          act === 5
            ? '第二章完 · 留下來的人'
            : { 3: '第三', 4: '第四', 5: '第五' }[act] + '幕完 · ' + laterActTitles[act],
        scope: act === 5 ? 'CHAPTER' : 'ACT',
        nextChapterId: act === 5 ? 'EP03' : 'EP02',
        policy: 'NO_SCORING',
        ...(act === 5
          ? { pendingLabel: 'EP03〈責任先於權力〉· 劇本尚未提供' }
          : {
              nextSceneId: 'EP02_ACT0' + (act + 1) + '_SC01',
              nextLabel: 'ACT ' + (act === 3 ? 'IV' : 'V') + '〈' + laterActTitles[act + 1] + '〉',
              continueLabel: '進入 EP02 第' + (act === 3 ? '四' : '五') + '幕',
            }),
      };
    } else common.next = 'EP02_' + actId + '_SC' + String(i + 2).padStart(2, '0');
    scenes.push(common);
  }
  return { scenes, roles: laterActRoles };
}
