import { z } from 'zod';
import {
  CampaignPlanSchema,
  CampaignStateSchema,
} from '../packages/narrative-core/campaign-schema';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  SceneSchema,
  ChoiceSchema,
  StateSchema,
  ManifestSchema,
  EndingRuleSchema,
  ChapterFileSchema,
  AssetSchema,
} from '../packages/narrative-core/schema';
await mkdir('schemas', { recursive: true });
for (const [name, schema] of Object.entries({
  Scene: SceneSchema,
  Choice: ChoiceSchema,
  GameState: StateSchema,
  Manifest: ManifestSchema,
  EndingRule: EndingRuleSchema,
  Chapter: ChapterFileSchema,
  Asset: AssetSchema,
  CampaignPlan: CampaignPlanSchema,
  CampaignState: CampaignStateSchema,
}))
  await writeFile(
    `schemas/${name}.schema.json`,
    JSON.stringify({ ...z.toJSONSchema(schema, { target: 'draft-7' }), title: name }, null, 2) +
      '\n'
  );
console.log('Exported 9 JSON Schema files for narrative and campaign tools.');
