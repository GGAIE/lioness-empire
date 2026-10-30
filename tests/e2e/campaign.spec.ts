import { test, expect, type Page } from '@playwright/test';
async function openPlan(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '瀏覽劇情架構' }).click();
  await expect(page.getByRole('region', { name: '第一部劇情架構' })).toBeVisible();
}
test('chapter plan exposes 13 linked chapters, five-act exceptions and cross-chapter event slots', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openPlan(page);
  await expect(page.getByRole('navigation', { name: '規劃章節' }).getByRole('button')).toHaveCount(
    13
  );
  await page
    .getByRole('navigation', { name: '規劃章節' })
    .getByRole('button', { name: '09 誰在統治安度因' })
    .click();
  await expect(page.locator('.act-list>li')).toHaveCount(5);
  await expect(page.locator('.chapter-events')).toContainText('A4 尼爾斯繼承危機');
  await expect(page.locator('.chapter-events')).toContainText('跨章');
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-campaign.png`,
    fullPage: true,
  });
  await page
    .getByRole('navigation', { name: '規劃章節' })
    .getByRole('button', { name: '12 母獅帝國', exact: true })
    .click();
  await expect(page.locator('.act-heading').getByText('無有效選項')).toHaveCount(5);
  await page.getByRole('button', { name: '角色事件', exact: true }).click();
  await expect(page.locator('.event-lanes article')).toHaveCount(24);
  await expect(page.locator('.event-lanes')).toContainText('CLEAR 分數分開');
  expect(errors).toEqual([]);
});
test('resource calculator preserves bands and unknown exception or insufficiency', async ({
  page,
}) => {
  await openPlan(page);
  await page.getByRole('button', { name: '規則試算', exact: true }).click();
  await expect(page.getByRole('region', { name: '固定劇情效果規則' })).toContainText(
    '玩家不輸入數值'
  );
  await page.getByText('進階開發測試（不屬於玩家操作）', { exact: true }).click();
  await page.getByLabel('測試政治點數', { exact: true }).fill('100');
  await page.getByLabel('承接動盪', { exact: true }).fill('80');
  await expect(page.getByLabel('章初試算結果')).toContainText('扣 40 點，剩餘 60');
  await page.getByLabel('承接動盪', { exact: true }).fill('79');
  await expect(page.getByLabel('章初試算結果')).toContainText('扣 10 點，剩餘 90');
  await page.getByLabel('測試政治點數', { exact: true }).fill('1');
  await expect(page.getByLabel('章初試算結果')).toContainText('點數不足規則尚未定案');
  await page.getByLabel('試算章節', { exact: true }).selectOption('EP12');
  await expect(page.getByLabel('章初試算結果')).toContainText('待確認提案');
});
test('walkthrough waits for authored story options and never unlocks game progress', async ({
  page,
}) => {
  await openPlan(page);
  await page.getByRole('button', { name: '規則試算', exact: true }).click();
  await page.getByText('進階開發測試（不屬於玩家操作）', { exact: true }).click();
  await page.getByLabel('走訪政治點數', { exact: true }).fill('100');
  await page.getByRole('button', { name: '建立測試情境', exact: true }).click();
  await page.getByRole('button', { name: '進入下一章', exact: true }).click();
  await expect(page.locator('.walk-state')).toContainText('PROLOGUE');
  await page.getByRole('button', { name: '完成本章', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('序幕不啟動計分');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入下一章', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('100 − 0 = 100');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '前進下一幕', exact: true }).click();
  await expect(page.locator('.decision-testing')).toContainText('尚未提供正式選項與數值');
  await expect(page.getByLabel('測試選項成本', { exact: true })).toHaveCount(0);
  await expect(page.locator('.walk-state')).toContainText('政治資源 100');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('已閱讀');
});
test('pinned resource display follows live state and chapter settlement warns without charging twice', async ({
  page,
}, testInfo) => {
  await openPlan(page);
  const planDialog = page.getByRole('dialog', { name: '第一部劇情架構', exact: true });
  await expect(planDialog.getByTestId('political-points')).toHaveText('50');
  await expect(planDialog.getByTestId('unrest-value')).toHaveText('30 / 100');
  await page.getByRole('button', { name: '規則試算', exact: true }).click();
  await page.getByText('進階開發測試（不屬於玩家操作）', { exact: true }).click();
  await page.getByLabel('走訪政治點數', { exact: true }).fill('100');
  await page.getByLabel('走訪初始動盪', { exact: true }).fill('80');
  await page.getByRole('button', { name: '建立測試情境', exact: true }).click();
  await expect(planDialog.getByTestId('political-points')).toHaveText('100');
  await expect(planDialog.getByTestId('unrest-value')).toHaveText('80 / 100');
  await planDialog.evaluate((d) => {
    d.scrollTop = d.scrollHeight;
  });
  const box = await planDialog.getByRole('region', { name: '政治點數與動盪值' }).boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(page.viewportSize()?.height ?? 900);
  await page.getByRole('button', { name: '進入下一章', exact: true }).click();
  await page.getByRole('button', { name: '完成本章', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('扣除 40 點');
  await expect(page.getByRole('alertdialog').getByTestId('political-points')).toHaveText('100');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入下一章', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('100 − 40 = 60');
  await expect(page.getByRole('alertdialog').getByTestId('political-points')).toHaveText('60');
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-settlement.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: '前進下一幕', exact: true }).click();
  await page.getByRole('button', { name: '完成本章', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('預計剩餘 20 點');
  await expect(page.getByRole('alertdialog').getByTestId('political-points')).toHaveText('60');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '60'
  );
  await page.getByRole('button', { name: '瀏覽劇情架構' }).click();
  await expect(page.getByRole('dialog').getByTestId('political-points')).toHaveText('60');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '開始序幕' }).click();
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
});
test('planning source questions and name variants remain visible without silent canon edits', async ({
  page,
}) => {
  await openPlan(page);
  await page.getByRole('button', { name: '待確認事項', exact: true }).click();
  await expect(page.locator('.pending-list article')).toHaveCount(8);
  await expect(page.locator('.name-aliases')).toContainText('塔娜拉 ↔ 塔瑪拉');
  await expect(page.locator('.pending-list')).toContainText('v2.1／v6.1 原件尚未補齊');
  const size = await page.evaluate(() => ({
    w: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.w);
});
