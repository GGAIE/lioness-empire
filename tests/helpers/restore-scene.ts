import type { Page } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';

// Exercise the real player import flow instead of shipping developer jump controls.
export async function restoreScene(page: Page, id: string) {
  const story = await loadReaderContent();
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'scene-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'fixture',
          title: 'reading fixture',
          savedAt: '2026-11-04',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
