import { test, expect, type Page } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
async function close(page: Page) {
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
async function access(page: Page) {
  await page.getByRole('button', { name: '其他選項', exact: true }).click();
}
async function directory(page: Page) {
  await expect(page.locator('.shell')).toBeVisible();
  await page
    .getByRole('button', {
      name: (await page.locator('.shell--title').count()) ? '章節目錄' : '章節',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
}
async function preference(page: Page) {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open('lioness-empire-html5-v1');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            r = db.transaction('preferences').objectStore('preferences').get('settings');
          r.onsuccess = () => {
            resolve(r.result?.storyUnlocked === true);
            db.close();
          };
          r.onerror = () => reject(r.error);
        };
      })
  );
}
test('the subtle symbol opens best access, remembers it, preserves backups and restores normal gates', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const story = await loadReaderContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByLabel('劇情密碼', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '其他選項', exact: true })).toHaveText('✧');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await close(page);
  const lateTitle = story.scenes.EP04_ACT01_SC05.title,
    firstTitle = story.scenes.EP01_ACT01_SC01.title;
  const late = () => page.locator('.directory-sections button').filter({ hasText: lateTitle });
  await directory(page);
  await expect(late()).toBeDisabled();
  await expect(page.getByLabel('劇情密碼', { exact: true })).toHaveCount(0);
  await close(page);
  await access(page);
  await page.getByLabel('劇情密碼', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '解鎖劇情', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('密碼不正確，請重新輸入。');
  await page.getByLabel('劇情密碼', { exact: true }).fill('best');
  await page.getByRole('button', { name: '解鎖劇情', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('自由閱讀已開啟');
  await close(page);
  await directory(page);
  await expect(page.locator('.directory-sections button:enabled')).toHaveCount(109);
  await page.locator('.directory-sections button').filter({ hasText: firstTitle }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT01_SC01');
  await directory(page);
  await late().click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT01_SC05');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const backup = page.locator('.backup-list p').filter({ hasText: firstTitle }).first();
  await backup.getByRole('button', { name: '讀取', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT01_SC01');
  await expect.poll(() => preference(page)).toBe(true);
  await page.reload();
  await directory(page);
  await expect(page.locator('.directory-sections button:enabled')).toHaveCount(109);
  await close(page);
  await access(page);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-secret-access.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '恢復順序閱讀', exact: true }).click();
  await expect.poll(() => preference(page)).toBe(false);
  await close(page);
  await directory(page);
  await expect(late()).toBeDisabled();
  await page.reload();
  await access(page);
  await expect(page.getByLabel('劇情密碼', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
