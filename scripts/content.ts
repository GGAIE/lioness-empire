import { access, cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { loadContent, root, readJson } from './load-content';
import { z } from 'zod';
import { EndingRuleSchema } from '../packages/narrative-core/schema';
import { validateStory } from '../packages/narrative-core/validate';
import { auditSpeakers } from './speaker-annotations';
import { prepareReaderStory } from '../packages/narrative-core/reader-text';
import {
  advance,
  choose,
  continueChapter,
  initialState,
  visibleChoices,
  visibleSegments,
} from '../packages/narrative-core/engine';
const story = await loadContent();
const report = validateStory(story);
const speakerAudit = auditSpeakers(story);
const readerStory = prepareReaderStory(story);
const outOfStory =
  /\bACT\b|ACT\s*\d|\bEP\d|\bSC\d|\bCG\b|上一章|下一章|本章|上一幕|下一幕|本幕|畫面轉到|分支合流|SOURCE_REQUIRED|PROPOSAL|鏡頭|畫面漸暗/iu;
for (const scene of Object.values(readerStory.scenes)) {
  if (scene.status === 'DEMO_ONLY') continue;
  for (const item of [...scene.segments, ...scene.choices])
    if (outOfStory.test(item.text))
      report.errors.push(`Out-of-story reader text ${scene.id}/${item.id}`);
}
report.errors.push(...speakerAudit.errors);
await writeFile(
  resolve(root, 'docs/speaker-audit-report.json'),
  JSON.stringify(speakerAudit, null, 2) + '\n'
);
if (story.plan) {
  try {
    const bytes = await readFile(resolve(root, 'content', story.plan.source.file));
    if (createHash('sha256').update(bytes).digest('hex') !== story.plan.source.sha256)
      report.errors.push(
        'Planning source checksum changed; re-import the source instead of silently using stale architecture.'
      );
    const length = bytes.toString('utf8').split(/\r?\n/).length;
    const references = [
      ...story.plan.chapters.flatMap((c) => [c.source, ...c.acts.map((a) => a.source)]),
      ...story.plan.events.map((e) => e.source),
      ...story.plan.unresolved.map((q) => q.source),
    ];
    if (references.some((ref) => ref.file !== story.plan!.source.file || ref.line > length))
      report.errors.push('Invalid planning source reference');
  } catch {
    report.errors.push('Missing planning source file');
  }
}
const demoRules = z.array(EndingRuleSchema).parse(await readJson('endings/demo.json'));
report.errors.push(...validateStory({ ...story, endings: demoRules }).errors);
if (demoRules.some((r) => r.status !== 'DEMO_ONLY'))
  report.errors.push('Demo ending rules must stay DEMO_ONLY');
if (story.endings.some((r) => r.status === 'DEMO_ONLY'))
  report.errors.push('Canon ending rules may not contain demo awards');
for (const a of story.assets)
  try {
    await access(resolve(root, a.src));
  } catch {
    report.errors.push(`Missing file ${a.src}`);
  }
// Bounded executable branch exploration. This verifies this content, not all hypothetical imported states.
const pending = story.manifest.chapters
    .filter((c) => c.entry)
    .map((c) => initialState({ ...story, manifest: { ...story.manifest, start: c.entry! } })),
  seen = new Set<string>();
let ends = 0;
const flavorDecisions = new Set(
  Object.values(story.scenes)
    .filter((s) => s.choiceMode === 'DIALOGUE_FLAVOR')
    .map((s) => s.id)
);
// EP03 adds five complete acts; keep a bounded, exhaustive content graph check.
while (pending.length && seen.size < 60000) {
  const s = pending.pop()!;
  const key = JSON.stringify([
    s.currentSceneId,
    s.currentSegmentIndex,
    s.flags,
    s.clear,
    s.politicalRoute,
    s.tarotRoute,
    s.campaign,
    s.readChapters,
    // Flavor history is saved for replay UI, but cannot affect future story conditions.
    // Validation forbids returning to a flavor choice, so common nodes can be merged.
    s.decisionLog.filter((entry) => !flavorDecisions.has(entry.slice(0, entry.lastIndexOf(':')))),
  ]);
  if (seen.has(key)) continue;
  seen.add(key);
  try {
    const scene = story.scenes[s.currentSceneId];
    if (scene.kind === 'end' && s.currentSegmentIndex === visibleSegments(story, s).length - 1) {
      ends++;
      if (scene.completion?.nextSceneId) pending.push(continueChapter(story, s));
      continue;
    }
    if (s.currentSegmentIndex < visibleSegments(story, s).length - 1 || scene.next)
      pending.push(advance(story, s));
    else {
      const choices = visibleChoices(story, s);
      if (!choices.length) report.errors.push(`Conditional dead-end ${scene.id}`);
      for (const c of choices) pending.push(choose(story, s, c.id));
    }
  } catch (e) {
    report.errors.push(String(e));
  }
}
if (pending.length) report.errors.push('Exploration limit reached; verification incomplete');
const full = {
  ...report,
  exploredStates: seen.size,
  endStates: ends,
  explorationComplete: pending.length === 0,
  canonEndings: story.endings.length,
  approvedCanonEndings: story.endings.filter((r) => r.status === 'APPROVED').length,
  planning: story.plan
    ? {
        version: story.plan.version,
        chapters: story.plan.chapters.length,
        acts: story.plan.chapters.flatMap((c) => c.acts).length,
        events: story.plan.events.length,
        eventParts: story.plan.events.flatMap((e) => e.parts).length,
        unresolved: story.plan.unresolved.length,
      }
    : null,
  unavailableChapters: story.manifest.chapters
    .filter((c) => c.status === 'NOT_YET_AVAILABLE')
    .map((c) => c.id),
};
await mkdir(resolve(root, 'docs'), { recursive: true });
await writeFile(resolve(root, 'docs/content-report.json'), JSON.stringify(full, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      scenes: full.scenes,
      errors: full.errors,
      warningCount: full.warnings.length,
      exploredStates: full.exploredStates,
      endStates: ends,
      canonEndings: full.canonEndings,
      approvedCanonEndings: full.approvedCanonEndings,
      planning: full.planning,
    },
    null,
    2
  )
);
if (report.errors.length) process.exitCode = 1;
else {
  await mkdir(resolve(root, 'apps/web-vn/public'), { recursive: true });
  await cp(resolve(root, 'content'), resolve(root, 'apps/web-vn/public/content'), {
    recursive: true,
  });
  await cp(resolve(root, 'assets'), resolve(root, 'apps/web-vn/public/assets'), {
    recursive: true,
  });
  // Publish the reviewed reading edition; raw screenplay imports remain intact.
  for (const chapter of readerStory.manifest.chapters.filter((c) => c.file)) {
    const pack = (await readJson(chapter.file!)) as { scenes: unknown[] };
    pack.scenes = Object.values(readerStory.scenes).filter((s) => s.chapter === chapter.id);
    await writeFile(
      resolve(root, 'apps/web-vn/public/content', chapter.file!),
      JSON.stringify(pack, null, 2) + '\n'
    );
  }
  await writeFile(
    resolve(root, 'apps/web-vn/public/content/manifests/story.json'),
    JSON.stringify(readerStory.manifest, null, 2) + '\n'
  );
}
