import type { Scene } from '../packages/narrative-core/schema';

export const act03CompletionFlags = {
  OLIVIA_AT_CAPITAL: true,
  FINLEY_AT_CAPITAL_AS_ACADEMY_LIAISON: true,
  KING_HEALTH_INITIAL_BRIEFING_RECEIVED: true,
  AIVIS_EASTERN_DUTY_CONFIRMED: true,
  ROYAL_RECORDS_PRELIMINARY_REVIEW: true,
  OLIVIA_REGENCY_AUTHORITY: false,
};
const roles: Record<string, string> = {
  奧莉維亞: 'OLIVIA',
  芬利: 'FINLEY',
  艾維斯: 'AIVIS',
  內廷接待官: 'PALACE_RECEPTION',
  內廷人員: 'PALACE_STAFF',
};
const cgId = (num: string, image: string) => `EP01-ACT03-CG${num}-${image}`;
export function parseEp01Act03(markdown: string): {
  scenes: Scene[];
  roles: Record<string, string>;
} {
  const start = markdown.indexOf('# 第一部分｜完整劇本');
  const end = markdown.indexOf('# 第二部分｜20 張 CG');
  if (start < 0 || end <= start) throw Error('Missing ACT III narrative boundaries');
  const narrative = markdown.slice(start, end);
  const headings = [...narrative.matchAll(/^## SC(0[1-5])｜([^\r\n]+)\r?$/gm)];
  if (headings.length !== 5) throw Error('Expected five ACT III scenes');
  const scenes: Scene[] = [],
    usedRoles: Record<string, string> = {};
  function make(num: string, title: string, body: string, suffix = ''): Scene {
    const segments: Scene['segments'] = [],
      directions: NonNullable<Scene['directions']> = [];
    let pending: string | undefined;
    for (const raw of body.trim().split(/\r?\n\s*\r?\n/)) {
      const paragraph = raw.trim();
      const cg = paragraph.match(/^### \[CG ACT03-SC(\d{2})-(\d{2})\] (.+)$/);
      if (cg) {
        if (cg[1] !== num) throw Error(`Wrong CG source scene ${cg[0]}`);
        pending = cgId(num, cg[2]);
        directions.push({
          beforeSegment: segments.length,
          cue: 'CG',
          text: `${pending}｜${cg[3]}`,
        });
        continue;
      }
      if (
        !paragraph ||
        paragraph === '---' ||
        paragraph.startsWith('#### ') ||
        paragraph.startsWith('- **')
      )
        continue;
      if (/^\*\*(?:時間|地點|場景作用|→ |SC\d{2} END|ACT III END)/.test(paragraph)) {
        directions.push({ beforeSegment: segments.length, cue: '製作註記', text: paragraph });
        continue;
      }
      const line = paragraph.match(/^\*\*([^*]+)\*\*(?:（([^）]+)）)?：([\s\S]+)$/);
      if (!line) throw Error(`Unexpected ACT III prose: ${paragraph.slice(0, 90)}`);
      const [, name, tone, text] = line;
      const kind =
        name === '旁白'
          ? 'narration'
          : name === '幕尾字幕'
            ? 'caption'
            : name === '系統／玩家選項'
              ? 'narration'
              : 'dialogue';
      const speaker = kind === 'dialogue' ? roles[name] : undefined;
      if (kind === 'dialogue' && !speaker) throw Error(`Unknown ACT III speaker: ${name}`);
      if (speaker) usedRoles[speaker] = name;
      segments.push({
        id: `L${String(segments.length + 1).padStart(3, '0')}`,
        text: text.trim(),
        kind,
        visual: 'SCENE',
        speakerLabel: name === '系統／玩家選項' ? '選擇' : tone ? `${name}（${tone}）` : name,
        ...(speaker ? { speaker } : {}),
        ...(pending ? { cg: pending } : {}),
      });
      pending = undefined;
    }
    if (!segments.length || pending) throw Error(`Empty text/CG ${num}${suffix}`);
    return {
      id: `EP01_ACT03_SC${num}${suffix}`,
      chapter: 'EP01',
      act: 'ACT03',
      sceneNumber: Number(num),
      planNodeId: 'EP01_ACT03',
      title,
      pov: 'OLIVIA',
      cast: [...new Set(['OLIVIA', ...segments.flatMap((s) => (s.speaker ? [s.speaker] : []))])],
      kind: 'narrative',
      status: 'DRAFT',
      playback: 'READER',
      scoring: 'NONE',
      version: '0.3.0',
      source: `sources/ep01/source-act03-v0.3.md #SC${num}${suffix}`,
      knowledge: {
        knows: ['限於本幕對話與正式摘要；父王仍保有意識與決策權'],
        withheld: ['未經確認的醫療細節、攝政權及芬利深層秘密'],
      },
      segments,
      choices: [],
      directions,
      cg: segments[0].cg ?? cgId(num, '03'),
      presentation: { fit: 'contain', focusX: 50, focusY: 50, zoom: 1, panX: 0, fadeMs: 700 },
    };
  }
  headings.forEach((heading, index) => {
    const num = String(index + 1).padStart(2, '0');
    if (heading[1] !== num) throw Error('Unexpected ACT III scene order');
    const block = narrative.slice(heading.index! + heading[0].length, headings[index + 1]?.index);
    const firstCg = block.indexOf(`### [CG ACT03-SC${num}-01]`);
    if (firstCg < 0) throw Error(`Missing first CG ${num}`);
    const body = block.slice(firstCg);
    const branches = [...body.matchAll(/^#### 選 ([ABC])：([^\r\n]+)\r?$/gm)];
    if (!branches.length) {
      if (!['01', '05'].includes(num)) throw Error(`Missing source choice ${num}`);
      const scene = make(num, heading[2], body);
      if (num === '05') {
        scene.kind = 'end';
        scene.completionFlags = act03CompletionFlags;
        scene.completion = {
          title: '第三幕完 · 重返王都',
          nextChapterId: 'EP01',
          scope: 'ACT',
          pendingLabel: 'EP01 ACT IV〈有限的責任〉（暫名）· 劇本尚未提供',
          policy: 'NO_SCORING',
        };
      } else scene.next = 'EP01_ACT03_SC02';
      scenes.push(scene);
      return;
    }
    if (branches.length !== 3) throw Error(`Expected three responses at ${num}`);
    const commonAt = body.indexOf(`### [CG ACT03-SC${num}-04]`);
    if (commonAt < branches[2].index!) throw Error(`Missing common CG ${num}`);
    const initial = body.slice(0, branches[0].index);
    const options = [...initial.matchAll(/^- \*\*([ABC])：\*\*(.+)\r?$/gm)];
    if (options.length !== 3) throw Error(`Expected three choice labels ${num}`);
    const choice = make(num, heading[2], initial);
    choice.kind = 'choice';
    choice.choices = options.map((option, i) => {
      if (option[1] !== branches[i][1] || option[1] !== ['A', 'B', 'C'][i])
        throw Error('Choice/branch source mismatch');
      return {
        id: option[1],
        text: option[2].trim(),
        next: `${choice.id}_${option[1]}`,
        effects: [],
      };
    });
    scenes.push(choice);
    branches.forEach((branch, i) => {
      const node = make(
        num,
        heading[2],
        body.slice(branch.index! + branch[0].length, branches[i + 1]?.index ?? commonAt),
        `_${branch[1]}`
      );
      node.next = `${choice.id}_COMMON`;
      scenes.push(node);
    });
    const common = make(num, heading[2], body.slice(commonAt), '_COMMON');
    common.next = `EP01_ACT03_SC${String(index + 2).padStart(2, '0')}`;
    scenes.push(common);
  });
  return { scenes, roles: usedRoles };
}
