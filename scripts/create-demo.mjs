// One-time scaffold generator. Do not rerun over authored content.
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
if (existsSync('content/manifests/story.json'))
  throw Error(
    'Scaffold already exists. Edit content files directly; generation will not overwrite authored work.'
  );
const write = (path, data) => {
  mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
};
const eq = (path, value) => ({ path, op: 'eq', value }),
  cmp = (path, op, value) => ({ path, op, value }),
  all = (...xs) => ({ all: xs }),
  any = (...xs) => ({ any: xs });
const flag = (name, value = true) => eq('flags.' + name, value),
  core = (name, op, value) => cmp('clear.' + name, op, value),
  route = (r) => eq('tarotRoute', r);
const flags = {
  DEMO_INSPECTED: false,
  DEMO_RESULT_SEEN: false,
  DEMO_DONE: false,
  EARLY_PS_ZERO: false,
  ARCHIVE_TRUTH_COMPLETE: false,
  ALINDA_TRUCE: false,
  CORONATION: 'UNRESOLVED',
  HISTORY_POLICY: 'UNRESOLVED',
  FINAL_AGREEMENT: false,
  ALINDA_SAFE_HAVEN: false,
  DRAGON_EMPRESS_TRUCE: false,
  KNIGHT_COUNCIL_READY: false,
  OLIVIA_SURRENDER_OFFER: false,
  FINAL_PEACE_TREATY_SIGNED: false,
  SUCCESSION_CONTEST: 'UNRESOLVED',
  POLITICAL_CAPTIVITY: 'UNRESOLVED',
  TOWER_SURVIVAL: 'UNRESOLVED',
  LATER_ASYLUM: false,
};
write('content/manifests/story.json', {
  schemaVersion: 1,
  version: '0.1.0-demo',
  start: 'DEMO_ACT01_SC01',
  chapters: [
    {
      id: 'DEMO',
      title: '序曲測試 · 尚未寫下的歷史',
      status: 'DEMO_ONLY',
      file: 'episodes/demo/chapter.json',
      entry: 'DEMO_ACT01_SC01',
    },
    ...[
      'PROLOGUE',
      ...Array.from({ length: 12 }, (_, i) => `EP${String(i + 1).padStart(2, '0')}`),
    ].map((id) => ({ id, title: id === 'PROLOGUE' ? '序章' : id, status: 'NOT_YET_AVAILABLE' })),
  ],
  flags: Object.fromEntries(
    Object.entries(flags).map(([k, v]) => [
      k,
      {
        initial: v,
        description: k.startsWith('DEMO_')
          ? '引擎示範專用，非正式設定'
          : 'v2 規則草案欄位；設定事件須由正式劇本確認',
      },
    ])
  ),
  migrations: { DEMO_OLD_START: 'DEMO_ACT01_SC01' },
});
write('content/characters/index.json', {
  NARRATOR: '旁白',
  OLIVIA: '奧莉薇雅',
  ALINDA: '艾琳達',
  FINLEY: '芬利',
  TAMARA: '塔娜拉',
  SHALIA: '莎莉雅',
  TALIA: '塔莉雅',
  AIVIS: '艾維斯',
});
const scene = (id, title, kind, segments, extra = {}) => ({
  id,
  chapter: 'DEMO',
  act: 'ACT01',
  title,
  kind,
  pov: 'OLIVIA',
  cast: ['OLIVIA'],
  status: 'DEMO_ONLY',
  source: '工程自製測試；不是正式劇本',
  version: '0.1.0',
  knowledge: { knows: ['此處為系統驗證用的假設情境'], withheld: ['正式章節劇情尚未匯入'] },
  segments: segments.map((text, i) => ({
    id: `L${i + 1}`,
    text,
    ...(i === 1 ? { speaker: 'OLIVIA' } : {}),
  })),
  choices: [],
  cg: 'demo-hall',
  presentation: { fit: 'cover', focusX: 50, focusY: 50, zoom: 1.04, panX: 1, fadeMs: 700 },
  ...extra,
});
const effect = (key, value = true) => ({ type: 'flag', key, value });
write('content/episodes/demo/chapter.json', {
  schemaVersion: 1,
  id: 'DEMO',
  version: '0.1.0',
  status: 'DEMO_ONLY',
  source: '工程驗證內容，與正式 EP01–EP12 隔離',
  scenes: [
    scene(
      'DEMO_ACT01_SC01',
      '尚未寫下的歷史',
      'narrative',
      [
        '這是一段 DEMO_ONLY 工程測試。眼前的議事廳、對話與選擇，皆不是正式 Canon。',
        '先讓一段文字、一個選擇，找到它們應該抵達的地方。',
        '桌上放著三份測試記錄。接下來的選項只驗證分支與資料流。',
      ],
      { next: 'DEMO_ACT01_SC02', bgm: 'demo-calm' }
    ),
    scene(
      'DEMO_ACT01_SC02',
      '三份記錄',
      'choice',
      ['請選擇一項測試操作。三條分支將在結果場景重新匯合。'],
      {
        choices: [
          {
            id: 'inspect',
            text: '查閱測試檔案',
            next: 'DEMO_BRANCH_ARCHIVE',
            effects: [effect('DEMO_INSPECTED'), { type: 'clear', key: 'finley', delta: 1 }],
          },
          {
            id: 'dispatch',
            text: '送出測試公文',
            next: 'DEMO_BRANCH_DISPATCH',
            effects: [{ type: 'clear', key: 'tamara', delta: 1 }],
          },
          {
            id: 'observe',
            text: '保留記錄，觀察結果',
            next: 'DEMO_BRANCH_OBSERVE',
            effects: [{ type: 'score', delta: 1 }],
          },
        ],
      }
    ),
    scene(
      'DEMO_BRANCH_ARCHIVE',
      '檔案測試',
      'narrative',
      ['檔案已被查閱。隱藏旗標已寫入；芬利 CLEAR 的變化僅用來驗證效果。'],
      { next: 'DEMO_RESULT', cg: 'demo-map' }
    ),
    scene(
      'DEMO_BRANCH_DISPATCH',
      '公文測試',
      'narrative',
      ['測試公文已送出。塔娜拉 CLEAR 的變化僅用來驗證效果。'],
      { next: 'DEMO_RESULT', cg: 'demo-terrace' }
    ),
    scene(
      'DEMO_BRANCH_OBSERVE',
      '觀察測試',
      'narrative',
      ['記錄已保留。PoliticalScore 的變化僅用來驗證狀態，正式遊戲不向玩家顯示數值。'],
      { next: 'DEMO_RESULT', cg: 'demo-map' }
    ),
    scene(
      'DEMO_RESULT',
      '另一個視角',
      'result',
      [
        '【Result Scene / NO CHOICE】芬利確認三條測試分支都能抵達這裡。',
        '這段視角沒有玩家決策；角色也沒有取得超出本場景知識邊界的資訊。',
      ],
      { pov: 'FINLEY', cast: ['FINLEY'], next: 'DEMO_FINAL_CHOICE', cg: 'demo-terrace' }
    ),
    scene(
      'DEMO_FINAL_CHOICE',
      '條件選項測試',
      'choice',
      ['最後一次測試：只有查閱過檔案的人，會看見額外的選項。'],
      {
        choices: [
          {
            id: 'confirm-archive',
            text: '確認檔案記錄並完成測試',
            when: flag('DEMO_INSPECTED'),
            next: 'DEMO_END',
            effects: [effect('DEMO_DONE'), effect('DEMO_RESULT_SEEN')],
          },
          {
            id: 'finish',
            text: '完成本次引擎測試',
            next: 'DEMO_END',
            effects: [effect('DEMO_DONE'), effect('DEMO_RESULT_SEEN')],
          },
        ],
      }
    ),
    scene(
      'DEMO_END',
      '測試的終點',
      'end',
      [
        'DEMO_ONLY · 測試完成。這不是三十個正式結局之一。',
        '你現在可以存檔、回看對話、檢查 CG 收藏，或重新開始另一條測試分支。',
      ],
      { cg: 'demo-map' }
    ),
  ],
});
mkdirSync('assets/cg', { recursive: true });
mkdirSync('assets/bgm', { recursive: true });
mkdirSync('assets/sfx', { recursive: true });
mkdirSync('assets/ui', { recursive: true });
for (const [from, to] of [
  ['hall.svg', 'cg/hall.svg'],
  ['terrace.svg', 'cg/terrace.svg'],
  ['map-cg.svg', 'cg/map.svg'],
  ['calm.wav', 'bgm/calm.wav'],
  ['resolve.wav', 'sfx/resolve.wav'],
])
  copyFileSync('../06_遊戲內核/media/test/' + from, 'assets/' + to);
