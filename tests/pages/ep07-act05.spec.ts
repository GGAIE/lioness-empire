import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';

test('continues both fourth-act saves and displays the new release entry', async ({ page }) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: /更新日誌 OLIVIA2026\.11\.11/ }).click();
  await expect(page.getByRole('dialog')).toContainText('第七章第五幕');
  await expect(page.getByRole('dialog')).toContainText('60 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const scene = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP07' &&
        s.act === 'ACT04' &&
        s.completion &&
        s.availableWhen &&
        'value' in s.availableWhen &&
        s.availableWhen.value === route
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.contentVersion = '0.18.0-ep07-act04.reader-v1';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第五幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP07_ACT05_SC01_${route[0]}`
    );
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/act05/${route.toLowerCase()}/CG01\\.webp`)
    );
  }
});

test('shows the chapter-end warning and keeps EP08 upkeep deferred', async ({ page }, info) => {
  const story = await loadReaderContent();
  const scene = Object.values(story.scenes).find(
    (s) => s.chapter === 'EP07' && s.act === 'ACT05' && s.completion && s.id.includes('_W_')
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.politicalRoute = 'WORLD';
  state.campaign!.politicalRoute = 'WORLD';
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importPlayerState(page, state);
  const warning = page.getByRole('alertdialog');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('EP08');
  await expect(warning).toContainText('僅預告');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第七章完');
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第八章');
  await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await page.screenshot({ path: `test-results/ep07-act05-${info.project.name}.png` });
});
