import { z } from 'zod';
import { CampaignPlanSchema } from '../../../../packages/narrative-core/campaign-schema';
import {
  ManifestSchema,
  ChapterFileSchema,
  AssetSchema,
  EndingRuleSchema,
  type Story,
} from '../../../../packages/narrative-core/schema';
import { validateStory } from '../../../../packages/narrative-core/validate';
import { prepareReaderStory } from '../../../../packages/narrative-core/reader-text';
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const json = async (path: string) => {
  const r = await fetch(assetUrl('content/' + path), { cache: 'no-cache' });
  if (!r.ok) throw Error(`無法讀取內容：${path} (${r.status})`);
  return r.json() as Promise<unknown>;
};
export async function loadStory(): Promise<Story> {
  const manifest = ManifestSchema.parse(await json('manifests/story.json'));
  const [assets, endings, characters, packs] = await Promise.all([
    json('manifests/assets.json'),
    json('endings/rules.json'),
    json('characters/index.json'),
    Promise.all(manifest.chapters.filter((c) => c.file).map((c) => json(c.file!))),
  ]);
  const scenes: Story['scenes'] = {};
  for (const p of packs) {
    const pack = ChapterFileSchema.parse(p);
    for (const s of pack.scenes) {
      if (scenes[s.id]) throw Error('場景 ID 重複');
      if (s.chapter !== pack.id || s.status !== pack.status) throw Error('章節與內容狀態不符');
      scenes[s.id] = s;
    }
  }
  const story = {
    plan: manifest.planningFile
      ? CampaignPlanSchema.parse(await json(manifest.planningFile))
      : undefined,
    manifest,
    scenes,
    assets: z.array(AssetSchema).parse(assets),
    endings: z.array(EndingRuleSchema).parse(endings),
    characters: z.record(z.string(), z.string()).parse(characters),
  };
  const checked = validateStory(story);
  if (checked.errors.length) throw Error(checked.errors.join('\n'));
  return prepareReaderStory(story);
}