write('content/manifests/assets.json', [
  ...[
    ['demo-hall', 'hall', '議事廳'],
    ['demo-terrace', 'terrace', '露臺'],
    ['demo-map', 'map', '測試輿圖'],
  ].map(([id, file, label]) => ({
    id,
    type: 'cg',
    src: `assets/cg/${file}.svg`,
    label: `${label} · PLACEHOLDER`,
    status: 'PLACEHOLDER',
    source: '既有內核自製 SVG 測試素材；不是正式 CG',
  })),
  {
    id: 'demo-calm',
    type: 'bgm',
    src: 'assets/bgm/calm.wav',
    label: '合成測試配樂',
    status: 'PLACEHOLDER',
    source: '既有內核自製合成測試 WAV',
  },
  {
    id: 'demo-chime',
    type: 'sfx',
    src: 'assets/sfx/resolve.wav',
    label: '合成測試音效',
    status: 'PLACEHOLDER',
    source: '既有內核自製合成測試 WAV',
  },
]);
const first = JSON.parse(
  (await import('node:fs')).readFileSync('content/episodes/demo/chapter.json', 'utf8')
);
first.scenes[5].segments[0].sfx = 'demo-chime';
write('content/episodes/demo/chapter.json', first);
const source = '00_專案入口/01_結局Resolver與測試案例_v2.md（規則草案）';
const rules = [],
  names = [
    '沒有名字的旅人',
    '好啦，我們都不是主角啦',
    '沒有證人的王國',
    '最後的聖母',
    '世界理論',
    '歌頌者',
    '被寫回條約',
    '失去韁繩',
    '光輝者',
    '最後一個知道的人',
    '輪到別人',
    '獅王編年史',
    '被供奉的人',
    '女王沒有明天',
    '最後守望',
    '權力的鴆毒',
    '沒有王冠的人',
    '看得見但到不了',
    '月下異說',
    '最明亮的位置',
    '所有名字都回來了',
    '國家不需要她',
  ];
