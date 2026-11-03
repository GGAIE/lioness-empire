import type { Scene } from '../packages/narrative-core/schema';

export const ep04Act02Roles = { OLIVIA: '奧莉維亞', FINLEY: '芬利', TEA_ATTENDANT: '侍從' };
const speakers: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  侍從: 'TEA_ATTENDANT',
};
const clean = (s: string) => s.trim().replace(/\*\*/g, '');
const starts = [1, 5, 9, 13, 18, 22];
const cg = (n: number) => {
  const scene = starts.filter((start) => n >= start).length - 1;
  return `EP04-ACT02-CG0${scene + 1}-${String(n - starts[scene] + 1).padStart(2, '0')}`;
};
export function connectEp04Act02(scenes: Scene[]) {
  if (!scenes.some((s) => s.id === 'EP04_ACT02_SC01')) return;
  const end = scenes.find((s) => s.id === 'EP04_ACT01_SC05_COMMON');
  if (!end?.completion) throw Error('Missing first-act ending');
  delete end.completion.pendingLabel;
  Object.assign(end.completion, {
    nextSceneId: 'EP04_ACT02_SC01',
    nextLabel: '第二幕〈薩克迪之亡〉',
    continueLabel: '進入第二幕',
  });
}
export function parseEp04Act02(markdown: string) {
  const begin = markdown.indexOf('## 三、完整劇情');
  const end = markdown.indexOf('## 四、CG 美術');
  if (begin < 0 || end < begin) throw Error('Missing ACT02 screenplay boundary');
  const rows = markdown
    .slice(0, end)
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }));
  const headings = rows.flatMap((r, i) => {
    const m = r.text.match(/^### SC(0[1-6])｜(.+)$/);
    return m ? [{ index: i, number: Number(m[1]), title: m[2] }] : [];
  });
  if (headings.length !== 6) throw Error('Expected six ACT02 scenes');
  const scenes: Scene[] = [];
  const uses: { sceneId: string; segmentId: string; line: number; text: string }[] = [];
  for (const [hi, h] of headings.entries()) {
    if (h.number !== hi + 1) throw Error('Unexpected scene order');
    const id = `EP04_ACT02_SC0${h.number}`;
    const body = rows.slice(h.index + 1, headings[hi + 1]?.index);
    const question = body.findIndex((r) => /^CH0[1-6]｜/.test(clean(r.text)));
    const common = body.findIndex((r) => clean(r.text) === '【共同匯合】');
    const options = body.flatMap((r, i) => {
      const t = clean(r.text);
      const m =
        h.number < 6 ? t.match(/^- ([ABC])(「.+?」)\s+(.+)$/) : t.match(/^選項 ([12])｜(「.+」)$/);
      return m ? [{ index: i, letter: m[1], text: m[2], response: m[3] }] : [];
    });
    if (
      question < 0 ||
      common < question ||
      options.map((o) => o.letter).join('') !== (h.number === 6 ? '12' : 'ABC')
    )
      throw Error('Invalid choice layout ' + id);
    const make = (suffix: string, image: string): Scene => ({
      id: id + suffix,
      chapter: 'EP04',
      act: 'ACT02',
      sceneNumber: h.number,
      title: h.title,
      pov: 'OLIVIA',
      cast: ['OLIVIA', 'FINLEY'],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      source: `sources/ep04/source-act02-v1.0.md #SC0${h.number}${suffix}`,
      version: '1.0.0',
      planNodeId: 'EP04_ACT02',
      knowledge: {
        knows: ['五年前共同研究與制度內耗假說，尚未取得關鍵資料。'],
        withheld: ['不將重建影像當成已證實史實；不提前演出後續取得資料與守衛答謝。'],
      },
      cg: image,
      segments: [],
      choices: [],
      directions: [],
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    });
    let current = make('', cg(starts[hi]));
    let held = current.cg!,
      pending: string | undefined;
    function push(row: { text: string; line: number }) {
      const text = clean(row.text);
      if (!text || text === '---') return;
      const marker = text.match(/^【CG(\d{2})｜/);
      if (marker) {
        if (pending) throw Error('CG without prose ' + pending);
        pending = held = cg(Number(marker[1]));
        current.directions!.push({ beforeSegment: current.segments.length, cue: 'CG', text: held });
        return;
      }
      if (/^(場景：|參與者：|說明：|→ SC|- 工程效果：|【ACT02 END)/.test(text)) {
        current.directions!.push({
          beforeSegment: current.segments.length,
          cue: '來源製作註記',
          text,
        });
        return;
      }
      if (/^(#|【|CH0|選項 )/.test(text)) throw Error('Unexpected production marker ' + text);
      const voice = text.match(/^(奧莉維亞|芬利|侍從)：(「.+」)$/);
      const inline = voice ? null : text.match(/^(奧莉維亞|芬利|侍從).+?：「/);
      const name = voice?.[1] ?? inline?.[1];
      const quote = text.startsWith('> ');
      if (text.startsWith('「') && !name) throw Error('Unassigned speech ' + text);
      const segmentId = 'L' + String(current.segments.length + 1).padStart(3, '0');
      const speaker = name ? speakers[name] : undefined;
      if (speaker && !current.cast.includes(speaker)) current.cast.push(speaker);
      current.segments.push({
        id: segmentId,
        text: voice ? voice[2] : quote ? text.slice(2) : text,
        kind: speaker ? 'dialogue' : quote ? 'caption' : 'narration',
        visual: 'SCENE',
        ...(speaker ? { speaker, speakerLabel: name === '侍從' ? '侍從（門外）' : name } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
      uses.push({ sceneId: current.id, segmentId, line: row.line, text: row.text });
    }
    body.slice(0, question).forEach(push);
    current.kind = 'choice';
    current.choiceMode = h.number === 6 ? 'STORY' : 'DIALOGUE_FLAVOR';
    current.scoring = h.number === 6 ? 'STORY_EFFECTS' : 'NONE';
    current.choices = options.map((o) => ({
      id: o.letter,
      text: o.text,
      next: id + '_' + o.letter,
      effects:
        h.number === 6
          ? [
              ...(o.letter === '1' ? [{ type: 'points' as const, delta: -10 }] : []),
              {
                type: 'flag' as const,
                key: 'FINLEY_RESEARCH_F1_STATE',
                value: o.letter === '1' ? 'ACTIVE' : 'DECLINED',
              },
            ]
          : [],
    }));
    if (pending || !current.segments.length) throw Error('Empty choice');
    scenes.push(current);
    const branchCg = held;
    options.forEach((o, i) => {
      current = make('_' + o.letter, branchCg);
      held = branchCg;
      if (h.number < 6) {
        push({ text: '奧莉維亞：' + o.text, line: body[o.index].line });
        // Compact source rows may contain two speakers; keep the action clauses
        // and give each utterance its own explicit character header.
        const responses = o.response.match(/(?:奧莉維亞|芬利|侍從)[^「]*「[^」]*」/g);
        if (!responses || responses.join('') !== o.response)
          throw Error('Unknown response ' + o.response);
        responses.forEach((text: string) => push({ text, line: body[o.index].line }));
      } else body.slice(o.index + 1, options[i + 1]?.index ?? common).forEach(push);
      if (pending || !current.segments.length) throw Error('Empty branch');
      current.next = id + '_COMMON';
      scenes.push(current);
    });
    current = make('_COMMON', branchCg);
    held = branchCg;
    body.slice(common + 1).forEach(push);
    if (pending || !current.segments.length) throw Error('Empty common');
    if (h.number < 6) current.next = `EP04_ACT02_SC0${h.number + 1}`;
    else {
      current.kind = 'end';
      current.segments.push({
        id: 'L' + String(current.segments.length + 1).padStart(3, '0'),
        text: '＊　＊　＊',
        kind: 'caption',
        visual: 'BLACK',
      });
      current.completion = {
        title: '第二幕完 · 薩克迪之亡',
        scope: 'ACT',
        nextChapterId: 'EP04',
        policy: 'NO_SCORING',
        pendingLabel: '第三幕〈各自的說法〉· 劇本尚未提供',
      };
    }
    scenes.push(current);
  }
  const cues = scenes.flatMap((s) => s.segments).flatMap((p) => (p.cg ? [p.cg] : []));
  if (cues.length !== 25 || new Set(cues).size !== 25) throw Error('Expected all 25 CGs');
  return { scenes, uses, roles: ep04Act02Roles };
}
