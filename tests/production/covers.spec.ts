import { test, expect } from '@playwright/test';
import { coverPreferences } from '../helpers/cover-preferences';
import { createHash } from 'node:crypto';
import audit from '../../content/sources/covers/release-20261104/asset-audit.json' with { type: 'json' };
import defaultAudit from '../../content/sources/covers/default-palace.json' with { type: 'json' };

test('production ships all cover originals and remembers a manual appearance choice', async ({
  page,
  request,
}) => {
  for (const image of [...audit.images, defaultAudit]) {
    const response = await request.get('/' + image.path);
    expect(response.status()).toBe(200);
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex')
    ).toBe(image.sha256);
    await response.dispose();
  }
  await page.goto('/');
  await expect(page.getByTestId('title-cover')).toHaveJSProperty('naturalWidth', 1672);
  await coverPreferences(page, ['TOWER']);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('首頁封面').selectOption('tower-character');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await expect(page.getByTestId('title-cover')).toHaveAttribute(
    'src',
    './assets/covers/release-20261104/tower-character-desktop.jpg'
  );
  await expect(page.getByTestId('title-cover')).toHaveJSProperty('naturalWidth', 1920);
  await expect(page.getByRole('navigation', { name: '主選單' }).getByRole('button')).toHaveCount(8);
});
