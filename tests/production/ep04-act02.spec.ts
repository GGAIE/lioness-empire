import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import audit from '../../content/sources/ep04/act02-asset-audit.json' with { type: 'json' };

test('EP04 ACT02 production ships 25 final originals, continues the previous act and charges F1 immediately', async ({
  page,
  request,
}) => {
  const story = await loadReaderContent();
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
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const id of ['EP04_ACT01_SC05_COMMON', 'EP04_ACT02_SC06']) {
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.currentSegmentIndex = story.scenes[id].segments.length - 1;
    state.campaign!.politicalPoints = 35;
    state.campaign!.unrest = 80;
    state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 80, cost: 40 }];
    if (id.includes('ACT01')) {
      state.contentVersion = '0.12.0-ep04-act01-v1.0-art-selected-v0.1.reader-v1';
      delete state.flags.FINLEY_RESEARCH_F1_STATE;
    }
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'ep04-act02-fixture.json',
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
    if (id.includes('ACT01')) {
      await page.getByRole('button', { name: '進入第二幕 →', exact: true }).click();
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT02_SC01');
      await expect(page.getByTestId('scene-cg')).toHaveAttribute(
        'src',
        './' + audit.images[0].path
      );
      await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
        'naturalWidth',
        audit.images[0].width
      );
      await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
        '35'
      );
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
    } else {
      await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(2);
      await page.getByLabel('劇情選項').getByRole('button').nth(0).click();
      await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
        '25'
      );
      await expect(page.locator('.game-frame')).toHaveAttribute(
        'data-scene-id',
        'EP04_ACT02_SC06_1'
      );
    }
  }
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