const rule = (n, priority, when, grade, reason, status = 'DRAFT') =>
  rules.push({
    id: `ARCANA_${String(n).padStart(2, '0')}`,
    title: names[n],
    orientation: 'UPRIGHT',
    grade,
    status,
    priority,
    ...(when ? { when } : {}),
    reason,
    source,
  });
const keys = ['alinda', 'finley', 'tamara', 'shalia'];
const doubleZero = any(
  ...keys.flatMap((k, i) => keys.slice(i + 1).map((k2) => all(core(k, 'eq', 0), core(k2, 'eq', 0))))
);
const single = (key) =>
  all(core(key, 'eq', 0), ...keys.filter((k) => k !== key).map((k) => core(k, 'gt', 0)));
rule(6, 10, flag('EARLY_PS_ZERO'), 'BAD', 'Tower 生存段之前政治存續歸零；需由歷史事件設定旗標。');
rule(
  13,
  20,
  all(route('TOWER'), core('tamara', 'eq', 0)),
  'BAD',
  'Tower 塔娜拉支柱為零，硬失敗優先。'
);
rule(1, 30, doubleZero, 'BAD', '至少兩個核心支柱未建立。');
rule(
  0,
  40,
  all(
    route('TOWER'),
    core('tamara', 'gt', 0),
    flag('DRAGON_EMPRESS_TRUCE'),
    flag('KNIGHT_COUNCIL_READY'),
    flag('OLIVIA_SURRENDER_OFFER'),
    flag('FINAL_PEACE_TREATY_SIGNED')
  ),
  'GOOD',
  '愚者和平條約及騎士共治已成立。'
);
let p = 50;
for (const [r, key, n, title] of [
  ['STAR', 'alinda', 17, '天空聖者'],
  ['STAR', 'tamara', 19, '幽影危機'],
  ['STAR', 'shalia', 5, '遺落的聖光'],
  ['CHARIOT', 'alinda', 11, '墮落者綱要'],
  ['CHARIOT', 'tamara', 4, '第四倡議'],
  ['CHARIOT', 'shalia', 21, '大陸議會'],
  ['TOWER', 'alinda', 16, '第七決議案'],
  ['TOWER', 'shalia', 13, '死靈之歌'],
])
  rules.push({
    id: `REVERSED_${r}_${key.toUpperCase()}`,
    title,
    orientation: 'REVERSED',
    grade: 'NORMAL',
    status: 'DRAFT',
    priority: p++,
    when: all(route(r), core('finley', 'gte', 6), single(key)),
    reason: `${r}：芬利 ≥6，${key} 恰為唯一缺席的支柱。對應牌 ${n} 逆位。`,
    source,
  });
