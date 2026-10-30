import { z } from 'zod';
import { CampaignStateSchema, type CampaignPlan } from './campaign-schema';
export const Scalar = z.union([z.boolean(), z.number().finite(), z.string()]);
export type ScalarValue = z.infer<typeof Scalar>;
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { path: string; op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists'; value?: ScalarValue };
export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z
    .union([
      z.object({ all: z.array(ConditionSchema).min(1) }).strict(),
      z.object({ any: z.array(ConditionSchema).min(1) }).strict(),
      z.object({ not: ConditionSchema }).strict(),
      z
        .object({
          path: z
            .string()
            .regex(
              /^(politicalRoute|tarotRoute|politicalScore|clear\.(alinda|finley|tamara|shalia)|flags\.[A-Z][A-Z0-9_]*)$/
            ),
          op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'exists']),
          value: Scalar.optional(),
        })
        .strict(),
    ])
    .superRefine((c, ctx) => {
      if ('path' in c && c.op !== 'exists' && c.value === undefined)
        ctx.addIssue({ code: 'custom', message: 'Comparison requires value' });
    })
);
export const EffectSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('flag'), key: z.string().regex(/^[A-Z][A-Z0-9_]*$/), value: Scalar })
    .strict(),
  z
    .object({
      type: z.literal('clear'),
      key: z.enum(['alinda', 'finley', 'tamara', 'shalia']),
      delta: z.number().int(),
    })
    .strict(),
  z.object({ type: z.literal('score'), delta: z.number().int() }).strict(),
  z.object({ type: z.literal('political'), value: z.enum(['SACRED', 'WORLD']) }).strict(),
  z.object({ type: z.literal('reinforce'), value: z.boolean() }).strict(),
]);
export const ChoiceSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    next: z.string().min(1),
    when: ConditionSchema.optional(),
    effects: z.array(EffectSchema).default([]),
  })
  .strict();
export const SegmentSchema = z
  .object({
    id: z.string().min(1),
    speaker: z.string().optional(),
    speakerLabel: z.string().optional(),
    kind: z.enum(['narration', 'dialogue', 'thought', 'caption']).optional(),
    visual: z.enum(['SCENE', 'BLACK']).optional(),
    text: z.string().min(1),
    when: ConditionSchema.optional(),
    cg: z.string().optional(),
    sfx: z.string().optional(),
  })
  .strict();
