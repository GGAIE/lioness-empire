import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadReaderContent, root } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { GameState } from '../../packages/narrative-core/schema';

async function restore(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep04-production.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'fixture',
          savedAt: '2026-11-03',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
test('production includes all 61 original CGs and continues an old ACT02 ending without another upkeep', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const story = await loadReaderContent();
  for (const act of [3, 4, 5]) {
    const audit = JSON.parse(
      await readFile(`${root}/content/sources/ep04/act0${act}-asset-audit.json`, 'utf8')
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
  const id = 'EP04_ACT02_SC06_COMMON',
    state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.contentVersion = '0.12.1-ep04-act02-v1.0-art-final-v0.3.reader-v1';
  state.flags.FINLEY_RESEARCH_F1_STATE = 'ACTIVE';
  state.campaign!.politicalPoints = 37;
  state.campaign!.unrest = 80;
  state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 80, cost: 40 }];
  await page.goto('/');
  await restore(page, state);
  await page.getByRole('button', { name: '進入第三幕 →', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT03_SC01');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '37'
  );
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
test('production skips declined F1, completes the earned reward once and warns only at the actual chapter ending', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const active of [false, true]) {
    const id = active ? 'EP04_ACT04_SC05' : 'EP04_ACT04_SC04';
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.flags.FINLEY_RESEARCH_F1_STATE = active ? 'MATERIAL_OBTAINED' : 'DECLINED';
    state.campaign!.politicalPoints = 40;
    state.currentSegmentIndex = story.scenes[id].segments.length - 1;
    if (active) state.readSegments = [`${id}:${story.scenes[id].segments.at(-1)!.id}`];
    await restore(page, state);
    await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
      active ? '60' : '40'
    );
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT04_SC06');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
  const id = 'EP04_ACT05_SC05_COMMON',
    end = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  end.currentSegmentIndex = story.scenes[id].segments.length - 1;
  end.campaign!.politicalPoints = 85;
  await restore(page, end);
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await expect(page.getByRole('alertdialog')).toContainText('章末政治點數：85');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第五章〈攝政成為習慣〉'
  );
  await expect(page.getByRole('button', { name: /進入第五章/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '章節完成' })).not.toContainText('劇本尚未提供');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '85'
  );
});
