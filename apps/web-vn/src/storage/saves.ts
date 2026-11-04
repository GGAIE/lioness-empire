import { openDB } from 'idb';
import { z } from 'zod';
import {
  StateSchema,
  type GameState,
  type Story,
} from '../../../../packages/narrative-core/schema';
import {
  initialState,
  visibleSegments,
  evaluate,
  applyEffects,
} from '../../../../packages/narrative-core/engine';
import { createCampaign } from '../../../../packages/narrative-core/campaign';
import { reviewedHistoryText } from '../../../../packages/narrative-core/reader-text';
import { CoverIdSchema, CoverRouteSchema } from '../engine/covers';
export const SettingsSchema = z
  .object({
    speed: z.number().min(0).max(100),
    fontSize: z.number().min(16).max(32),
    bgm: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    autoDelay: z.number().min(500).max(10000),
    musicTrack: z.string().max(100).default('story'),
    storyUnlocked: z.boolean().default(false),
    cover: CoverIdSchema.default('palace'),
  })
  .strict();
export type Settings = z.infer<typeof SettingsSchema>;
export const defaults: Settings = {
  speed: 28,
  fontSize: 22,
  bgm: 0.3,
  sfx: 0.4,
  autoDelay: 1800,
  musicTrack: 'story',
  storyUnlocked: false,
  cover: 'palace',
};
export const MetaSchema = z
  .object({
    read: z.array(z.string()),
    cg: z.array(z.string()),
    endings: z.array(z.string()),
    chapters: z.array(z.string()),
    completedRoutes: z.array(CoverRouteSchema).optional(),
  })
  .strict();
export type Meta = z.infer<typeof MetaSchema>;
export const emptyMeta: Meta = { read: [], cg: [], endings: [], chapters: [] };
export interface SaveRecord {
  slot: string;
  savedAt: string;
  title: string;
  thumbnail: string | null;
  state: unknown;
}
const SaveSchema = z
  .object({
    slot: z.string().max(100),
    savedAt: z.string().max(100),
    title: z.string().max(300),
    thumbnail: z
      .string()
      .max(500000)
      .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/)
      .nullable(),
    state: z.unknown(),
  })
  .strict();
const db = () =>
  openDB('lioness-empire-html5-v1', 1, {
    upgrade(d) {
      d.createObjectStore('saves', { keyPath: 'slot' });
      d.createObjectStore('preferences');
    },
  });
// Serializing writes prevents a slow autosave from overtaking a later state.
let queue: Promise<unknown> = Promise.resolve();
const write = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
};
export const saveGame = (record: SaveRecord) =>
  write(async () => {
    const d = await db();
    try {
      await d.put('saves', { ...record, state: StateSchema.parse(record.state) });
    } finally {
      d.close();
    }
  });
