import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadReaderContent, root } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
test('production ships every complete original EP05 image and continues existing EP04 progress', async ({
  page,
  request,
}) => {
  for (const act of [1, 2, 3, 4]) {
    const audit = JSON.parse(
      await readFile(`${root}/content/sources/ep05/act0${act}/asset-audit.json`, 'utf8')
    );
    for (const image of audit.images) {
      const response = await request.get('/' + image.path);
      expect(response.status()).toBe(200);
      expect(
        createHash('sha256')
          .update(await response.body())
          .digest('hex')
      ).toBe(image.sha256);
      await response.dispose();
    }
  }
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const id = 'EP04_ACT05_SC05_COMMON';
  const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  s.currentSegmentIndex = visibleSegments(story, s).length - 1;
  s.campaign!.politicalPoints = 100;
  s.campaign!.unrest = 65;
  s.contentVersion = 'old-ep04';
  await importPlayerState(page, s);
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: /進入第五章/ }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章初');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP05_ACT01_SC01');
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
    '90'
  );
});

test('the supplemented final CG displays from an older save and enters the gallery', async ({
  page,
}) => {
  const story = await loadReaderContent();
  const id = 'EP05_ACT04_SC05';
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.currentSegmentIndex = visibleSegments(story, state).findIndex(
    (p) => p.cg === 'EP05-ACT04-CG23'
  );
  expect(state.currentSegmentIndex).toBeGreaterThan(0);
  state.contentVersion = '0.13.0-ep05-act01-act04.reader-v1';
  await page.goto('/');
  await importPlayerState(page, state);
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /LE_CG_EP05_ACT04_23\.png/);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.locator('.missing')).toHaveCount(0);
  await page.screenshot({
    path: 'docs/screenshots/production-ep05-act04-cg23-complete.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '返回標題', exact: true }).click();
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(
    page.getByRole('dialog').locator('img[src*="LE_CG_EP05_ACT04_23.png"]')
  ).toBeVisible();
});
