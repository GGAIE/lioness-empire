import { test, expect } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
test('the production password unlocks supplied sections and continues at zero points without charging', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: '其他選項', exact: true }).click();
  await page.getByLabel('劇情密碼', { exact: true }).fill('best');
  await page.getByRole('button', { name: '解鎖劇情', exact: true }).click();
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '章節目錄', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.locator('.directory-sections button:enabled')).toHaveCount(109);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const id = 'EP02_ACT05_SC05_COMMON',
    state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.campaign!.politicalPoints = 0;
  state.campaign!.unrest = 100;
  state.readChapters = ['EP01'];
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'free-reading-zero-points.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'zero-point fixture',
          savedAt: '2026-11-03',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('切換章節不扣點');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP03 第三章' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP03_ACT01_SC01');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '0'
  );
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
