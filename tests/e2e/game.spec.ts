import { test, expect } from '@playwright/test';

test('the player menu has no author tools and safely resumes or restarts progress', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: '主選單', exact: true });
  await expect(menu.getByRole('button')).toHaveCount(8);
  await expect(page.locator('body')).not.toContainText(
    /引擎試演|第一階段|草稿試演|瀏覽劇情架構|開發者工具|測試選項/
  );
  await expect(page.getByRole('button', { name: '繼續遊戲', exact: true })).toBeDisabled();
  await expect(page.getByLabel('劇情密碼', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-player-title.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText('安度因的鐘聲，總是準時響起。');
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
  const paragraph = await page.getByTestId('dialogue-text').innerText();
  await page.getByRole('button', { name: '返回標題', exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(page.getByRole('button', { name: '繼續遊戲', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '繼續遊戲', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(paragraph);
  await page.getByRole('button', { name: '返回標題', exact: true }).click();
  await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('自動存檔會先備份');
  await page.getByRole('button', { name: '確認開始', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText('安度因的鐘聲，總是準時響起。');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await expect(page.locator('.backup-list p')).not.toHaveCount(0);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText(/測試|引擎|DEMO/);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '結局', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText(/測試|引擎|DEMO/);
  expect(errors).toEqual([]);
});
