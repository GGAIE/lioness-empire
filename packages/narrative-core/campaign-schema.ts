import { z } from 'zod';

const ChapterId = z.string().regex(/^(PROLOGUE|EP(0[1-9]|1[0-2]))$/);
const SourceFile = z.string().regex(/^planning\/[A-Za-z0-9_.-]+\.md$/);
const SourceRef = z.object({ file: SourceFile, line: z.number().int().positive() }).strict();
export const PlanActSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1).max(5),
    label: z.string(),
    summary: z.string().min(1),
    decision: z.enum(['NONE', 'MAIN_SLOT', 'SIDE_SLOT']),
    authoringStatus: z.literal('NOT_AUTHORED'),
    source: SourceRef,
  })
  .strict();
export const StoryDecisionSchema = z
  .object({
    id: z.string().min(1),
    actId: z.string().min(1),
    source: z.string().min(1),
    pov: z.literal('OLIVIA'),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            status: z.enum(['PENDING', 'APPROVED']),
            cost: z.number().int().min(0).nullable(),
            resourceGain: z.number().int().min(0).nullable(),
            unrestDelta: z.number().int().nullable(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();
export const CampaignPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.literal('PART_I'),
    version: z.string(),
    status: z.literal('PLANNING_DRAFT'),
    choiceResolution: z.literal('AUTHORED_FIXED').default('AUTHORED_FIXED'),
    decisions: z.array(StoryDecisionSchema).default([]),
    source: z
      .object({
        file: SourceFile,
        sha256: z.string().length(64),
        version: z.string(),
        scope: z.string(),
      })
      .strict(),
    chapters: z
      .array(
        z
          .object({
            id: ChapterId,
            title: z.string(),
            order: z.number().int().min(0).max(12),
            summary: z.string(),
            notes: z.array(z.string()),
            next: ChapterId.nullable(),
            availability: z.literal('NOT_YET_AVAILABLE'),
            acts: z.array(PlanActSchema).min(1).max(5),
            source: SourceRef,
          })
          .strict()
      )
      .length(13),
    events: z
      .array(
        z
          .object({
            id: z.string().regex(/^[ASTF][1-8]$/),
            character: z.enum(['alinda', 'shalia', 'tamara', 'finley']),
            sourceName: z.string(),
            title: z.string(),
            chapters: z.array(ChapterId).min(1),
            parts: z
              .array(
                z
                  .object({
                    id: z.string(),
                    chapter: ChapterId,
                    actId: z.string(),
                    clearAward: z.number().int().min(0).nullable(),
                  })
                  .strict()
              )
              .min(1),
            entryStatus: z.enum(['PLANNED', 'UNRESOLVED']),
            entryNote: z.string(),
            source: SourceRef,
          })
          .strict()
      )
      .length(24),
    rules: z
      .object({
        resource: z
          .object({
            definition: z.string(),
            initial: z.number().int().min(0).nullable(),
            maximum: z.null(),
            insufficient: z.literal('UNRESOLVED'),
            zeroOutcome: z.literal('UNRESOLVED'),
            bands: z.array(
              z
                .object({
                  min: z.number().int().min(0),
                  max: z.number().int().max(100),
                  cost: z.number().int().min(0),
                })
                .strict()
            ),
            prologue: z.literal('NO_SCORING'),
            ep12: z.literal('UNRESOLVED'),
          })
          .strict(),
        unrest: z
          .object({
            min: z.literal(0),
            max: z.literal(100),
            initial: z.number().int().min(0).max(100).nullable(),
            changes: z.literal('UNRESOLVED'),
          })
          .strict(),
        clearCaps: z
          .object({
            alinda: z.literal(7),
            finley: z.literal(10),
            tamara: z.literal(6),
            shalia: z.literal(6),
          })
          .strict(),
        alliance: z.object({ chapter: z.literal('EP06'), act: z.literal(3) }).strict(),
        reinforcement: z.object({ chapter: z.literal('EP09'), act: z.literal(4) }).strict(),
        xi: z
          .object({
            route: z.literal('STAR'),
            requiredEvent: z.literal('A4'),
            requiredFlags: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
            commonGate: z.literal('UNRESOLVED'),
            nielsEntry: z.literal('UNRESOLVED'),
            fatherCaseRequired: z.literal(false),
            bloodlineProofRequired: z.literal(false),
          })
          .strict(),
      })
      .strict(),
    aliases: z.array(
      z
        .object({
          id: z.string(),
          existingName: z.string(),
          sourceName: z.string(),
          status: z.literal('REVIEW_REQUIRED'),
        })
        .strict()
    ),
    unresolved: z
      .array(z.object({ id: z.string(), summary: z.string(), source: SourceRef }).strict())
      .min(1),
  })
  .strict();
export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;
export type PlanChapter = CampaignPlan['chapters'][number];

const Receipt = z
  .object({
    chapter: ChapterId,
    unrest: z.number().int().min(0).max(100),
    cost: z.number().int().min(0),
  })
  .strict();
export const CampaignStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    planVersion: z.string(),
    mode: z.enum(['SANDBOX', 'PLAYER']),
    chapter: ChapterId.nullable(),
    act: z.number().int().min(1).max(5),
    completedChapters: z.array(ChapterId),
    politicalPoints: z.number().int().min(0).nullable(),
    unrest: z.number().int().min(0).max(100).nullable(),
    politicalRoute: z.enum(['NONE', 'SACRED', 'WORLD']),
    tarotRoute: z.enum(['NONE', 'STAR', 'CHARIOT', 'TOWER']),
    clear: z
      .object({
        alinda: z.number().int().min(0).max(7),
        finley: z.number().int().min(0).max(10),
        tamara: z.number().int().min(0).max(6),
        shalia: z.number().int().min(0).max(6),
      })
      .strict(),
    cooperation: z.record(z.string(), z.enum(['UNKNOWN', 'ACTIVE', 'LOST'])),
    upkeep: z.array(Receipt),
    decisions: z.array(z.string()),
    storyChoices: z.record(z.string(), z.string()).default({}),
    milestones: z.array(z.string()),
    eventParts: z.record(z.string(), z.enum(['SUCCEEDED', 'FAILED'])),
    nielsFailed: z.boolean(),
    facts: z.record(z.string(), z.union([z.boolean(), z.string()])),
    sealed: z.boolean(),
  })
  .strict();
