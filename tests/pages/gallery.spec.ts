import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';

test('categorizes CGs without revealing locked images and preserves earned collections', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('幕', { exact: true })).toBeDisabled();
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP08');
  await dialog.getByLabel('幕', { exact: true }).selectOption('ACT03');
  await dialog.getByLabel('路線', { exact: true }).selectOption('SACRED');
  await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toHaveText(
    '共 24 張 · 已解鎖 0 張'
  );
  await expect(dialog.locator('.gallery-grid img')).toHaveCount(0);
  await expect(dialog.locator('.gallery-grid a')).toHaveCount(0);
  await expect(dialog.locator('.locked-image')).toHaveCount(24);
  await expect(dialog.getByLabel('幕', { exact: true }).locator('option:checked')).toContainText(
    '無人承接的契約'
  );
  await dialog.getByLabel('路線', { exact: true }).selectOption('WORLD');
  await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toHaveText(
    '共 28 張 · 已解鎖 0 張'
  );
  await dialog.getByRole('button', { name: '下一頁', exact: true }).click();
  await expect(dialog.locator('.locked-image')).toHaveCount(4);
  await expect(dialog.getByRole('button', { name: '下一頁', exact: true })).toBeDisabled();
  await dialog.getByLabel('收藏狀態', { exact: true }).selectOption('UNLOCKED');
  await expect(dialog).toContainText('此分類目前沒有符合條件的 CG。');
  await expect(dialog.getByLabel('CG 分頁')).toHaveCount(0);
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP01');
  await expect(dialog.getByLabel('幕', { exact: true })).toHaveValue('ALL');
  await dialog.getByRole('button', { name: '重設分類', exact: true }).click();
  await expect(dialog.getByLabel('章節', { exact: true })).toHaveValue('ALL');
  await expect(dialog.getByLabel('路線', { exact: true })).toHaveValue('ALL');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();

  // Earn one real CG through the reader, then verify the gallery never grants its neighbors.
  const story = await loadReaderContent();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP08_ACT03_SC01_W' },
  });
  state.politicalRoute = 'WORLD';
  state.campaign!.politicalRoute = 'WORLD';
  await importPlayerState(page, state);
  await expect
    .poll(() =>
      page
        .getByTestId('scene-cg')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    )
    .toBe(true);
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP08');
  await dialog.getByLabel('幕', { exact: true }).selectOption('ACT03');
  await dialog.getByLabel('路線', { exact: true }).selectOption('WORLD');
  await dialog.getByLabel('收藏狀態', { exact: true }).selectOption('UNLOCKED');
  await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toHaveText(
    '共 1 張 · 已解鎖 1 張'
  );
  await expect(dialog.locator('.gallery-grid img')).toHaveAttribute(
    'src',
    /act03\/world\/cg01\.webp/
  );
  await dialog.getByLabel('收藏狀態', { exact: true }).selectOption('LOCKED');
  await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toHaveText(
    '共 27 張 · 已解鎖 0 張'
  );
  await expect(dialog.locator('.gallery-grid img')).toHaveCount(0);
  await dialog.getByLabel('收藏狀態', { exact: true }).selectOption('ALL');
  await page.screenshot({
    path: `test-results/gallery-${info.project.name}.png`,
    animations: 'disabled',
  });
});
