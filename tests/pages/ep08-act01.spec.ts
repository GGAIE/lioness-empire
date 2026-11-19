import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';

test('continues EP07 saves into the matching EP08 opening with one upkeep receipt', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.19/ }).click();
  await expect(page.getByRole('dialog')).toContainText('第八章第一幕');
  await expect(page.getByRole('dialog')).toContainText('43 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const scene = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP07' &&
        s.act === 'ACT05' &&
        s.completion &&
        s.availableWhen &&
        'value' in s.availableWhen &&
        s.availableWhen.value === route
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.unrest = 70;
    state.contentVersion = '0.19.0-ep07-complete.reader-v1';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await expect(page.getByRole('alertdialog')).toContainText('EP08');
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '50'
    );
    await page.getByRole('button', { name: '進入第八章 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT01_SC01_${route[0]}`
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute(
      'src',
      new RegExp(`/ep08/act01/${route.toLowerCase()}/cg01\\.webp`)
    );
    await expect(cg).toBeVisible();
    await expect
      .poll(() => cg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '40'
    );
    await expect(page.getByRole('alertdialog')).toContainText('10');
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await page.getByRole('button', { name: '隱藏對話框', exact: true }).click();
    await page.getByRole('button', { name: '點任意處顯示對話框', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT01_SC01_${route[0]}`
    );
    await page.screenshot({ path: `test-results/ep08-${route}-${info.project.name}.png` });
  }
});

test('renders both flavor choices with correct speakers and offers the next authored act', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const scene = story.scenes[`EP08_ACT01_SC01_${route[0]}`];
    const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: scene.choices[1].text }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT01_SC01_${route[0]}_C01_B`
    );
    await expect(page.locator('.speaker-line')).toContainText('奧莉薇雅');
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.completion &&
        s.availableWhen &&
        'value' in s.availableWhen &&
        s.availableWhen.value === route
    )!;
    const final = {
      ...state,
      currentSceneId: end.id,
      currentSegmentIndex: visibleSegments(story, { ...state, currentSceneId: end.id }).length - 1,
    };
    await importPlayerState(page, final);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第一幕完');
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      route === 'SACRED' ? '第二幕〈身子原不是一個肢體，乃是許多肢體〉' : '第二幕〈若一個肢體受苦，所有的肢體就一同受苦〉'
    );
    await expect(page.getByRole('button', { name: '進入第二幕 →', exact: true })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
});