export type CampaignState = z.infer<typeof CampaignStateSchema>;

export function validatePlan(plan: CampaignPlan): string[] {
  const errors: string[] = [],
    chapterIds = new Set<string>(),
    nodes = new Set<string>(),
    eventIds = new Set<string>();
  plan.chapters.forEach((ch, i) => {
    if (chapterIds.has(ch.id) || ch.order !== i)
      errors.push(`Duplicate/out-of-order chapter ${ch.id}`);
    chapterIds.add(ch.id);
    if (ch.next !== (plan.chapters[i + 1]?.id ?? null)) errors.push(`Broken chapter link ${ch.id}`);
    if (ch.id !== (i === 0 ? 'PROLOGUE' : `EP${String(i).padStart(2, '0')}`))
      errors.push(`Unexpected chapter ${ch.id}`);
    if (ch.acts.length !== (ch.id === 'PROLOGUE' ? 1 : 5))
      errors.push(`Invalid act count ${ch.id}`);
    ch.acts.forEach((act, j) => {
      if (
        nodes.has(act.id) ||
        act.number !== j + 1 ||
        act.id !== `${ch.id}_ACT${String(j + 1).padStart(2, '0')}`
      )
        errors.push(`Invalid plan node ${act.id}`);
      nodes.add(act.id);
      if ((ch.id === 'PROLOGUE' || ch.id === 'EP12' || act.number === 1) && act.decision !== 'NONE')
        errors.push(`Forbidden decision slot ${act.id}`);
      if (
        !['PROLOGUE', 'EP12'].includes(ch.id) &&
        act.number >= 2 &&
        act.number <= 4 &&
        act.decision !== 'MAIN_SLOT'
      )
        errors.push(`Missing main slot ${act.id}`);
    });
  });
  const decisionIds = new Set<string>();
  for (const decision of plan.decisions) {
    if (decisionIds.has(decision.id)) errors.push(`Duplicate story decision ${decision.id}`);
    decisionIds.add(decision.id);
    const act = plan.chapters.flatMap((c) => c.acts).find((a) => a.id === decision.actId);
    if (!act || act.decision === 'NONE')
      errors.push(`Forbidden story decision location ${decision.id}`);
    const optionIds = new Set<string>();
    for (const option of decision.options) {
      if (optionIds.has(option.id))
        errors.push(`Duplicate story option ${decision.id}:${option.id}`);
      optionIds.add(option.id);
      if (
        option.status === 'APPROVED' &&
        [option.cost, option.resourceGain, option.unrestDelta].some((v) => v === null)
      )
        errors.push(`Approved story option needs fixed values ${decision.id}:${option.id}`);
    }
  }
  const counts = { alinda: 0, shalia: 0, tamara: 0, finley: 0 };
  for (const e of plan.events) {
    if (eventIds.has(e.id)) errors.push(`Duplicate event ${e.id}`);
    eventIds.add(e.id);
    counts[e.character]++;
    if (
      e.parts.length !== e.chapters.length ||
      new Set(e.parts.map((p) => p.id)).size !== e.parts.length
    )
      errors.push(`Invalid parts ${e.id}`);
    e.parts.forEach((p, i) => {
      if (
        p.chapter !== e.chapters[i] ||
        !nodes.has(p.actId) ||
        !p.actId.startsWith(p.chapter + '_')
      )
        errors.push(`Invalid part location ${p.id}`);
      if (p.clearAward !== null && p.clearAward > plan.rules.clearCaps[e.character])
        errors.push(`Invalid milestone award ${p.id}`);
    });
    if (e.character === 'finley' && e.chapters.some((id) => id < 'EP04'))
      errors.push(`Finley starts before EP04 ${e.id}`);
  }
  if (JSON.stringify(counts) !== JSON.stringify({ alinda: 6, shalia: 5, tamara: 5, finley: 8 }))
    errors.push('Expected 6/5/5/8 character events');
  if (plan.events.find((e) => e.id === 'A4')?.chapters.join(',') !== 'EP09,EP10')
    errors.push('Niels must span EP09–EP10');
  let previous = -1;
  for (const b of plan.rules.resource.bands) {
    if (b.min !== previous + 1 || b.max < b.min) errors.push('Upkeep bands overlap or leave a gap');
    previous = b.max;
  }
  if (previous !== 100) errors.push('Upkeep bands must cover 0–100');
  return errors;
}