export const backupSave = (record: SaveRecord) =>
  write(async () => {
    const d = await db();
    try {
      await d.put('saves', {
        ...SaveSchema.parse(record),
        slot: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    } finally {
      d.close();
    }
  });
export async function getSaves(): Promise<SaveRecord[]> {
  await queue;
  const d = await db();
  try {
    return await d.getAll('saves');
  } finally {
    d.close();
  }
}
export const putPreference = (key: string, value: unknown) =>
  write(async () => {
    const d = await db();
    try {
      await d.put('preferences', value, key);
    } finally {
      d.close();
    }
  });
export async function getPreference(key: string): Promise<unknown> {
  const d = await db();
  try {
    return await d.get('preferences', key);
  } finally {
    d.close();
  }
}
export function restoreSave(input: unknown, story: Story): { state: GameState; notices: string[] } {
  let raw = input;
  const notices: string[] = [];
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw Error('存檔格式無效');
  const obj = raw as Record<string, unknown>;
  // Explicit legacy adapter for this HTML5 format only. Existing v0.3/Unity saves are preserved separately.
  if (obj.schemaVersion === 1) {
    raw = {
      ...obj,
      schemaVersion: 2,
      readChapters: obj.readChapters ?? [],
      readSegments: obj.readSegments ?? [],
      history: obj.history ?? [],
    };
    notices.push('存檔格式已由 v1 遷移至 v2。');
  }
  let state = StateSchema.parse(raw);
  if (state.contentVersion !== story.manifest.version)
    notices.push(
      `劇情版本不同：${state.contentVersion} → ${story.manifest.version}。請確認後載入；原存檔不會被覆寫。`
    );
  if (!story.scenes[state.currentSceneId]) {
    const to = story.manifest.migrations[state.currentSceneId];
    if (to) {
      notices.push(`場景已遷移：${state.currentSceneId} → ${to}`);
      state.currentSceneId = to;
      state.currentSegmentIndex = 0;
    } else {
      notices.push(
        `找不到舊場景 ${state.currentSceneId}，將以新遊戲狀態回到安全起點，保留已讀與回顧。原存檔仍可匯出。`
      );
      state = {
        ...initialState(story),
        readSegments: state.readSegments,
        readChapters: state.readChapters,
        history: state.history,
      };
    }
  }
  for (const [k, v] of Object.entries(story.manifest.flags)) {
    if (state.flags[k] === undefined) {
      state.flags[k] = v.initial;
      notices.push(`已加入新版旗標：${k}`);
    } else if (typeof state.flags[k] !== typeof v.initial) throw Error(`旗標型別不相容：${k}`);
  }
  const restoredScene = story.scenes[state.currentSceneId];
  if (restoredScene.availableWhen && !evaluate(state, restoredScene.availableWhen)) {
    if (!restoredScene.next || !story.scenes[restoredScene.next])
      throw Error('找不到可閱讀的接續位置。');
    state.currentSceneId = restoredScene.next;
    state.currentSegmentIndex = 0;
    notices.push('已移至目前進度可閱讀的位置。');
  }
  if (
    (state.tarotRoute === 'STAR' && state.politicalRoute !== 'SACRED') ||
    (state.tarotRoute === 'CHARIOT' && state.politicalRoute !== 'WORLD') ||
    (state.tarotRoute === 'TOWER' && state.politicalRoute === 'NONE')
  )
    throw Error('存檔路線互相矛盾');
  if (
    !state.campaign &&
    story.plan &&
    story.scenes[state.currentSceneId].chapter === 'PROLOGUE' &&
    story.scenes[state.currentSceneId].scoring === 'NONE'
  ) {
    state.campaign = { ...createCampaign(story.plan), mode: 'PLAYER', chapter: 'PROLOGUE' };
    notices.push(
      `已補入序幕初始狀態：政治點數 ${state.campaign.politicalPoints}、動盪 ${state.campaign.unrest}。此過場無計分。`
    );
  }
  state.contentVersion = story.manifest.version;
  // Imported mid-result saves must be able to honor their already chosen, deferred ledger.
  let settlementPreview = state;
  for (const item of story.scenes[state.currentSceneId].settlements ?? []) {
    if (evaluate(settlementPreview, item.when))
      settlementPreview = applyEffects(settlementPreview, item.effects);
  }
  const max = visibleSegments(story, state).length - 1;
  if (state.currentSegmentIndex > max) {
    state.currentSegmentIndex = Math.max(0, max);
    notices.push('段落已縮短，位置移至本場景最後一段。');
  }
  let refreshedSpeakers = 0,
    refreshedText = 0;
  state.history = state.history.map((entry) => {
    const segment = story.scenes[entry.sceneId]?.segments.find((s) => s.id === entry.segmentId);
    const text = reviewedHistoryText(entry.sceneId, entry.segmentId, entry.text);
    if (segment?.text === text && text !== entry.text) {
      refreshedText++;
      entry = { ...entry, text };
    }
    if (
      !segment ||
      segment.text !== entry.text ||
      (segment.speaker === entry.speaker && segment.speakerLabel === entry.speakerLabel)
    )
      return entry;
    refreshedSpeakers++;
    return { ...entry, speaker: segment.speaker, speakerLabel: segment.speakerLabel };
  });
  if (refreshedText) notices.push(`已潤飾 ${refreshedText} 段回顧的敘述，閱讀位置與選擇保留。`);
  if (refreshedSpeakers)
    notices.push(`已更新 ${refreshedSpeakers} 段回顧的說話者標記，正文與閱讀位置不變。`);
  return { state, notices };
}
export function parseImport(text: string, story: Story) {
  if (text.length > 5_000_000) throw Error('存檔超過 5 MB 限制');
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (parsed.format !== 'lioness-empire-save' || parsed.exportVersion !== 1)
    throw Error('不支援的匯出格式');
  const r = SaveSchema.parse(parsed.record);
  return { ...restoreSave(r.state, story), record: { ...r, state: r.state } };
}
export function exportSave(record: SaveRecord) {
  return JSON.stringify({ format: 'lioness-empire-save', exportVersion: 1, record }, null, 2);
}
export function mergeMeta(meta: Meta, state: GameState, cg?: string, ending?: string): Meta {
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  return {
    ...meta,
    read: union(meta.read, state.readSegments),
    cg: union(meta.cg, cg ? [cg] : []),
    endings: union(meta.endings, ending ? [ending] : []),
    chapters: union(meta.chapters, state.readChapters),
  };
}
