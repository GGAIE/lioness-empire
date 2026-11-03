import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CampaignPlanSchema } from '../packages/narrative-core/campaign-schema';
import { prepareReaderStory } from '../packages/narrative-core/reader-text';
import {
  ManifestSchema,
  AssetSchema,
  EndingRuleSchema,
  ChapterFileSchema,
  type Story,
} from '../packages/narrative-core/schema';
export const root = resolve(import.meta.dirname, '..');
export const readJson = async (path: string) =>
  JSON.parse(await readFile(resolve(root, 'content', path), 'utf8')) as unknown;
export const loadReaderContent = async () => prepareReaderStory(await loadContent());
export async function loadContent(): Promise<Story> {
  const manifest = ManifestSchema.parse(await readJson('manifests/story.json'));
  const scenes: Story['scenes'] = {};
  for (const ch of manifest.chapters)
    if (ch.file) {
      const pack = ChapterFileSchema.parse(await readJson(ch.file));
      if (pack.id !== ch.id) throw Error(`Chapter ID mismatch ${ch.id}`);
      for (const s of pack.scenes) {
        if (scenes[s.id]) throw Error(`Duplicate scene ${s.id}`);
        if (s.chapter !== ch.id || pack.status !== s.status)
          throw Error(`Chapter/status mismatch ${s.id}`);
        scenes[s.id] = s;
      }
    }
  return {
    plan: manifest.planningFile
      ? CampaignPlanSchema.parse(await readJson(manifest.planningFile))
      : undefined,
    manifest,
    scenes,
    assets: z.array(AssetSchema).parse(await readJson('manifests/assets.json')),
    endings: z.array(EndingRuleSchema).parse(await readJson('endings/rules.json')),
    characters: z.record(z.string(), z.string()).parse(await readJson('characters/index.json')),
  };
}