export const SceneSchema = z
  .object({
    id: z.string().min(1),
    chapter: z.string(),
    act: z.string(),
    sceneNumber: z.number().int().min(1).optional(),
    title: z.string(),
    pov: z.string(),
    cast: z.array(z.string()),
    kind: z.enum(['narrative', 'choice', 'result', 'end']),
    status: z.enum(['DEMO_ONLY', 'CANON', 'DRAFT']),
    playback: z.enum(['READER', 'CUTSCENE']).optional(),
    scoring: z.enum(['NONE', 'STORY_EFFECTS']).optional(),
    choiceMode: z.enum(['STORY', 'DIALOGUE_FLAVOR']).optional(),
    completionFlags: z.record(z.string().regex(/^[A-Z][A-Z0-9_]*$/), Scalar).optional(),
    completion: z
      .object({
        title: z.string(),
        nextChapterId: z.string(),
        policy: z.literal('NO_SCORING'),
        scope: z.enum(['CHAPTER', 'ACT']).optional(),
        nextSceneId: z.string().optional(),
        pendingLabel: z.string().optional(),
        nextLabel: z.string().optional(),
        continueLabel: z.string().optional(),
      })
      .strict()
      .optional(),
    directions: z
      .array(
        z
          .object({ beforeSegment: z.number().int().min(0), cue: z.string(), text: z.string() })
          .strict()
      )
      .optional(),
    source: z.string().min(1),
    version: z.string(),
    planNodeId: z.string().optional(),
    knowledge: z.object({ knows: z.array(z.string()), withheld: z.array(z.string()) }).strict(),
    segments: z.array(SegmentSchema).min(1),
    choices: z.array(ChoiceSchema).default([]),
    next: z.string().optional(),
    cg: z.string().optional(),
    bgm: z.string().optional(),
    imageWhen: ConditionSchema.optional(),
    presentation: z
      .object({
        fit: z.enum(['cover', 'contain']).default('cover'),
        focusX: z.number().min(0).max(100).default(50),
        focusY: z.number().min(0).max(100).default(50),
        zoom: z.number().min(1).max(1.3).default(1),
        panX: z.number().min(-5).max(5).default(0),
        fadeMs: z.number().min(0).max(3000).default(600),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((s, c) => {
    if (s.choiceMode && s.kind !== 'choice')
      c.addIssue({ code: 'custom', message: 'Choice mode requires a choice scene' });
    if (s.choiceMode === 'DIALOGUE_FLAVOR' && s.choices.some((choice) => choice.effects.length))
      c.addIssue({ code: 'custom', message: 'Flavor choices must have no gameplay effects' });
    if (s.playback === 'CUTSCENE' && (s.kind === 'choice' || s.choices.length))
      c.addIssue({ code: 'custom', message: 'Cutscenes forbid player choices' });
    if (s.completion && s.kind !== 'end')
      c.addIssue({ code: 'custom', message: 'Chapter completion requires end scene' });
    if (s.completionFlags && s.kind !== 'end')
      c.addIssue({ code: 'custom', message: 'Completion flags require an end scene' });
    if (s.kind === 'choice' && (s.pov !== 'OLIVIA' || s.chapter === 'EP12' || !s.choices.length))
      c.addIssue({
        code: 'custom',
        message: 'Choice requires Olivia POV, choices, and chapter before EP12',
      });
    if (s.kind !== 'choice' && s.choices.length)
      c.addIssue({ code: 'custom', message: 'Only choice scenes may contain choices' });
    if (s.kind === 'end' && s.next)
      c.addIssue({ code: 'custom', message: 'End may not have next' });
    if (s.kind === 'choice' && s.next)
      c.addIssue({ code: 'custom', message: 'Choice may not have unconditional next' });
    if (['narrative', 'result'].includes(s.kind) && !s.next)
      c.addIssue({ code: 'custom', message: 'Scene requires next' });
  });
export const StateSchema = z
  .object({
    campaign: CampaignStateSchema.optional(),
    schemaVersion: z.literal(2),
    contentVersion: z.string(),
    currentSceneId: z.string(),
    currentSegmentIndex: z.number().int().min(0),
    politicalRoute: z.enum(['NONE', 'SACRED', 'WORLD']),
    tarotRoute: z.enum(['NONE', 'STAR', 'CHARIOT', 'TOWER']),
    politicalScore: z.number().int().min(0),
    clear: z
      .object({
        alinda: z.number().int().min(0).max(7),
        finley: z.number().int().min(0).max(10),
        tamara: z.number().int().min(0).max(6),
        shalia: z.number().int().min(0).max(6),
      })
      .strict(),
    flags: z.record(z.string(), Scalar),
    decisionLog: z.array(z.string()),
    readSegments: z.array(z.string()),
    readChapters: z.array(z.string()),
    history: z.array(
      z
        .object({
          sceneId: z.string(),
          segmentId: z.string(),
          speaker: z.string().optional(),
          speakerLabel: z.string().optional(),
          text: z.string(),
        })
        .strict()
    ),
  })
  .strict();
export const EndingRuleSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    orientation: z.enum(['UPRIGHT', 'REVERSED']),
    grade: z.enum(['TRUE', 'GOOD', 'NORMAL', 'BAD', 'STRUCTURAL']),
    status: z.enum(['APPROVED', 'DRAFT', 'UNRESOLVED', 'DEMO_ONLY']),
    priority: z.number().int(),
    when: ConditionSchema.optional(),
    reason: z.string(),
    source: z.string(),
  })
  .strict();
export const AssetSchema = z
  .object({
    id: z.string(),
    type: z.enum(['cg', 'background', 'bgm', 'sfx']),
    src: z
      .string()
      .regex(/^assets\/[a-zA-Z0-9_./-]+$/)
      .refine((s) => !s.includes('..'), 'Unsafe asset path'),
    label: z.string(),
    status: z.enum(['PLACEHOLDER', 'APPROVED']),
    source: z.string(),
  })
  .strict();
export const ChapterSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['DEMO_ONLY', 'AVAILABLE', 'DRAFT_AVAILABLE', 'NOT_YET_AVAILABLE']),
    file: z
      .string()
      .regex(/^episodes\/[a-zA-Z0-9_./-]+\.json$/)
      .refine((s) => !s.includes('..'))
      .optional(),
    entry: z.string().optional(),
  })
  .strict();
export const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string(),
    start: z.string(),
    chapters: z.array(ChapterSchema),
    flags: z.record(z.string(), z.object({ initial: Scalar, description: z.string() }).strict()),
    migrations: z.record(z.string(), z.string()),
    planningFile: z
      .string()
      .regex(/^planning\/[a-zA-Z0-9_-]+\.json$/)
      .optional(),
  })
  .strict();
export const ChapterFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    version: z.string(),
    status: z.enum(['DEMO_ONLY', 'CANON', 'DRAFT']),
    source: z.string(),
    scenes: z.array(SceneSchema),
  })
  .strict();
export type GameState = z.infer<typeof StateSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type EndingRule = z.infer<typeof EndingRuleSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export interface Story {
  plan?: CampaignPlan;
  manifest: Manifest;
  scenes: Record<string, Scene>;
  assets: Asset[];
  endings: EndingRule[];
  characters: Record<string, string>;
}
