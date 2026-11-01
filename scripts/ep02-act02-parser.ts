import type { Scene } from '../packages/narrative-core/schema';
import voices from '../content/sources/ep02/act02-speakers-v1.1.json' with { type: 'json' };
export const act02Roles: Record<string, string> = {
  OLIVIA: '奧莉維亞',
  FINLEY: '芬利',
  COURT_OFFICER: '宮廷承辦官',
  ARCHIVE_OFFICER: '檔案官',
  ACADEMY_RESEARCHER: '學院研究人員',
};
const names: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  承辦官: 'COURT_OFFICER',
  官員: 'COURT_OFFICER',
  檔案官: 'ARCHIVE_OFFICER',
  年輕的奧莉維亞: 'OLIVIA',
  '芬利（回憶）': 'FINLEY',
  '奧莉維亞、芬利（同時）': 'OLIVIA',
  一位研究人員: 'ACADEMY_RESEARCHER',
};
const cgId = (num: string, img: string) => `EP02-ACT02-CG${num}-${img}`;
export function parseEp02Act02(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# 第一部分｜完整視覺小說劇本'),
    end = markdown.indexOf('# 第二部分｜20 張 CG');
  if (start < 0 || end <= start) throw Error('Missing ACT II screenplay bounds');
  const prose = markdown.slice(start, end),
    headings = [...prose.matchAll(/^## SC(0[1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT II source scenes');
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
      speaker?: string,
      label?: string
    ) {
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text,
        kind,
        visual: kind === 'caption' ? 'BLACK' : 'SCENE',
        ...(speaker ? { speaker, speakerLabel: label ?? act02Roles[speaker] } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
    }
    if (answer) push(answer, 'dialogue', 'OLIVIA');
    for (const raw of body.split(/\r?\n/)) {
      const p = raw.trim();
      if (!p || p === '---' || p.startsWith('【CHOICE ')) continue;
      const cg = p.match(/^### \[CG(\d{2})\] (.+)$/);
      if (cg) {
        if (pending) throw Error(`Unattached ACT II CG ${num}`);
        pending = cgId(num, cg[1]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pending}｜${cg[2]}`,
        });
        continue;
      }
      if (p.startsWith('（') && p.endsWith('）')) {
        directions.push({
          beforeSegment: segments.length,
          cue: '演出備註',
          text: p.replace(/\*\*/g, ''),
        });
        continue;
      }
      if (p === '畫面回到現在。' || p === '畫面回到桌上的附件。') {
        if (pending) throw Error('Overlapping ACT II reprise cue');
        pending = cgId(num, '01');
        directions.push({
          beforeSegment: segments.length,
          cue: '回到現在',
          text: `${p} ${pending}，重用本場既有現時CG，不新增圖片。`,
        });
        continue;
      }
      if (/^\*\*SC\d{2} END/.test(p)) {
        directions.push({
          beforeSegment: segments.length,
          cue: '場景銜接',
          text: p.replace(/\*\*/g, ''),
        });
        continue;
      }
      const text = p.replace(/\*\*/g, '');
      if (text === 'ACT II END。') {
        push(text, 'caption');
        continue;
      }
      if (text.startsWith('#')) throw Error(`Unexpected ACT II heading ${text}`);
      const prefix = text.match(/^([^：]+)：(「[\s\S]+」)$/)?.[1],
        name =
          prefix &&
          Object.keys(names)
            .sort((a, b) => b.length - a.length)
            .find((n) => prefix.startsWith(n));
      if (name) {
        const label =
          name === '年輕的奧莉維亞'
            ? '奧莉維亞（回憶）'
            : name.includes('（')
              ? name
              : act02Roles[names[name]];
        if (name.includes('同時'))
          directions.push({
            beforeSegment: segments.length,
            cue: '同步對白',
            text: '奧莉維亞與芬利同時認出；一個對白節點，雙人頭標，非一人先解說。',
          });
        push(
          prefix === name ? text.slice(prefix.length + 1) : text,
          'dialogue',
          names[name],
          label
        );
      } else push(text, 'narration');
    }
    if (question) push(question, 'narration');
    if (pending || !segments.length) throw Error(`Empty ACT II text/CG ${num}${suffix}`);
    const cast =
      num === '01'
        ? ['OLIVIA', 'FINLEY', 'COURT_OFFICER']
        : num === '02'
          ? ['OLIVIA', 'COURT_OFFICER']
          : num === '03'
            ? ['OLIVIA', 'ARCHIVE_OFFICER', 'FINLEY']
            : num === '04'
              ? ['OLIVIA', 'FINLEY', 'ARCHIVE_OFFICER']
              : ['OLIVIA', 'FINLEY', 'ACADEMY_RESEARCHER'];
    return {
      id: `EP02_ACT02_SC${num}${suffix}`,
      chapter: 'EP02',
      act: 'ACT02',
      sceneNumber: Number(num),
      planNodeId: 'EP02_ACT02',
      title,
      pov: 'OLIVIA',
      cast,
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: '1.1.0',
      source: `sources/ep02/source-act02-v1.1.md #SC${num}${suffix}`,
      knowledge: {
        knows: ['僅本幕合法可閱資料及本文對話；新增學院行政史與回憶為本稿提案'],
        withheld: [
          '尚未授予攝政、王令、預算、軍事或學院管理權；SOURCE_REQUIRED細節不作鎖定Canon；芬利私人盤算不揭露',
        ],
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
    if (h[1] !== num) throw Error('Unexpected ACT II scene order');
    const block = prose.slice(h.index! + h[0].length, headings[i + 1]?.index),
      first = block.indexOf('### [CG01]');
    if (first < 0) throw Error('Missing ACT II first CG');
    const body = block.slice(first),
      options = [...body.matchAll(/^\*\*([ABC])｜(「[^\r\n]+」)\*\*\s*\r?$/gm)],
      commonTag = `【COMMON A02-SC${num}】`,
      commonAt = body.indexOf(commonTag),
      question = body.match(/^【CHOICE A02-SC\d{2}｜([^】]+)】/m)?.[1];
    if (options.length !== 3 || commonAt < options[2].index! || !question)
      throw Error(`Invalid ACT II choice ${num}`);
    const choice = make(
      num,
      h[2],
      body.slice(0, options[0].index),
      '',
      cgId(num, '01'),
      undefined,
      question
    );
    choice.kind = 'choice';
    choice.choiceMode = 'DIALOGUE_FLAVOR';
    choice.choices = options.map((o, j) => {
      if (o[1] !== ['A', 'B', 'C'][j]) throw Error('Invalid ACT II option order');
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
    const common = make(num, h[2], body.slice(commonAt + commonTag.length), '_COMMON', held);
    if (num === '05') {
      common.kind = 'end';
      common.completion = {
        title: '第二幕完 · 王冠之外的責任',
        scope: 'ACT',
        nextChapterId: 'EP02',
        policy: 'NO_SCORING',
        nextSceneId: 'EP02_ACT03_SC01',
        nextLabel: 'ACT III〈久別重逢〉',
        continueLabel: '進入 EP02 第三幕',
      };
    } else common.next = `EP02_ACT02_SC${String(i + 2).padStart(2, '0')}`;
    scenes.push(common);
  });
  for (const row of voices.annotations) {
    const scene = scenes.find((s) => s.id === row.sceneId),
      p = scene?.segments.find((p) => p.id === row.segmentId);
    if (!p || p.text !== row.text || !scene?.cast.includes(row.speaker))
      throw Error(`ACT II speaker assignment needs review: ${row.sceneId}/${row.segmentId}`);
    p.speaker = row.speaker;
    p.speakerLabel = row.speakerLabel;
    p.kind = row.kind as 'dialogue' | 'thought';
  }
  return { scenes, roles: act02Roles };
}
