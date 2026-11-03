import { test, expect } from '@playwright/test';
import { covers } from '../../apps/web-vn/src/engine/covers';
import { coverPreferences } from '../helpers/cover-preferences';

test('default cover fits the first viewport and rewards stay locked despite an old choice or free reading', async ({
  page,
}) => {
  await page.goto('/');
  await coverPreferences(page, [], 'star-character', true);
  await expect(page.getByTestId('title-cover')).toHaveAttribute(
    'src',
    '/assets/covers/default-palace.png'
  );
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByLabel('首頁封面')).toHaveValue('palace');
  await expect(page.getByLabel('首頁封面').locator('option:disabled')).toHaveCount(6);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await coverPreferences(page, ['STAR']);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const select = page.getByLabel('首頁封面');
  await expect(select.locator('option:disabled')).toHaveCount(4);
  await expect(select.locator('option[value="star-character"]')).toBeEnabled();
  await expect(select.locator('option[value="star-abstract"]')).toBeEnabled();
  await select.selectOption('star-abstract');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('title-cover')).toHaveAttribute(
    'src',
    '/' + covers.find((c) => c.id === 'star-abstract')!.desktop
  );
});

test('all earned covers keep every menu button inside the artwork and viewport, preserve resources and persist', async ({
  page,
}, info) => {
  const errors: string[] = [];
  test.setTimeout(90000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await coverPreferences(page, ['STAR', 'TOWER', 'CHARIOT']);
  for (const cover of covers) {
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await expect(page.getByLabel('首頁封面').locator('option')).toHaveCount(7);
    await page.getByLabel('首頁封面').selectOption(cover.id);
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    const image = page.getByTestId('title-cover');
    const mobile = page.viewportSize()!.width <= 767;
    await expect
      .poll(() => image.evaluate((i: HTMLImageElement) => i.currentSrc))
      .toContain(cover[mobile ? 'mobile' : 'desktop']);
    await expect(image).toHaveJSProperty(
      'naturalWidth',
      cover.id === 'palace' ? 1672 : mobile ? 1080 : 1920
    );
    const picture = (await page.locator('.title-cover').boundingBox())!;
    for (const button of await page
      .getByRole('navigation', { name: '主選單' })
      .getByRole('button')
      .all()) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(picture.y);
      expect(box.y + box.height).toBeLessThanOrEqual(picture.y + picture.height);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    await expect(page.getByTestId('political-points')).toHaveText('50');
    await expect(page.getByTestId('unrest-value')).toHaveText('30 / 100');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight
      )
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-overlay-${cover.id}.png`,
    });
  }
  await page.reload();
  await expect(page.getByTestId('title-cover')).toHaveAttribute(
    'src',
    '/' + covers.at(-1)!.desktop
  );
  await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
  await expect(page.getByTestId('title-cover')).toHaveCount(0);
  await expect(page.getByTestId('scene-cg')).toBeVisible();
  await expect(page.getByTestId('dialogue-text')).toHaveText('安度因的鐘聲，總是準時響起。');
  await page.getByRole('button', { name: '返回標題', exact: true }).click();
  await expect(page.getByTestId('title-cover')).toHaveAttribute(
    'src',
    '/' + covers.at(-1)!.desktop
  );
  expect(errors).toEqual([]);
});
