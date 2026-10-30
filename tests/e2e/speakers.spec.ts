import { test, expect } from '@playwright/test';
import { loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
test('speaker corrections appear in the reader and old history while quotations and narration stay unlabelled', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const story = await loadContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT02_SC04' },
  });
  state.currentSegmentIndex = 12;
  state.contentVersion = '0.7.0-ep01-act05-v0.4';
  state.history = [
    {
      sceneId: 'EP01_ACT05_SC01',
      segmentId: 'L004',
      text: story.scenes.EP01_ACT05_SC01.segments[3].text,
    },
  ];
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'old-speakers.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'Old headers',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await expect(page.getByRole('alertdialog', { name: '確認存檔遷移' })).toContainText(
    '已更新 1 段回顧的說話者標記'
  );
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText('法伊德');
  await expect(page.getByTestId('dialogue-text')).toContainText('法伊德又問');
  await page.getByRole('button', { name: '回顧', exact: true }).click();
  const old = page
    .locator('.history article')
    .filter({ has: page.getByText('「北翼還沒消息？」她問。', { exact: true }) });
  await expect(old.locator('span')).toHaveText('奧莉維亞');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  async function jump(id: string, index: number) {
    await page.getByRole('button', { name: '開發', exact: true }).click();
    await page.getByLabel('開發場景跳轉').selectOption(id);
    for (let i = 0; i < index; i++)
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    await expect(page.getByTestId('dialogue-text')).toHaveText(
      story.scenes[id].segments[index].text
    );
  }
  await jump('EP01_ACT02_SC05', 2);
  await expect(page.locator('.speaker-line > span')).toHaveText('奧莉維亞');
  await jump('EP01_ACT05_SC01', 3);
  await expect(page.locator('.speaker-line > span')).toHaveText('奧莉維亞');
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.locator('.speaker-line > span')).toHaveText('內廷承辦人');
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.locator('.speaker-line > span')).toHaveText('奧莉維亞');
  await jump('EP01_ACT05_SC03', 2);
  await expect(page.locator('.speaker-line > span')).toHaveText('艾爾維爾');
  if (await page.getByRole('button', { name: '關閉通知', exact: true }).isVisible())
    await page.getByRole('button', { name: '關閉通知', exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-speaker-elvir.png`,
    fullPage: true,
  });
  await jump('EP01_ACT01_SC04', 26);
  await expect(page.getByTestId('dialogue-text')).toHaveText('「返都後相關職責，另行通知。」');
  await expect(page.locator('.speaker-line')).toHaveCount(0);
  await jump('EP01_ACT05_SC01_COMMON', 8);
  await expect(page.locator('.speaker-line')).toHaveCount(0);
  const thought = story.scenes.EP01_ACT04_SC01.segments.findIndex((p) => p.kind === 'thought');
  await jump('EP01_ACT04_SC01', thought);
  await expect(page.locator('.speaker-line > span')).toHaveText('奧莉維亞（內心）');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
});