rule(9, 70, all(route('STAR'), single('finley')), 'BAD', '學院支柱未建立。');
rule(
  20,
  71,
  all(route('STAR'), single('alinda'), core('finley', 'lt', 6)),
  'BAD',
  '邊境支柱未建立且無逆位。'
);
rule(
  19,
  72,
  all(route('STAR'), single('tamara'), core('finley', 'lt', 6)),
  'BAD',
  '執行支柱未建立且無逆位。'
);
rule(
  10,
  73,
  all(route('STAR'), single('shalia'), core('finley', 'lt', 6)),
  'BAD',
  '地方支柱未建立且無逆位。'
);
rule(
  12,
  80,
  all(route('STAR'), cmp('politicalScore', 'lt', 45)),
  'BAD',
  'Star 最終政治存續低於45。'
);
// Consolidate multiple entry gates per ending in a single external rule.
rule(
  7,
  81,
  all(
    route('CHARIOT'),
    any(
      cmp('politicalScore', 'lt', 45),
      all(flag('SUCCESSION_CONTEST', 'LOST'), flag('POLITICAL_CAPTIVITY', 'CAPTIVE'))
    )
  ),
  'BAD',
  '低政治存續入口可測；LOST 的拘束分界尚未定案。',
  'UNRESOLVED'
);
rule(
  21,
  90,
  all(
    cmp('politicalScore', 'gte', 45),
    ...keys.map((k) => all(core(k, 'gte', 1), core(k, 'lte', 2)))
  ),
  'STRUCTURAL',
  '四支柱全在1–2，政治存續至少45。'
);
rule(
  11,
  100,
  all(
    route('STAR'),
    flag('HISTORY_POLICY', 'PUBLISH'),
    flag('ARCHIVE_TRUTH_COMPLETE'),
    core('alinda', 'gte', 4),
    flag('ALINDA_TRUCE'),
    flag('CORONATION', 'FORMAL'),
    flag('FINAL_AGREEMENT')
  ),
  'TRUE',
  'XI 是第二部唯一正式承接結局；真相、停戰、加冕及最終協議全部成立。'
);
rule(
  2,
  101,
  all(route('STAR'), flag('HISTORY_POLICY', 'SEAL'), flag('ARCHIVE_TRUTH_COMPLETE')),
  'NORMAL',
  '真相完整而封存。'
);
rule(
  5,
  102,
  all(
    route('STAR'),
    core('tamara', 'gt', 4),
    ...['alinda', 'finley', 'shalia'].map((k) => all(core(k, 'gte', 1), core(k, 'lte', 4)))
  ),
  'GOOD',
  '塔娜拉高完成度，其餘支柱1–4。'
);
rule(
  3,
  103,
  all(
    route('STAR'),
    core('shalia', 'gt', 4),
    ...['alinda', 'finley', 'tamara'].map((k) => all(core(k, 'gte', 1), core(k, 'lte', 4)))
  ),
  'GOOD',
  '莎莉雅高完成度，其餘支柱1–4。'
);
rule(18, 104, route('STAR'), 'NORMAL', 'Star 其他合法狀態。');
rule(
  17,
  74,
  all(
    route('CHARIOT'),
    any(
      ...keys.map(single),
      all(flag('SUCCESSION_CONTEST', 'LOST'), flag('POLITICAL_CAPTIVITY', 'FREE'))
    )
  ),
  'BAD',
  '單支柱缺席入口；LOST 但仍自由的分界需正式事件定案。',
  'UNRESOLVED'
);
rule(
  4,
  110,
  all(
    route('CHARIOT'),
    flag('SUCCESSION_CONTEST', 'WON'),
    core('finley', 'gte', 3),
    core('tamara', 'gte', 3)
  ),
  'GOOD',
  '政爭勝出且芬利、塔娜拉至少3；須先通過共通門檻。'
);
rule(
  15,
  111,
  all(
    route('CHARIOT'),
    any(flag('SUCCESSION_CONTEST', 'WON'), flag('SUCCESSION_CONTEST', 'COMPROMISE'))
  ),
  'NORMAL',
  '勝出或妥協，未達皇帝條件。'
);
rule(
  16,
  75,
  all(route('TOWER'), any(...keys.map(single), flag('TOWER_SURVIVAL', 'FAILED'))),
  'BAD',
  'Tower 單支柱缺席無逆位，或生存失敗。'
);
rule(
  8,
  120,
  all(route('TOWER'), core('alinda', 'gte', 4), flag('ALINDA_SAFE_HAVEN')),
  'GOOD',
  '艾琳達至少4且 Safe Haven 成立；完整生存 Gate 待事件核定。'
);
rule(
  14,
  121,
  all(route('TOWER'), core('alinda', 'gt', 0), flag('LATER_ASYLUM')),
  'NORMAL',
  '尚有庇護，未達 Safe Haven 好結局。'
);
// TOWER_SURVIVAL deliberately starts UNRESOLVED: missing facts cannot silently become failure or success.
write(
  'content/endings/rules.json',
  rules.sort((a, b) => a.priority - b.priority)
);
write('content/endings/demo.json', [
  {
    id: 'DEMO_COMPLETE',
    title: '測試的終點',
    orientation: 'UPRIGHT',
    grade: 'NORMAL',
    status: 'DEMO_ONLY',
    priority: 1,
    when: flag('DEMO_DONE'),
    reason: 'DEMO_ONLY 狀態與分支驗證完成；不屬於正式三十結局。',
    source: '工程測試',
  },
]);
write('content/canon/baseline.json', {
  version: 'v2.0',
  date: '2026-10-28',
  sources: ['00_專案入口/00_必讀_主參考聖經_v2.md', source],
  status: 'RULES_DRAFT',
  notes: [
    '正式劇情尚未匯入',
    'POLITICAL_CAPTIVITY 與 Tower 完整生存條件尚未核定',
    '所有正式結局規則皆為 DRAFT 或 UNRESOLVED，不會自動頒發正式結局',
  ],
});
for (const id of [
  'prologue',
  ...Array.from({ length: 12 }, (_, i) => `ep${String(i + 1).padStart(2, '0')}`),
]) {
  mkdirSync('content/episodes/' + id, { recursive: true });
  writeFileSync(
    'content/episodes/' + id + '/README.md',
    '# NOT_YET_AVAILABLE\n正式內容尚未依 v2 校驗匯入。\n'
  );
}
writeFileSync(
  'content/CHANGELOG.md',
  '# 劇情版本紀錄\n\n## 0.1.0-demo — 2026-10-29\n新增獨立 DEMO_ONLY 測試包；正式序章及 EP01–EP12 尚未匯入。v2 結局規則以草案供測試。\n'
);
