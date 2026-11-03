import { test, expect, type Page } from '@playwright/test';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { GameState } from '../../packages/narrative-core/schema';
async function importState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep02-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: { slot: 'entry', title: 'EP02', savedAt: '2026-10-31', thumbnail: null, state },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
test('old ACT02 ending continues into the supplied ACT03 without a second chapter fee', async ({
  page,
}) => {
  const story = await loadContent(),
    state = initialState({ ...story, manifest: { ...story.manifest, start: 'EP02_ACT02_SC01' } });
  state.currentSceneId = 'EP02_ACT02_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.contentVersion = '0.9.0-ep02-act02-script-v1.1-art-v1.2';
  delete state.flags.AIVIS_DEPARTED_EASTERN_FRONT;
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 30, cost: 0 }];
  state.readChapters = ['EP01'];
  await start(page);
  await importState(page, state);
  await page.getByRole('button', { name: '進入 EP02 第三幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP02_ACT03_SC01');
  await expect(page.getByTestId('dialogue-text')).toHaveText(
    story.scenes.EP02_ACT03_SC01.segments[0].text
  );
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    /EP02_ACT03_SC01_CG01_v0.1.png$/
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
});
test('restored ACT05 illustrations display and only the true chapter ending issues settlement', async ({
  page,
}) => {
  const story = await loadContent(),
    state = initialState({ ...story, manifest: { ...story.manifest, start: 'EP02_ACT05_SC01' } });
  state.currentSceneId = 'EP02_ACT05_SC05';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.findIndex(
    (p) => p.cg === 'EP02-ACT05-CG05-23'
  );
  state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
  state.readChapters = ['EP01'];
  await start(page);
  await importState(page, state);
  await expect(page.locator('.stage .missing')).toHaveCount(0);
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    /complete-v0.2\/EP02_ACT05_SC05_CG23_v0.1.png$/
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText('芬利（說書）');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  state.currentSceneId = 'EP02_ACT05_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  await importState(page, state);
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第二章完 · 留下來的人'
  );
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('EP03');
  await expect(page.getByRole('button', { name: '進入 EP03 第三章' })).toBeVisible();
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
