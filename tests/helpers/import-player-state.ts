import { expect, type Page } from '@playwright/test';
import type { GameState } from '../../packages/narrative-core/schema';
export async function importPlayerState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep05-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'fixture',
          title: 'EP05 fixture',
          savedAt: '2026-11-05',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
